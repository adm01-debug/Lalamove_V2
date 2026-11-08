#!/usr/bin/env node
/**
 * Verificador da documentação e do Realtime.
 *
 *   node scripts/docs/verificar-docs-realtime.mjs
 *
 * Não altera nada. Relê a documentação, o código e as migrations, e reprova
 * quando a documentação deixou de corresponder ao repositório ou quando uma
 * assinatura de Realtime aponta para tabela que não está publicada.
 *
 * Confere:
 *   1. todo `arquivo:linha` citado em `docs/**.md` existe e a linha citada
 *      existe no arquivo;
 *   2. toda tabela assinada em `postgres_changes` no `src/` está na publication
 *      `supabase_realtime`, provado por REPLAY das migrations (comentário de
 *      linha é ignorado, então rollback documentado não conta);
 *   3. informativo: tabelas publicadas que nenhum código assina.
 *
 * A checagem 2 é o que mais pega: assinar tabela fora da publication não dá
 * erro em runtime — o canal conecta e simplesmente nunca recebe evento.
 *
 * PORTADO do Zapp Web V2 (`scripts/docs/verificar-docs-realtime.mjs`) e
 * ADAPTADO. Lá o script valida três documentos específicos
 * (`REALTIME-CHANNELS-INVENTORY.md`, `ADR-009`, `JORNADA_MENSAGEM_WHATSAPP.md`)
 * e faz o parsing da TABELA de canais do inventário, inclusive da linha
 * "Fora da publication hoje: ...". Nenhum desses documentos — nem o formato de
 * tabela — existe aqui: `docs/adr/` tem só ADR-001 e ADR-002 e não há
 * inventário de canais. Portar aquele parser daria um guard que falha na
 * primeira linha por documento ausente.
 *
 * Então a parte genérica (citação `arquivo:linha`) passou a valer para
 * `docs/**.md`, e a parte de Realtime trocou "doc -> publication" por
 * "CÓDIGO -> publication", que não depende de documento nenhum e vale para os
 * canais reais (src/hooks/useRealtimeSubscriptions.ts, src/hooks/useSecurityPushNotifications.ts,
 * src/components/map/hooks/useTrackingData.ts, src/pages/LiveMapPage.tsx).
 *
 * `docs/agentes/**` fica FORA de propósito: aquele diretório tem guard próprio
 * (`scripts/ci/check-agents-md-integrity.mjs`) e dono próprio.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Citação de arquivo do repo, com linha opcional. */
const CITACAO =
  /\b((?:src|supabase|scripts|docs|e2e)\/[A-Za-z0-9_./-]+\.(?:tsx|ts|mjs|cjs|sql|md|json|css|sh))(?::(\d+)(?:-(\d+))?)?(?![\w])/g;

/** `ALTER PUBLICATION supabase_realtime ADD|DROP TABLE ...` */
const PUBLICATION = /ALTER\s+PUBLICATION\s+supabase_realtime\s+(ADD|DROP)\s+TABLE\s+([^;]+)/gi;

/** `{ event: '*', schema: 'public', table: 'alerts' }` de uma assinatura postgres_changes. */
const TABELA_ASSINADA = /table:\s*['"]([a-z_][a-z0-9_]*)['"]/g;

/**
 * Placeholders que a documentação usa de propósito e que não são citação real.
 * `docs/DEPLOYMENT.md:41` cita `supabase/migrations/xxx_add_new_table.sql` como
 * exemplo de nome de arquivo a criar.
 */
const PLACEHOLDER = /(?:^|\/)(?:xxx|XXX|\.\.\.|<[^>]+>)/;

const erros = [];
const errar = (msg) => erros.push(msg);
const ler = (rel) => readFileSync(resolve(RAIZ, rel), 'utf8');

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entrada.name)) continue;
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) walk(caminho, acc);
    else acc.push(caminho);
  }
  return acc;
}

