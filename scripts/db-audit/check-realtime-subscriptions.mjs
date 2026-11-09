#!/usr/bin/env node
/**
 * Cruza as assinaturas Realtime do front com a publicacao `supabase_realtime`.
 *
 * O front chama `.on('postgres_changes', { schema, table }, ...)`. Se a tabela
 * NAO esta na publicacao, o canal conecta, o `subscribe()` devolve SUBSCRIBED e
 * nenhum evento chega nunca — a tela fica muda sem erro. Este guard lista as
 * tabelas assinadas (leitura AST, nao regex) e exige que cada uma esteja na
 * publicacao.
 *
 * Fonte da publicacao (adaptacao ao Lalamove V2): no Zapp Web V2 a lista vinha
 * de um baseline JSON revisado contra o banco vivo
 * (`realtime-publication-baseline.json` + check-runtime-config.mjs). Este repo
 * nao tem esse baseline e nenhuma sessao de agente tem credencial do banco
 * `iecgydonctmabiijadsf`, entao a lista e derivada de supabase/migrations/:
 * todo `ALTER PUBLICATION supabase_realtime ADD TABLE ...` commitado. Isso prova
 * o que as migrations pedem, NAO o estado da publicacao no banco agora (tabela
 * adicionada pelo painel/Lovable nao aparece aqui). Para a prova do banco vivo:
 *   psql "$DESTINO_URL" -X -At -c "select schemaname||'.'||tablename from pg_publication_tables where pubname='supabase_realtime' order by 1"
 *
 * Saida: 0 = toda assinatura esta na publicacao; 1 = assinatura dinamica
 * (fail-closed) ou fora da publicacao.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';

export const MIGRATIONS_DIR_PADRAO = 'supabase/migrations';

// ADD/DROP/SET TABLE aceitam lista: `ADD TABLE public.a, public.b`. `ONLY` e
// `IF NOT EXISTS` sao ruido sintatico; o que importa e o nome qualificado.
const ALTER_PUBLICACAO = /ALTER\s+PUBLICATION\s+supabase_realtime\s+(ADD|DROP|SET)\s+TABLE\s+([^;]+)/gi;
const CRIA_PARA_TODAS = /CREATE\s+PUBLICATION\s+supabase_realtime\s+FOR\s+ALL\s+TABLES/i;
const NOME_DE_TABELA = /^(?:ONLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(?:([a-zA-Z0-9_]+)\.)?([a-zA-Z0-9_]+)/i;

/**
 * Remove SO comentario de linha. Nao usa stripSqlComments de sql-lexer de
 * proposito: ele torna corpo dollar-quoted opaco, e neste repo um dos ADD TABLE
 * vive dentro de um bloco `DO $$ ... $$` com IF NOT EXISTS
 * (20260712231421_..., report_presets). Apagar o corpo esconderia a tabela e o
 * guard acusaria falso positivo contra src/hooks/useReportPresets.ts.
 */
function semComentarioDeLinha(sql) {
  return sql
    .split('\n')
    .filter((linha) => !linha.trimStart().startsWith('--'))
    .join('\n');
}

/**
 * Tabelas da publicacao `supabase_realtime` segundo as migrations commitadas,
 * aplicadas em ordem de version (ADD soma, DROP remove, SET substitui).
 */
export function baselineDaPublicacao(migrationsDir = MIGRATIONS_DIR_PADRAO) {
  const publicadas = new Set();
  let paraTodasAsTabelas = false;
  const arquivos = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((nome) => /^\d{14}_.+\.sql$/.test(nome)).sort()
    : [];

  for (const nome of arquivos) {
    const sql = semComentarioDeLinha(fs.readFileSync(path.join(migrationsDir, nome), 'utf8'));
    if (CRIA_PARA_TODAS.test(sql)) paraTodasAsTabelas = true;
    for (const achado of sql.matchAll(ALTER_PUBLICACAO)) {
      const operacao = achado[1].toUpperCase();
      const alvos = achado[2]
        .split(',')
        .map((bruto) => {
          const partes = NOME_DE_TABELA.exec(bruto.trim());
          return partes ? (partes[1] || 'public').toLowerCase() + '.' + partes[2].toLowerCase() : null;
        })
        .filter(Boolean);
      if (operacao === 'SET') publicadas.clear();
      for (const alvo of alvos) {
        if (operacao === 'DROP') publicadas.delete(alvo);
        else publicadas.add(alvo);
      }
    }
  }

  return {
    tabelas: [...publicadas].sort((a, b) => a.localeCompare(b)),
    paraTodasAsTabelas,
    arquivosLidos: arquivos.length,
  };
}

