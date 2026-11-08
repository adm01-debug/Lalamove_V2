import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

import {
  TAMANHO_MINIMO,
  arquivosDeTexto,
  arquivosZip,
  contarRestantes,
  crc32,
  escreverZip,
  extensaoDe,
  formasDoSegredo,
  lerZip,
  normalizarSegredos,
  redigirBytes,
  redigirConteudo,
  redigirDiretorio,
  redigirTextoComZipEmbutido,
  redigirZip,
} from './redigir-relatorio.mjs';

const SCRIPT = fileURLToPath(new URL('./redigir-relatorio.mjs', import.meta.url));
const SEGREDO = 'senha-de-teste-123';

/** ZIP mínimo stored/deflate, do jeito que `lerZip` espera. */
function zipDe(nome, conteudo) {
  const dados = Buffer.from(conteudo);
  const comprimido = deflateRawSync(dados);
  const nomeBuf = Buffer.from(nome);
  return escreverZip([
    {
      nome: nomeBuf,
      flags: 0,
      metodo: 8,
      hora: 0,
      data: 0,
      crc: crc32(dados),
      tamanho: dados.length,
      versaoFeita: 20,
      atributosInternos: 0,
      atributosExternos: 0,
      comprimido,
      conteudo: () => dados,
    },
  ]);
}

test('segredo curto demais não é redigido — substituir 1-4 chars corromperia o relatório', () => {
  assert.deepEqual(normalizarSegredos(['abcd', '', null, 'abcde']), ['abcde']);
  assert.equal(TAMANHO_MINIMO, 5);
});

test('redige texto solto e conta as ocorrências', () => {
  const r = redigirConteudo(`login ${SEGREDO} e de novo ${SEGREDO}`, [SEGREDO]);
  assert.equal(r.ocorrencias, 2);
  assert.ok(!r.texto.includes(SEGREDO));
  assert.match(r.texto, /\[redigido\]/);
});

test('cobre as formas escapadas (JSON e HTML) do segredo', () => {
  const comAspas = 'a"b&c';
  assert.deepEqual(formasDoSegredo(comAspas).sort(), ['a\\"b&c', 'a"b&c', 'a&quot;b&amp;c'].sort());
  const buf = Buffer.from(`{"senha":"${'x'.repeat(0)}a\\"b&c"} e <i>a&quot;b&amp;c</i>`);
  const r = redigirBytes(buf, [comAspas]);
  assert.equal(r.ocorrencias, 2);
});

test('redige dentro de ZIP solto e mantém o ZIP legível', () => {
  const zip = zipDe('trace.json', `{"titulo":"Fill ${SEGREDO}"}`);
  const r = redigirZip(zip, [SEGREDO]);
  assert.equal(r.ocorrencias, 1);
  const entradas = lerZip(r.buffer);
  assert.equal(entradas.length, 1);
  assert.ok(!entradas[0].conteudo().toString().includes(SEGREDO));
});

test('redige ZIP em base64 embutido no index.html', () => {
  const zip = zipDe('report.json', `senha=${SEGREDO}`);
  const html = `<script>window.x="data:application/zip;base64,${zip.toString('base64')}"</script>`;
  const r = redigirTextoComZipEmbutido(html, [SEGREDO]);
  assert.ok(r.ocorrencias >= 1);
  assert.equal(contarRestantes, contarRestantes); // sanidade de import
  assert.ok(!r.texto.includes(zip.toString('base64')), 'o base64 tem de ser regravado');
});

test('ZIP que não dá para regravar com segurança LANÇA (falha fechada)', () => {
  assert.throws(() => lerZip(Buffer.from('nao e zip')), /end of central directory/);
});

test('arquivosDeTexto ignora binário; arquivosZip só pega .zip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relatorio-'));
  mkdirSync(join(dir, 'data'));
  writeFileSync(join(dir, 'index.html'), 'x');
  writeFileSync(join(dir, 'tela.png'), 'x');
  writeFileSync(join(dir, 'data', 'trace.zip'), zipDe('a.json', 'x'));
  assert.deepEqual(arquivosDeTexto(dir), [join(dir, 'index.html')]);
  assert.deepEqual(arquivosZip(dir), [join(dir, 'data', 'trace.zip')]);
  assert.equal(extensaoDe('a/b.PNG'), '.png');
});

test('redigirDiretorio limpa texto e zip, e contarRestantes volta a zero', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relatorio-'));
  mkdirSync(join(dir, 'data'));
  writeFileSync(join(dir, 'error-context.md'), `campo senha: ${SEGREDO}`);
  writeFileSync(join(dir, 'data', 'trace.zip'), zipDe('t.json', `Fill "${SEGREDO}"`));
  const r = redigirDiretorio(dir, [SEGREDO]);
  assert.equal(r.arquivosTocados, 2);
  assert.ok(r.ocorrencias >= 2);
  assert.equal(contarRestantes(dir, [SEGREDO]), 0);
  assert.ok(!readFileSync(join(dir, 'error-context.md'), 'utf8').includes(SEGREDO));
});

test('CLI: o valor do segredo vem do env, nunca do argv, e a saída não ecoa o valor', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relatorio-'));
  writeFileSync(join(dir, 'index.html'), `senha ${SEGREDO}`);
  const r = spawnSync(process.execPath, [SCRIPT, dir, '--segredo-env=E2E_SENHA'], {
    encoding: 'utf8',
    env: { ...process.env, E2E_SENHA: SEGREDO },
  });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /redigido: 1 ocorrencia\(s\) de 1 segredo\(s\)/);
  assert.match(r.stdout, /verificado: nenhuma ocorrencia restante/);
  assert.ok(!r.stdout.includes(SEGREDO), 'a saída não pode ecoar o valor do segredo');
  assert.ok(!readFileSync(join(dir, 'index.html'), 'utf8').includes(SEGREDO));
});

test('CLI: env vazio ou curto é ignorado com aviso (não derruba o E2E)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relatorio-'));
  writeFileSync(join(dir, 'index.html'), 'nada');
  const r = spawnSync(process.execPath, [SCRIPT, dir, '--segredo-env=VAZIO', '--segredo-env=CURTO'], {
    encoding: 'utf8',
    env: { ...process.env, VAZIO: '', CURTO: 'abc' },
  });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /VAZIO \(vazio\)/);
  assert.match(r.stdout, /CURTO \(curto demais\)/);
  assert.match(r.stdout, /nenhum segredo utilizavel/);
});

test('CLI: sem diretório ou sem --segredo-env sai 2 com o uso', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /uso: redigir-relatorio\.mjs <dir> --segredo-env=NOME/);
});

test('CLI: diretório inexistente sai 0 (artifact tem if-no-files-found: ignore)', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '/tmp/nao-existe-relatorio', '--segredo-env=E2E_SENHA'], {
    encoding: 'utf8',
    env: { ...process.env, E2E_SENHA: SEGREDO },
  });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /nao existe - nada a redigir/);
});
