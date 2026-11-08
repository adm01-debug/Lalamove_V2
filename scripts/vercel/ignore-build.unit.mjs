/**
 * Testes do `ignore-build.sh`.
 *
 * Cada caso roda contra um repositorio git DESCARTAVEL criado em
 * `os.tmpdir()` — nada toca o repositorio deste projeto. A config global do
 * git e neutralizada (GIT_CONFIG_GLOBAL=/dev/null + identidade via -c) para o
 * teste nao depender da maquina.
 *
 * Portado do Zapp Web V2 (scripts/vercel/ignore-build.unit.mjs) e reescrito em
 * `node:test` — o original imprimia o proprio placar, o que ficava de fora de
 * `node --test scripts/vercel/*.unit.mjs`. Casos novos: package-lock.json (npm,
 * nao bun) e vercel.json.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./ignore-build.sh', import.meta.url));

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'teste',
  GIT_AUTHOR_EMAIL: 'teste@example.invalid',
  GIT_COMMITTER_NAME: 'teste',
  GIT_COMMITTER_EMAIL: 'teste@example.invalid',
};

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, env: { ...process.env, ...GIT_ENV }, encoding: 'utf8' });

/** Repo descartavel: commit 1 = README, commit 2 = CHANGELOG (ambos nao-front). */
function repoFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ignore-build-'));
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(path.join(dir, 'README.md'), 'init\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  writeFileSync(path.join(dir, 'CHANGELOG.md'), 'docs\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'docs');
  const base = git(dir, 'rev-parse', 'HEAD~1').trim();
  return { dir, base };
}

function commitar(dir, arquivo, conteudo) {
  const alvo = path.join(dir, arquivo);
  mkdirSync(path.dirname(alvo), { recursive: true });
  writeFileSync(alvo, conteudo);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', `muda ${arquivo}`);
}

function rodar({ cwd, env = {} }) {
  try {
    execFileSync('sh', [SCRIPT], {
      cwd,
      env: { ...process.env, ...GIT_ENV, VERCEL_GIT_PREVIOUS_SHA: '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return 0;
  } catch (e) {
    return e.status ?? 1;
  }
}

test('producao sempre builda', () => {
  const { dir } = repoFixture();
  try {
    assert.equal(rodar({ cwd: dir, env: { VERCEL_ENV: 'production' } }), 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sem base e fora de repo git: fail-open (builda)', () => {
  const vazio = mkdtempSync(path.join(tmpdir(), 'ignore-build-vazio-'));
  try {
    assert.equal(rodar({ cwd: vazio, env: { VERCEL_ENV: 'preview' } }), 1);
  } finally {
    rmSync(vazio, { recursive: true, force: true });
  }
});

test('somente arquivo nao-front muda: pula o build', () => {
  const { dir, base } = repoFixture();
  try {
    assert.equal(
      rodar({ cwd: dir, env: { VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: base } }),
      0,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('base invalida: fail-open (builda)', () => {
  const { dir } = repoFixture();
  try {
    assert.equal(
      rodar({ cwd: dir, env: { VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: 'deadbeef' } }),
      1,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const [rotulo, arquivo, conteudo] of [
  ['src/', 'src/main.tsx', 'export {};\n'],
  ['package-lock.json', 'package-lock.json', '{"lockfileVersion":3}\n'],
  ['vercel.json', 'vercel.json', '{"headers":[]}\n'],
  ['.env.production', '.env.production', 'VITE_X=1\n'],
  ['index.html', 'index.html', '<html></html>\n'],
]) {
  test(`${rotulo} muda: builda`, () => {
    const { dir, base } = repoFixture();
    try {
      commitar(dir, arquivo, conteudo);
      assert.equal(
        rodar({ cwd: dir, env: { VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: base } }),
        1,
        `${arquivo} deveria disparar build`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('mudanca em docs/ depois do base continua pulando', () => {
  const { dir, base } = repoFixture();
  try {
    commitar(dir, 'docs/nota.md', 'texto\n');
    assert.equal(
      rodar({ cwd: dir, env: { VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: base } }),
      0,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
