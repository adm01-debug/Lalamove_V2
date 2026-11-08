#!/usr/bin/env node
/**
 * Quarentena formal da suíte E2E. Portado do Zapp Web V2.
 *
 * Uma quarentena sem prazo é um `skip` com outro nome: ninguém revisa, o motivo se
 * perde e o teste nunca volta. Este verificador existe para a quarentena ter FIM —
 * ele lê `e2e/quarantine.js` e falha quando um item passa do prazo.
 *
 * CUMPRE DOIS PAPÉIS, e os dois importam:
 *  1. validar a FORMA dos itens (spec existente, motivo, issue, prazo válido). Item sem
 *     motivo e sem issue não entra: é o que separa quarentena de esconderijo;
 *  2. cobrar o PRAZO. Item vencido derruba o CI — sem isso, "quarentena" vira o lugar
 *     onde o teste quebrado vai morrer.
 *
 * Adaptação ao Lalamove V2: o `testMatch` do `playwright.config.ts` é `**\/*.e2e.ts` e o
 * `testDir` é `./e2e`, então o spec declarado tem de ser um arquivo `e2e/*.e2e.ts` —
 * caminho fora disso nunca seria ignorado pelo Playwright e daria falsa sensação de
 * quarentena.
 *
 * Formato de `e2e/quarantine.js` (ESM):
 *   export const quarentena = [
 *     { spec: 'e2e/mfa.e2e.ts', motivo: '...', issue: 123, prazo: '2026-12-01' },
 *   ];
 *
 * Para a quarentena ter efeito, o `playwright.config.ts` precisa ignorar esses specs
 * (`testIgnore: specsEmQuarentena(quarentena)`). Hoje o config do repo NÃO faz isso —
 * ver scripts/ci/README.md.
 *
 * Uso: node scripts/ci/check-quarantine.mjs [--hoje=AAAA-MM-DD]
 * O `--hoje` existe para o teste fixar a data; o CI roda sem ele.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = join(AQUI, '../..');
export const CAMINHO_PADRAO = 'e2e/quarantine.js';

const CAMPOS_OBRIGATORIOS = ['spec', 'motivo', 'issue', 'prazo'];
const FORMATO_DE_DATA = /^\d{4}-\d{2}-\d{2}$/u;
/** Mesmo recorte de `playwright.config.ts`: testDir `./e2e`, testMatch `**\/*.e2e.ts`. */
const FORMATO_DE_SPEC = /^e2e\/[A-Za-z0-9._/-]+\.e2e\.ts$/u;

/** Data de hoje em ISO, sem depender de fuso do ambiente. */
export function hojeISO(agora = new Date()) {
  return agora.toISOString().slice(0, 10);
}

export async function carregarQuarentena(raiz = RAIZ, caminho = CAMINHO_PADRAO) {
  const arquivo = join(raiz, caminho);
  if (!existsSync(arquivo)) {
    // Arquivo ausente não é erro: o projeto pode não ter quarentena nenhuma. Mas o
    // verificador continua rodando, para o dia em que o arquivo existir.
    return { itens: [], avisos: [`${caminho} não existe — nada em quarentena`] };
  }
  const mod = await import(`file://${arquivo}`);
  const itens = Array.isArray(mod.quarentena) ? mod.quarentena : [];
  return { itens, avisos: [] };
}

/** Valida a forma e cobra o prazo. Devolve a lista de problemas (vazia = tudo certo). */
export function validar(itens, { raiz = RAIZ, hoje = hojeISO() } = {}) {
  const problemas = [];
  for (const item of itens) {
    const faltando = CAMPOS_OBRIGATORIOS.filter((c) => item?.[c] === undefined || item?.[c] === '');
    if (faltando.length > 0) {
      problemas.push(`item sem ${faltando.join(', ')} (spec=${item?.spec ?? '??'})`);
      continue;
    }
    if (!FORMATO_DE_DATA.test(String(item.prazo))) {
      problemas.push(`${item.spec}: prazo "${item.prazo}" não está em AAAA-MM-DD`);
      continue;
    }
    if (!FORMATO_DE_SPEC.test(String(item.spec))) {
      problemas.push(
        `${item.spec}: fora do recorte do playwright.config.ts (e2e/<nome>.e2e.ts) — ` +
          'um caminho assim nunca seria ignorado pelo Playwright',
      );
      continue;
    }
    if (!existsSync(join(raiz, item.spec))) {
      problemas.push(`${item.spec}: spec em quarentena não existe no repositório`);
    }
    if (String(item.prazo) < hoje) {
      problemas.push(
        `${item.spec}: prazo vencido em ${item.prazo} (hoje ${hoje}) — ` +
          `consertar e tirar da quarentena, ou renovar o prazo com motivo novo (issue #${item.issue})`,
      );
    }
  }
  return problemas;
}

/** Specs que o `playwright.config.ts` deve ignorar (`testIgnore`). */
export function specsEmQuarentena(itens) {
  return itens
    .map((i) => i?.spec)
    .filter((s) => typeof s === 'string' && s.length > 0)
    .sort();
}

async function principal(argv) {
  const hoje = argv.find((a) => a.startsWith('--hoje='))?.slice('--hoje='.length) ?? hojeISO();
  const { itens, avisos } = await carregarQuarentena();
  for (const aviso of avisos) console.log(`aviso: ${aviso}`);
  const problemas = validar(itens, { hoje });
  if (problemas.length > 0) {
    console.error(`check-quarantine: FALHOU — ${problemas.length} problema(s) na quarentena:`);
    for (const p of problemas) console.error(` - ${p}`);
    return 1;
  }
  console.log(`check-quarantine: OK — ${itens.length} spec(s) em quarentena, nenhum vencido.`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await principal(process.argv.slice(2)));
}