/** Lista de tabelas publicadas, no formato que evaluateRealtimeSubscriptions espera. */
export function loadRealtimeBaseline(migrationsDir = MIGRATIONS_DIR_PADRAO) {
  return baselineDaPublicacao(migrationsDir).tabelas;
}

function unwrap(node) {
  let current = node;
  while (current && (ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isParenthesizedExpression(current)
    || ts.isSatisfiesExpression(current))) {
    current = current.expression;
  }
  return current;
}

function literalText(node) {
  const value = unwrap(node);
  return value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    ? value.text
    : null;
}

function objectProperty(object, name) {
  const value = unwrap(object);
  if (!value || !ts.isObjectLiteralExpression(value)) return { kind: 'dynamic' };
  // A spread can overwrite a property that appears before it, or introduce a
  // property the guard cannot inspect. Treat the whole config as unresolved;
  // approving the first textual property would be a false proof.
  if (value.properties.some(ts.isSpreadAssignment)) return { kind: 'dynamic' };
  const properties = value.properties.filter(candidate => {
    const key = candidate.name;
    return key && (ts.isIdentifier(key) || ts.isStringLiteral(key)) && key.text === name;
  });
  if (properties.length === 0) return { kind: 'absent' };
  if (properties.length !== 1 || !ts.isPropertyAssignment(properties[0])) return { kind: 'dynamic' };
  return { kind: 'present', value: properties[0].initializer };
}

export function extractRealtimeSubscriptions(source, fileName = 'fixture.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const subscriptions = [];
  const unresolved = [];
  const constantStrings = new Map();
  const wrapperIdentifiers = new Set();
  const wrapperNamespaces = new Set();
  const wrapperAliases = new Map();
  const boundOnIdentifiers = new Set();
  const localDeclarations = new Set();

  function isRealtimeWrapperModule(value) {
    return typeof value === 'string'
      && (value.includes('/realtime') || value.endsWith('useSupabaseRealtime'));
  }

  function collectBindings(node) {
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (clause?.name) localDeclarations.add(clause.name.text);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) localDeclarations.add(element.name.text);
      } else if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        localDeclarations.add(clause.namedBindings.name.text);
      }
      if (!isRealtimeWrapperModule(node.moduleSpecifier.text)) {
        ts.forEachChild(node, collectBindings);
        return;
      }
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          const imported = element.propertyName?.text || element.name.text;
          if (imported === 'useSupabaseRealtime') wrapperIdentifiers.add(element.name.text);
        }
      } else if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        wrapperNamespaces.add(clause.namedBindings.name.text);
      }
    }

    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
      localDeclarations.add(node.name.text);
    }

    if (ts.isVariableStatement(node)
      && (node.declarationList.flags & ts.NodeFlags.Const) !== 0) {  // NOSONAR(S1529): mascara de bit real da API do TypeScript (NodeFlags.Const); `&&` mudaria a semantica
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        localDeclarations.add(declaration.name.text);
        const initializer = unwrap(declaration.initializer);
        const text = literalText(initializer);
        if (text !== null) constantStrings.set(declaration.name.text, text);
        if (ts.isIdentifier(initializer)) wrapperAliases.set(declaration.name.text, initializer.text);
        if (boundOnTarget(initializer)) boundOnIdentifiers.add(declaration.name.text);
      }
    }
    ts.forEachChild(node, collectBindings);
  }
  collectBindings(sourceFile);

  function resolvedLiteral(node) {
    const direct = literalText(node);
    if (direct !== null) return direct;
    const value = unwrap(node);
    return value && ts.isIdentifier(value) ? constantStrings.get(value.text) ?? null : null;
  }

  function isKnownWrapperIdentifier(name, seen = new Set()) {
    if (wrapperIdentifiers.has(name)) return true;
    if (name === 'useSupabaseRealtime' && !localDeclarations.has(name)) return true;
    if (seen.has(name)) return false;
    seen.add(name);
    const target = wrapperAliases.get(name);
    return target ? isKnownWrapperIdentifier(target, seen) : false;
  }

  function isKnownWrapperCallee(callee) {
    if (ts.isIdentifier(callee)) return isKnownWrapperIdentifier(callee.text);
    return ts.isPropertyAccessExpression(callee)
      && callee.name.text === 'useSupabaseRealtime'
      && ts.isIdentifier(unwrap(callee.expression))
      && wrapperNamespaces.has(unwrap(callee.expression).text);
  }

  function propertyName(node) {
    const value = unwrap(node);
    if (ts.isPropertyAccessExpression(value)) return value.name.text;
    if (ts.isElementAccessExpression(value) && value.argumentExpression) {
      return literalText(value.argumentExpression);
    }
    return null;
  }

  function boundOnTarget(callee) {
    const value = unwrap(callee);
    if (!ts.isCallExpression(value)) return null;
    const bind = unwrap(value.expression);
    if (!ts.isPropertyAccessExpression(bind) || bind.name.text !== 'bind') return null;
    return propertyName(bind.expression) === 'on' ? bind.expression : null;
  }

  function record(config, node, kind) {
    const tableProperty = objectProperty(config, 'table');
    const schemaProperty = objectProperty(config, 'schema');
    const table = tableProperty.kind === 'present' ? resolvedLiteral(tableProperty.value) : null;
    const schema = schemaProperty.kind === 'absent'
      ? 'public'
      : schemaProperty.kind === 'present'
        ? resolvedLiteral(schemaProperty.value)
        : null;
    if (!table || !schema) {
      // Fail-closed sem excecao: este repo nao tem hook wrapper que receba a
      // tabela do chamador (o Zapp tinha src/hooks/realtime/useSupabaseRealtime.ts
      // e isentava aquele arquivo). Assinatura com tabela/schema dinamico entra
      // como nao resolvida e derruba o guard.
      unresolved.push({ file: fileName, line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind });
      return;
    }
    subscriptions.push(`${schema}.${table}`);
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression);
      const onTarget = propertyName(callee) === 'on'
        ? callee
        : boundOnTarget(callee) || (ts.isIdentifier(callee) && boundOnIdentifiers.has(callee.text) ? callee : null);
      if (onTarget) {
        const event = resolvedLiteral(node.arguments[0]);
        if (event === 'postgres_changes') {
          record(node.arguments[1], node, 'channel.on');
        } else if (event === null) {
          unresolved.push({
            file: fileName,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            kind: 'channel.on.event',
          });
        }
      } else if (isKnownWrapperCallee(callee)) {
        record(node.arguments[0], node, 'useSupabaseRealtime');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { subscriptions, unresolved };
}

