#!/usr/bin/env node
/**
 * Paridade de chaves entre os locales do i18n.
 *
 * O i18next resolve chave ausente por `fallbackLng: 'pt-BR'` (src/i18n/index.ts). Isso
 * esconde o problema: a tela em espanhol continua "funcionando" porque mostra português.
 * O efeito real é um idioma oficialmente suportado (`supportedLanguages`) servindo texto
 * em outro idioma — que é exatamente o que a etapa 82 do plano Google Maps precisa evitar
 * quando adiciona aria-label traduzido nos componentes de mapa.
 *
 * Verifica:
 *  1. mesmo CONJUNTO de chaves nos três locales (nada faltando, nada sobrando);
 *  2. nenhum valor vazio (chave presente mas sem texto é pior que chave ausente: o
 *     leitor de tela anuncia um controle sem nome);
 *  3. mesmos placeholders `{{x}}` em cada chave (trocar `{{n}}` por `{{count}}` numa
 *     língua faz a interpolação imprimir o literal).
 *
 * Uso: node scripts/ci/check-i18n-parity.mjs [--raiz <dir>]
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = join(AQUI, '../..');
export const DIR_LOCALES = 'src/i18n/locales';
export const IDIOMA_REFERENCIA = 'pt-BR';

const LOCALES = ['pt-BR', 'en', 'es'];
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/gu;

/** Achata `{a:{b:'x'}}` em `Map { 'a.b' => 'x' }`. Arrays são chaves indexadas. */
export function achatar(obj, prefixo = '', saida = new Map()) {
  for (const [chave, valor] of Object.entries(obj ?? {})) {
    const caminho = prefixo ? `${prefixo}.${chave}` : chave;
    if (valor !== null && typeof valor === 'object' && !Array.isArray(valor)) {
      achatar(valor, caminho, saida);
    } else {
      saida.set(caminho, valor);
    }
  }
  return saida;
}

export function placeholders(texto) {
  if (typeof texto !== 'string') return new Set();
  const achados = new Set();
  for (const m of texto.matchAll(PLACEHOLDER)) achados.add(m[1]);
  return new Set([...achados].sort());
}

const mesmoConjunto = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/**
 * `locales` = `{ 'pt-BR': Map, en: Map, es: Map }`. Referência = `IDIOMA_REFERENCIA`.
 * Devolve a lista de problemas já em texto legível (vazio = tudo em ordem).
 */
export function comparar(locales, referencia = IDIOMA_REFERENCIA) {
  const problemas = [];
  const base = locales[referencia];
  if (!base) return [`locale de referência ausente: ${referencia}`];
  if (base.size === 0) problemas.push(`${referencia} está vazio`);

  for (const [idioma, chaves] of Object.entries(locales)) {
    if (idioma === referencia) continue;
    const faltando = [...base.keys()].filter((k) => !chaves.has(k)).sort();
    const sobrando = [...chaves.keys()].filter((k) => !base.has(k)).sort();
    if (faltando.length) {
      problemas.push(`${idioma}: ${faltando.length} chave(s) faltando — ${faltando.slice(0, 12).join(', ')}${faltando.length > 12 ? ', …' : ''}`);
    }
    if (sobrando.length) {
      problemas.push(`${idioma}: ${sobrando.length} chave(s) sobrando (não existem em ${referencia}) — ${sobrando.slice(0, 12).join(', ')}${sobrando.length > 12 ? ', …' : ''}`);
    }
  }

  for (const [idioma, chaves] of Object.entries(locales)) {
    for (const [chave, valor] of chaves) {
      if (typeof valor === 'string' && valor.trim() === '') {
        problemas.push(`${idioma}: "${chave}" está vazio`);
        continue;
      }
      if (idioma === referencia || !base.has(chave)) continue;
      const esperado = placeholders(base.get(chave));
      const atual = placeholders(valor);
      if (!mesmoConjunto(esperado, atual)) {
        problemas.push(`${idioma}: "${chave}" usa placeholders diferentes de ${referencia} (${[...esperado].join(', ') || 'nenhum'} vs ${[...atual].join(', ') || 'nenhum'})`);
      }
    }
  }

  return problemas;
}

export function carregarLocales(raiz = RAIZ) {
  const locales = {};
  for (const idioma of LOCALES) {
    const arquivo = join(raiz, DIR_LOCALES, `${idioma}.json`);
    locales[idioma] = achatar(JSON.parse(readFileSync(arquivo, 'utf8')));
  }
  return locales;
}

function main(argv) {
  let raiz = RAIZ;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--raiz' || arg === '--root') {
      const valor = argv[i + 1];
      if (!valor) throw new Error(`Valor ausente para ${arg}.`);
      raiz = valor;
      i += 1;
    } else if (arg === '--help') {
      console.log('Uso: node scripts/ci/check-i18n-parity.mjs [--raiz <dir>]');
      return 0;
    } else {
      throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }

  const locales = carregarLocales(raiz);
  const problemas = comparar(locales);
  if (problemas.length) {
    console.error(`i18n: ${problemas.length} problema(s) de paridade entre locales`);
    for (const p of problemas) console.error(`  - ${p}`);
    return 1;
  }
  const total = locales[IDIOMA_REFERENCIA]?.size ?? 0;
  console.log(`i18n: ${LOCALES.length} locales em paridade (${total} chaves cada)`);
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main(process.argv);
}
