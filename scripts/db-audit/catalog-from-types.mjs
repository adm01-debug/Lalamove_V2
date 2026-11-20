#!/usr/bin/env node
/**
 * Extrai o catalogo de objetos do schema `public` a partir de
 * src/integrations/supabase/types.ts.
 *
 * Por que existe (adaptacao ao Lalamove V2): no Zapp Web V2 o
 * supabase-usage-guard compara os call-sites com supabase/schema-catalog.json,
 * gerado por scripts/db-audit/catalog.sql contra o banco oficial. Este repo
 * NAO tem esse snapshot e nenhuma sessao de agente tem credencial do banco
 * `iecgydonctmabiijadsf`, entao o guard ficaria sem fonte de schema.
 *
 * O types.ts deste repo e gerado a partir do banco vivo (`supabase gen types`,
 * hoje pela Lovable) e e a UNICA evidencia versionada do schema real. Ele vale
 * como snapshot de leitura: nomes de tabela, view, funcao e enum do schema
 * public. O que ele NAO prova: data de geracao (o arquivo nao carrega
 * `generated_at`), assinaturas de funcao (Args/Returns do TS nao sao tipos
 * Postgres) e nada de ACL/RLS. Por isso o catalogo de verdade
 * (scripts/db-audit/catalog.sql) continua sendo o modo forte — este e o modo
 * degradado, sempre anunciado por quem usa.
 *
 * O formato gerado pelo `supabase gen types` e estavel na indentacao: dentro de
 * `public: {` as secoes ficam em 4 espacos e cada objeto em 6. O parser le isso
 * e para no `export const Constants`, para nao reabrir as mesmas secoes no
 * bloco de constantes do fim do arquivo.
 *
 * Uso:
 *   node scripts/db-audit/catalog-from-types.mjs [caminho-do-types.ts]
 *     imprime o catalogo em JSON (mesma forma de catalog.sql, sem assinaturas).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TYPES_PATH_PADRAO = 'src/integrations/supabase/types.ts';

const SECOES = new Map([
  ['Tables', 'tables'],
  ['Views', 'views'],
  ['Functions', 'functions'],
  ['Enums', 'enums'],
]);

const CABECALHO_SECAO = /^ {4}([A-Za-z]+): \{$/;
const FIM_SECAO = /^ {4}\}$/;
const ENTRADA = /^ {6}([A-Za-z0-9_]+):/;
const FIM_DO_BLOCO_DE_TIPOS = /^export const Constants\b/;

/**
 * Catalogo a partir do TEXTO do types.ts. Nomes ordenados e sem repeticao, para
 * o resultado nao depender da ordem do arquivo.
 */
export function catalogoDeTypes(texto) {
  const saida = { tables: new Set(), views: new Set(), functions: new Set(), enums: new Set() };
  let secao = null;

  for (const linha of String(texto).split('\n')) {
    if (FIM_DO_BLOCO_DE_TIPOS.test(linha)) break;
    const cabecalho = CABECALHO_SECAO.exec(linha);
    if (cabecalho) {
      secao = SECOES.get(cabecalho[1]) ?? null;
      continue;
    }
    if (FIM_SECAO.test(linha)) {
      secao = null;
      continue;
    }
    if (!secao) continue;
    const entrada = ENTRADA.exec(linha);
    if (entrada) saida[secao].add(entrada[1]);
  }

  const ordenado = (conjunto) => [...conjunto].sort((a, b) => a.localeCompare(b));
  return {
    format_version: 2,
    // Sem data real: o types.ts nao registra quando foi gerado. A data zero faz
    // a projecao forward-only do supabase-usage-guard percorrer TODAS as
    // migrations, em vez de supor um corte que o arquivo nao prova.
    generated_at: '0000-00-00',
    source: TYPES_PATH_PADRAO + ' (Database["public"])',
    how_to_regenerate: 'scripts/db-audit/catalog.sql (modo forte, exige DESTINO_URL)',
    tables: ordenado(saida.tables),
    views: ordenado(saida.views),
    functions: ordenado(saida.functions),
    enums: ordenado(saida.enums),
    // O types.ts nao distingue trigger function nem carrega assinatura: as duas
    // secoes existem vazias so para a forma casar com a de catalog.sql.
    function_signatures: [],
    trigger_functions: [],
  };
}

/** Le o types.ts do disco. Lanca com mensagem acionavel quando ausente. */
export function carregarCatalogoDeTypes(caminho = TYPES_PATH_PADRAO) {
  let texto;
  try {
    texto = fs.readFileSync(caminho, 'utf8');
  } catch (erro) {
    throw new Error(
      'types.ts ausente ou ilegivel (' + caminho + '): ' + erro.message
      + ' — sem ele e sem supabase/schema-catalog.json nao ha fonte de schema offline.',
    );
  }
  const catalogo = catalogoDeTypes(texto);
  if (catalogo.tables.length === 0) {
    throw new Error(
      'nenhuma tabela reconhecida em ' + caminho
      + ' — o formato do types.ts mudou; ajuste scripts/db-audit/catalog-from-types.mjs',
    );
  }
  return catalogo;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const catalogo = carregarCatalogoDeTypes(process.argv[2] || TYPES_PATH_PADRAO);
    console.log(JSON.stringify(catalogo, null, 2));
  } catch (erro) {
    console.error('ERRO: ' + erro.message);
    process.exit(2);
  }
}
