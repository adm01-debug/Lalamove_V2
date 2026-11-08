import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  avaliarWorkflow,
  credenciaisUsadas,
  guarda,
  semComentarios,
  uploads,
  usaCredencial,
} from './check-e2e-artifact-secrets.mjs';

const COM_CREDENCIAL_E_REPORT = `
name: exemplo
on: [push]
jobs:
  e2e:
    steps:
      - run: bun run test:e2e -- --project=setup
        env:
          E2E_TEST_EMAIL: \${{ secrets.E2E_TEST_EMAIL }}
          E2E_TEST_PASSWORD: \${{ secrets.E2E_TEST_PASSWORD }}
      - uses: actions/upload-artifact@aaa
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
`;

const CREDENCIAL_SO_EM_COMENTARIO = `
name: exemplo
# Removemos E2E_TEST_EMAIL/PASSWORD daqui justamente para poder ser pull_request.
on: [pull_request]
jobs:
  x:
    steps:
      - uses: actions/upload-artifact@aaa
        with:
          path: playwright-report/
`;

const REPORT_SEM_CREDENCIAL = `
name: exemplo
on: [pull_request]
jobs:
  x:
    steps:
      - run: bun run test:e2e
      - uses: actions/upload-artifact@aaa
        if: always()
        with:
          path: playwright-report/
`;

const CREDENCIAL_SEM_REPORT = `
name: exemplo
on: [push]
jobs:
  x:
    steps:
      - run: bun run test:e2e -- --project=setup
        env:
          E2E_TEST_PASSWORD: \${{ secrets.E2E_TEST_PASSWORD }}
`;

test('reprova: credencial + publicacao do report', () => {
  const v = avaliarWorkflow('com-cred.yml', COM_CREDENCIAL_E_REPORT);
  assert.equal(v.length, 1, 'deve acusar exatamente uma violacao');
  assert.match(v[0], /playwright-report/);
  assert.match(v[0], /linha \d+/);
});

test('aprova: credencial citada apenas em comentario', () => {
  assert.equal(usaCredencial(CREDENCIAL_SO_EM_COMENTARIO), false);
  assert.deepEqual(avaliarWorkflow('so-comentario.yml', CREDENCIAL_SO_EM_COMENTARIO), []);
});

test('aprova: report publicado por workflow sem credencial (o caso do ci.yml)', () => {
  assert.deepEqual(avaliarWorkflow('sem-cred.yml', REPORT_SEM_CREDENCIAL), []);
});

test('aprova: workflow com credencial que nao publica nada (o caso do e2e-logado.yml)', () => {
  assert.equal(usaCredencial(CREDENCIAL_SEM_REPORT), true);
  assert.deepEqual(avaliarWorkflow('cred-sem-artifact.yml', CREDENCIAL_SEM_REPORT), []);
});

test('comentario de prosa nao vira caminho nem credencial', () => {
  assert.equal(semComentarios('# E2E_TEST_EMAIL\n  x: 1 # playwright-report/').includes('E2E_TEST_EMAIL'), false);
  assert.deepEqual(uploads(CREDENCIAL_SO_EM_COMENTARIO).map((u) => u.caminho), ['playwright-report/']);
});

const COM_SESSAO_INJETADA_E_REPORT = `
name: exemplo
on: [push]
jobs:
  e2e:
    steps:
      - run: npx playwright test
        env:
          LOVABLE_BROWSER_SUPABASE_STORAGE_KEY: \${{ secrets.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY }}
          LOVABLE_BROWSER_SUPABASE_SESSION_JSON: \${{ secrets.LOVABLE_BROWSER_SUPABASE_SESSION_JSON }}
      - uses: actions/upload-artifact@aaa
        if: \${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
`;

test('reprova: sessao Supabase injetada (LOVABLE_BROWSER_*) + publicacao do report', () => {
  assert.equal(usaCredencial(COM_SESSAO_INJETADA_E_REPORT), true);
  const v = avaliarWorkflow('e2e-sessao.yml', COM_SESSAO_INJETADA_E_REPORT);
  assert.equal(v.length, 1, 'o JSON da sessao tem access_token/refresh_token');
  assert.match(v[0], /playwright-report/);
});

