import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PREFIXO,
  corpoDe,
  eLoginFalhou,
  marcadorDe,
  nomesDeTestResults,
  tituloDe,
} from './marcador-specs.mjs';

const SCRIPT = fileURLToPath(new URL('./marcador-specs.mjs', import.meta.url));

test('mesma causa (ordem e repetição diferentes) gera o mesmo marcador', () => {
  const a = marcadorDe(['rbac.e2e.ts-admin-ve-tudo', 'mfa.e2e.ts-exige-codigo']);
  const b = marcadorDe(['mfa.e2e.ts-exige-codigo', 'rbac.e2e.ts-admin-ve-tudo', 'mfa.e2e.ts-exige-codigo']);
  assert.equal(a, b);
  assert.match(a, new RegExp(`^${PREFIXO.replace(/[-[\]{}()*+?.\\^$|]/g, '\\$&')}[0-9a-f]{16} -->$`));
});

test('causa diferente gera marcador diferente', () => {
  assert.notEqual(marcadorDe(['a']), marcadorDe(['b']));
});

test('conjunto vazio tem marcador próprio — não se confunde com alerta anterior', () => {
  const vazio = marcadorDe([]);
  assert.equal(vazio, marcadorDe(undefined));
  assert.notEqual(vazio, marcadorDe(['a']));
});

test('entrada que não é string conta como ausente, não como causa nova', () => {
  assert.equal(marcadorDe([null, undefined, 42, '']), marcadorDe([]));
});

test('corpo lista os nomes crus; sem test-results explica que o erro foi antes do Playwright', () => {
  const corpo = corpoDe(['rbac.e2e.ts-admin', 'mfa.e2e.ts-codigo']);
  assert.match(corpo, /\*\*2\*\* teste\(s\) quebrado\(s\)/);
  assert.match(corpo, /- `mfa\.e2e\.ts-codigo`/);
  assert.match(corpoDe([]), /sem deixar `test-results\/`/);
});

test('falha só no caminho de login muda o título; spec quebrado não', () => {
  assert.ok(eLoginFalhou(['login-lockout.e2e.ts-bloqueia', 'rbac.e2e.ts-auth-redirect']));
  assert.ok(!eLoginFalhou(['rbac.e2e.ts-admin', 'login-lockout.e2e.ts-bloqueia']));
  assert.equal(tituloDe(['login-lockout.e2e.ts-bloqueia']), '[e2e] login E2E falhou');
  assert.equal(tituloDe(['rbac.e2e.ts-admin']), '[e2e] suíte E2E quebrada na main');
  assert.ok(!eLoginFalhou([]));
});

test('lê só diretórios de test-results, ordenados; diretório ausente devolve lista vazia', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-results-'));
  mkdirSync(join(dir, 'rbac-b'));
  mkdirSync(join(dir, 'mfa-a'));
  writeFileSync(join(dir, 'solto.txt'), 'x');
  assert.deepEqual(nomesDeTestResults(dir), ['mfa-a', 'rbac-b']);
  assert.deepEqual(nomesDeTestResults(join(dir, 'nao-existe')), []);
});

test('CLI imprime título, marcador e corpo do diretório dado', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-results-'));
  mkdirSync(join(dir, 'rbac.e2e.ts-admin-ve-tudo'));
  const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^\[e2e\] suíte E2E quebrada na main\n<!-- e2e-specs:[0-9a-f]{16} -->/);
  assert.match(r.stdout, /- `rbac\.e2e\.ts-admin-ve-tudo`/);
});
