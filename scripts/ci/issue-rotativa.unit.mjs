import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIMITE_COMENTARIOS,
  abrirOuRotacionar,
  contarComentarios,
  encontrarIssue,
  fecharSeAberta,
} from './issue-rotativa.mjs';

const OWNER = 'adm01-debug';
const REPO = 'Lalamove_V2';
const LABEL = 'kpi-actions';
const TITULO = '[kpi-actions] Semana de 2026-11-08';

/**
 * `gh` falso: registra toda chamada e responde conforme `estado`.
 * Nenhum teste aqui toca a rede — é o ponto da biblioteca receber `gh` injetado.
 */
function ghFalso({ issues = [], comentarios = [], novaIssue = 99 } = {}) {
  const chamadas = [];
  const gh = async (method, path, body) => {
    chamadas.push({ method, path, body });
    if (method === 'GET' && /\/issues\?labels=/.test(path)) return issues;
    if (method === 'GET' && /\/comments\?per_page=100&page=(\d+)$/.test(path)) {
      const page = Number(/page=(\d+)$/.exec(path)[1]);
      return comentarios[page - 1] ?? [];
    }
    if (method === 'POST' && /\/issues$/.test(path)) return { number: novaIssue };
    return {};
  };
  return { gh, chamadas };
}

test('issue inexistente é criada com label', async () => {
  const { gh, chamadas } = ghFalso({ issues: [] });
  assert.equal(await abrirOuRotacionar({ gh, owner: OWNER, repo: REPO, label: LABEL, title: TITULO, body: 'corpo' }), 99);
  assert.ok(chamadas.some((c) => c.method === 'POST' && c.path.endsWith('/labels')));
  const criacao = chamadas.find((c) => c.method === 'POST' && c.path.endsWith('/issues'));
  assert.deepEqual(criacao.body, { title: TITULO, body: 'corpo', labels: [LABEL] });
});

test('issue existente abaixo do limite só recebe comentário', async () => {
  const { gh, chamadas } = ghFalso({
    issues: [{ number: 7, title: TITULO }],
    comentarios: [new Array(LIMITE_COMENTARIOS).fill({})],
  });
  assert.equal(await abrirOuRotacionar({ gh, owner: OWNER, repo: REPO, label: LABEL, title: TITULO, body: 'corpo' }), 7);
  assert.ok(chamadas.some((c) => c.method === 'POST' && c.path === `/repos/${OWNER}/${REPO}/issues/7/comments`));
  assert.ok(!chamadas.some((c) => c.method === 'PATCH'), 'não deve fechar antes do limite');
});

test(`acima de ${LIMITE_COMENTARIOS} comentários a issue é fechada e uma nova abre com link`, async () => {
  const { gh, chamadas } = ghFalso({
    issues: [{ number: 7, title: TITULO }],
    comentarios: [new Array(LIMITE_COMENTARIOS + 1).fill({})],
    novaIssue: 8,
  });
  assert.equal(await abrirOuRotacionar({ gh, owner: OWNER, repo: REPO, label: LABEL, title: TITULO, body: 'corpo' }), 8);
  const fechamento = chamadas.find((c) => c.method === 'PATCH');
  assert.deepEqual(fechamento.body, { state: 'closed', state_reason: 'completed' });
  const nova = chamadas.find((c) => c.method === 'POST' && c.path.endsWith('/issues'));
  assert.match(nova.body.body, /Continuação de #7 \(fechada por atingir 21 comentários\)/);
});

test('contagem de comentários pagina além da primeira página', async () => {
  const { gh } = ghFalso({ comentarios: [new Array(100).fill({}), new Array(5).fill({})] });
  assert.equal(await contarComentarios(gh, OWNER, REPO, 7), 105);
});

test('encontrarIssue casa pelo título exato', async () => {
  const { gh } = ghFalso({ issues: [{ number: 1, title: 'outra' }, { number: 2, title: TITULO }] });
  assert.equal((await encontrarIssue(gh, OWNER, REPO, LABEL, TITULO)).number, 2);
  assert.equal(await encontrarIssue(gh, OWNER, REPO, LABEL, 'inexistente'), null);
});

test('fecharSeAberta não faz nada quando não há issue aberta', async () => {
  const { gh, chamadas } = ghFalso({ issues: [] });
  await fecharSeAberta(gh, OWNER, REPO, LABEL, TITULO);
  assert.equal(chamadas.filter((c) => c.method !== 'GET').length, 0);
});

test('fecharSeAberta comenta e fecha a issue existente', async () => {
  const { gh, chamadas } = ghFalso({ issues: [{ number: 7, title: TITULO }] });
  await fecharSeAberta(gh, OWNER, REPO, LABEL, TITULO, 'voltou ao normal');
  assert.equal(chamadas.find((c) => c.method === 'POST').body.body, 'voltou ao normal');
  assert.equal(chamadas.find((c) => c.method === 'PATCH').body.state, 'closed');
});