const COM_REDACAO_COMPLETA = COM_SESSAO_INJETADA_E_REPORT.replace(
  '      - uses: actions/upload-artifact@aaa\n        if: ${{ !cancelled() }}',
  [
    '      - name: redigir',
    '        id: redigir',
    '        run: node scripts/ci/redigir-relatorio.mjs playwright-report --segredo-env=LOVABLE_BROWSER_SUPABASE_STORAGE_KEY --segredo-env=LOVABLE_BROWSER_SUPABASE_SESSION_JSON',
    '      - uses: actions/upload-artifact@aaa',
    "        if: failure() && steps.redigir.outcome == 'success'",
  ].join('\n'),
);

test('aprova: report publicado DEPOIS de redigir as credenciais que o workflow usa', () => {
  assert.notEqual(COM_REDACAO_COMPLETA, COM_SESSAO_INJETADA_E_REPORT, 'o fixture precisa ter mudado');
  assert.deepEqual(avaliarWorkflow('redigido.yml', COM_REDACAO_COMPLETA), []);
});

test('credenciaisUsadas devolve so as que o workflow referencia', () => {
  assert.deepEqual(credenciaisUsadas(COM_SESSAO_INJETADA_E_REPORT).sort(), [
    'LOVABLE_BROWSER_SUPABASE_SESSION_JSON',
    'LOVABLE_BROWSER_SUPABASE_STORAGE_KEY',
  ]);
  assert.deepEqual(credenciaisUsadas(REPORT_SEM_CREDENCIAL), []);
});

test('reprova: redacao cobre so uma das credenciais usadas', () => {
  const soUma = COM_REDACAO_COMPLETA.replace(' --segredo-env=LOVABLE_BROWSER_SUPABASE_SESSION_JSON', '');
  const v = avaliarWorkflow('so-uma.yml', soUma);
  assert.equal(v.length, 1, 'sem cobrir as duas, a excecao nao vale');
  assert.match(v[0], /redigir-relatorio\.mjs/u);
});

test('reprova: redacao existe mas o upload nao depende dela', () => {
  const semGuarda = COM_REDACAO_COMPLETA.replace(
    "if: failure() && steps.redigir.outcome == 'success'",
    'if: failure()',
  );
  assert.equal(
    avaliarWorkflow('sem-guarda.yml', semGuarda).length,
    1,
    'se a redacao falhar, o upload publicaria o report cru',
  );
});

test('reprova: redator invocado DEPOIS do upload nao isenta', () => {
  const linhas = COM_REDACAO_COMPLETA.split('\n');
  const iRedator = linhas.findIndex((l) => l.includes('redigir-relatorio.mjs'));
  const iUpload = linhas.findIndex((l) => l.includes('upload-artifact'));
  const reordenado = [...linhas];
  const [passoNome, passoId, passoRun] = reordenado.splice(iRedator - 2, 3);
  reordenado.splice(iUpload, 0, passoNome, passoId, passoRun);
  assert.equal(avaliarWorkflow('depois.yml', reordenado.join('\n')).length, 1);
});

test('test-results e e2e/.auth tambem contam como caminho sensivel', () => {
  for (const caminho of ['test-results/', 'e2e/.auth/']) {
    const workflow = COM_SESSAO_INJETADA_E_REPORT.replace('path: playwright-report/', `path: ${caminho}`);
    assert.equal(avaliarWorkflow('x.yml', workflow).length, 1, caminho);
  }
});

test('o repositorio real esta em conformidade hoje', () => {
  // Caminho resolvido a partir do arquivo (e nao do cwd): o teste passa tanto por
  // `node --test scripts/ci/*.unit.mjs` na raiz quanto rodado dentro de scripts/ci.
  const workflows = fileURLToPath(new URL('../../.github/workflows', import.meta.url));
  assert.deepEqual(guarda(workflows), [],
    'se falhar, algum workflow passou a publicar o report junto das credenciais');
});