/** Documentos auditados: docs/**.md menos docs/agentes/**. */
function documentos() {
  return walk(resolve(RAIZ, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => relative(RAIZ, f))
    .filter((rel) => !rel.startsWith(`docs${sep}agentes${sep}`))
    .sort();
}

function semComentarioDeLinha(sql) {
  return sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
}

function tabelasDaInstrucao(lista) {
  return lista
    .replace(/\([^)]*\)/g, '')
    .split(',')
    .map((p) => p.trim().split(/\s+/)[0]?.replace(/public\./i, '').replace(/"/g, '') ?? '')
    .filter((t) => /^[a-z_][a-z0-9_]*$/.test(t));
}

/** Estado final da publication, por replay das migrations em ordem de nome. */
function replayPublication() {
  const publicadas = new Set();
  const dir = resolve(RAIZ, 'supabase/migrations');
  if (!existsSync(dir)) {
    errar('supabase/migrations ausente — nao da para provar a publication');
    return publicadas;
  }
  const arquivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const arquivo of arquivos) {
    const texto = semComentarioDeLinha(readFileSync(join(dir, arquivo), 'utf8'));
    for (const m of texto.matchAll(PUBLICATION)) {
      for (const t of tabelasDaInstrucao(m[2])) {
        if (m[1].toUpperCase() === 'ADD') publicadas.add(t);
        else publicadas.delete(t);
      }
    }
  }
  return { publicadas, migrations: arquivos.length };
}

/** Tabelas assinadas em postgres_changes, com onde aparecem. */
function assinaturasDoCodigo() {
  const porTabela = new Map();
  for (const arquivo of walk(resolve(RAIZ, 'src'))) {
    if (!/\.(ts|tsx)$/.test(arquivo)) continue;
    if (/\.(test|spec)\.[tj]sx?$/.test(arquivo)) continue;
    const texto = readFileSync(arquivo, 'utf8');
    if (!texto.includes('postgres_changes')) continue;
    const rel = relative(RAIZ, arquivo);
    for (const m of texto.matchAll(TABELA_ASSINADA)) {
      const linha = texto.slice(0, m.index).split('\n').length;
      porTabela.set(m[1], [...(porTabela.get(m[1]) ?? []), `${rel}:${linha}`]);
    }
  }
  return porTabela;
}

let citacoes = 0;

for (const doc of documentos()) {
  const texto = ler(doc);
  for (const m of texto.matchAll(CITACAO)) {
    const [, rel, inicio] = m;
    if (PLACEHOLDER.test(rel)) continue;
    citacoes += 1;
    const alvo = resolve(RAIZ, rel);
    const linhaDoDoc = texto.slice(0, m.index).split('\n').length;
    if (!existsSync(alvo)) {
      errar(`${doc}:${linhaDoDoc}: cita arquivo inexistente ${rel}`);
      continue;
    }
    if (!statSync(alvo).isFile()) {
      errar(`${doc}:${linhaDoDoc}: ${rel} nao e arquivo`);
      continue;
    }
    if (inicio) {
      const total = ler(rel).split('\n').length;
      if (Number(inicio) > total) {
        errar(`${doc}:${linhaDoDoc}: ${rel}:${inicio} passou do fim do arquivo (${total} linhas)`);
      }
    }
  }
}

const { publicadas, migrations } = replayPublication();
const assinadas = assinaturasDoCodigo();

if (assinadas.size === 0) {
  errar('nenhuma assinatura postgres_changes encontrada em src/ — o extrator quebrou');
}

for (const [tabela, ondes] of [...assinadas].sort()) {
  if (publicadas.has(tabela)) continue;
  errar(
    `assinatura de Realtime sem publication: '${tabela}' (nenhum ALTER PUBLICATION supabase_realtime ADD TABLE no replay) — ` +
    `o canal conecta e nunca recebe evento. Em: ${ondes.join(', ')}`,
  );
}

const publicadasSemUso = [...publicadas].filter((t) => !assinadas.has(t)).sort();

if (erros.length > 0) {
  console.error(`FALHOU (${erros.length})`);
  for (const e of erros) console.error(` - ${e}`);
  if (publicadasSemUso.length) {
    console.error(`\nINFO: publicadas e nao assinadas: ${publicadasSemUso.join(', ')}`);
  }
  process.exit(1);
}

console.log(
  `OK: ${documentos().length} documentos, ${citacoes} citacoes arquivo:linha, ` +
    `${assinadas.size} tabelas assinadas, ${publicadas.size} publicadas ` +
    `(replay de ${migrations} migrations).`,
);
if (publicadasSemUso.length) {
  console.log(`INFO: publicadas e nao assinadas: ${publicadasSemUso.join(', ')}`);
}
