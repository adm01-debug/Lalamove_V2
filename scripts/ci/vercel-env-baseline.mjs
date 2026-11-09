#!/usr/bin/env node
// Valida a lista de variaveis de ambiente REAIS de um target da Vercel contra o
// baseline de politica em `vercel-env-baseline.json` (portado do Zapp_Web_V2; as
// listas foram refeitas a partir deste repositorio — ver `_meta` do JSON).
//
// Regra que ele trava (AGENTS.md > Serviços > Deploy): "Nunca segredo de servidor
// no Vercel; VITE_* e publico". Segredo de Edge Function (LALAMOVE_API_SECRET,
// SUPABASE_SERVICE_ROLE_KEY, MAPBOX_ACCESS_TOKEN...) no projeto Vercel = violacao;
// faltar VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY = app nao sobe.
//
// Projeto: lalamove-v2 (team juca1). A lista real vem de fora — este script NAO
// toca a rede nem le segredo nenhum, so nomes:
//   vercel --scope juca1 env ls lalamove-v2            # nomes, nao valores
//   echo '["VITE_SUPABASE_URL","..."]' | node scripts/ci/vercel-env-baseline.mjs --stdin --target=production
//      node scripts/ci/vercel-env-baseline.mjs --target=production --vars-file=vars.json
//      node scripts/ci/vercel-env-baseline.mjs --target=production   # self-test do JSON

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export const BASELINE_PATH = fileURLToPath(new URL('./vercel-env-baseline.json', import.meta.url));

export function loadBaseline(path = BASELINE_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function checkVars(baseline, target, actualVars) {
  const tc = baseline[target];
  if (!tc) throw new Error(`Target "${target}" não encontrado no baseline.`);
  const actual = new Set(actualVars);
  const errors = [];
  for (const k of (tc.required || [])) {
    if (!actual.has(k)) errors.push(`FALTANDO obrigatória: ${k}`);
  }
  for (const k of (tc.forbidden || [])) {
    if (actual.has(k)) errors.push(`PROIBIDA presente: ${k}`);
  }
  for (const k of (tc.forbidden_nonvite || [])) {
    if (actual.has(k)) errors.push(`PROIBIDA (segurança) presente: ${k}`);
  }
  return errors;
}

// Bloco CLI: só executa quando chamado diretamente.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = Object.fromEntries(
    process.argv.slice(2)
      .filter(a => a.startsWith('--'))
      .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
  );

  const target = args.target || 'production';
  const baseline = loadBaseline();

  let vars = null;
  if (args['vars-file']) {
    vars = JSON.parse(readFileSync(args['vars-file'], 'utf8'));
  } else if (args.stdin) {
    // `--stdin` EXPLICITO. No Zapp a leitura era automatica quando stdin nao era TTY,
    // mas em runner/agente sem TTY e sem pipe (CI, subprocesso) o stdin fica aberto e
    // o script travava para sempre em vez de rodar o self-test. Agora quem manda pipe
    // declara: `... | node scripts/ci/vercel-env-baseline.mjs --stdin --target=production`.
    const lines = [];
    const rl = createInterface({ input: process.stdin });
    for await (const line of rl) lines.push(line);
    const raw = lines.join('').trim();
    if (raw) vars = JSON.parse(raw);
  }

  if (vars === null) {
    // Modo self-test: apenas valida que o JSON está íntegro.
    const targets = Object.keys(baseline).filter(k => !k.startsWith('_'));
    console.log('✅  Baseline JSON parseado com sucesso.');
    console.log(`    Targets: ${targets.join(', ')}`);
    const tc = baseline[target] || {};
    const forbiddenCount = (tc.forbidden || []).length + (tc.forbidden_nonvite || []).length;
    console.log(`    Target "${target}" — required: ${(tc.required || []).length} | forbidden: ${forbiddenCount}`);
    process.exit(0);
  }

  const errors = checkVars(baseline, target, vars);
  errors.forEach(e => console.error(`❌  ${e}`));
  if (!errors.length) {
    console.log(`✅  Baseline OK para target="${target}" (${vars.length} vars verificadas).`);
  }
  process.exit(errors.length > 0 ? 1 : 0);
}