function sourceFiles(root) {
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') visit(fullPath);
      } else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  };
  visit(root);
  return files.sort((a, b) => a.localeCompare(b));
}

export function evaluateRealtimeSubscriptions(root = 'src', baseline = loadRealtimeBaseline()) {
  const subscriptions = [];
  const unresolved = [];
  for (const file of sourceFiles(root)) {
    const result = extractRealtimeSubscriptions(fs.readFileSync(file, 'utf8'), file);
    subscriptions.push(...result.subscriptions);
    unresolved.push(...result.unresolved);
  }
  const uniqueSubscriptions = [...new Set(subscriptions)].sort((a, b) => a.localeCompare(b));
  const allowed = new Set(baseline);
  const absentFromPublication = uniqueSubscriptions.filter(table => !allowed.has(table));
  return { subscriptions: uniqueSubscriptions, unresolved, absentFromPublication };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const publicacao = baselineDaPublicacao();
  console.log(
    'Publicacao supabase_realtime segundo as migrations ('
    + publicacao.arquivosLidos + ' arquivo[s]): ' + publicacao.tabelas.length + ' tabela[s]'
    + (publicacao.paraTodasAsTabelas ? ' + CREATE PUBLICATION FOR ALL TABLES' : ''),
  );
  for (const tabela of publicacao.tabelas) console.log('  publicada: ' + tabela);
  const result = evaluateRealtimeSubscriptions('src', publicacao.tabelas);
  for (const tabela of result.subscriptions) console.log('  assinada:  ' + tabela);
  if (result.unresolved.length || result.absentFromPublication.length) {
    for (const item of result.unresolved) {
      console.error('NAO RESOLVIDA: ' + item.file + ':' + item.line + ' (' + item.kind + ')');
    }
    for (const tabela of result.absentFromPublication) {
      console.error('FORA DA PUBLICACAO: ' + tabela + ' — o front assina e nenhum ALTER PUBLICATION commitado a inclui');
    }
    console.error(
      'FALHA: assinatura dinamica=' + result.unresolved.length
      + '; fora da publicacao=' + (result.absentFromPublication.join(', ') || 'nenhuma'),
    );
    process.exitCode = 1;
  } else {
    console.log('OK: ' + result.subscriptions.length + ' tabela[s] assinada[s], todas na publicacao.');
  }
}
