#!/usr/bin/env node
/**
 * Política de rotação de issue de alerta. Portado do Zapp Web V2 (lá W91/E51).
 *
 * Issue de bot acumula comentários sem valor e fica ilegível depois de ~20. Esta
 * biblioteca implementa a rotação: ao atingir o limite, fecha a issue com um
 * comentário-resumo e abre uma nova com link para a anterior.
 *
 * É BIBLIOTECA, não CLI: nada aqui fala com a rede por conta própria. Quem chama injeta
 * `gh(method, path, body?)` — a função que faz a chamada à API do GitHub. Isso é o que
 * permite testar rotação, criação e fechamento sem token e sem tocar em issue de verdade.
 *
 * Uso:
 *   import { abrirOuRotacionar } from './issue-rotativa.mjs';
 *   const num = await abrirOuRotacionar({ gh, owner, repo, label, title, body });
 *
 * Consumidor neste repo: `scripts/ci/actions-kpi.mjs --publicar`.
 */

export const LIMITE_COMENTARIOS = 20;

/** Conta os comentários de uma issue via paginação (max 100/página). Total real, não a 1ª página. */
export async function contarComentarios(gh, owner, repo, issueNumber) {
  let total = 0;
  let page = 1;
  for (;;) {
    const lista = await gh('GET', `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(lista) || lista.length === 0) break;
    total += lista.length;
    if (lista.length < 100) break;
    page += 1;
  }
  return total;
}

/** Encontra a primeira issue aberta com o título e label dados. */
export async function encontrarIssue(gh, owner, repo, label, title) {
  const lista = await gh(
    'GET',
    `/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(label)}&state=open&per_page=10`,
  );
  return Array.isArray(lista) ? (lista.find((i) => i.title === title) ?? null) : null;
}

/** Garante que o label existe (ignora 422 se já existir). */
async function garantirLabel(gh, owner, repo, label) {
  await gh('POST', `/repos/${owner}/${repo}/labels`, {
    name: label,
    color: 'e11d48',
    description: 'Issue de alerta de guarda automático',
  }).catch(() => {});
}

/**
 * Abre, atualiza ou rotaciona a issue de alerta.
 *  - não existe → cria;
 *  - existe com ≤ LIMITE_COMENTARIOS → adiciona comentário;
 *  - existe com > LIMITE_COMENTARIOS → fecha com resumo e abre nova com link.
 * Devolve o número da issue ativa.
 */
export async function abrirOuRotacionar({ gh, owner, repo, label, title, body }) {
  const existing = await encontrarIssue(gh, owner, repo, label, title);

  if (existing) {
    const total = await contarComentarios(gh, owner, repo, existing.number);

    if (total > LIMITE_COMENTARIOS) {
      await gh('POST', `/repos/${owner}/${repo}/issues/${existing.number}/comments`, {
        body: `⚠️ Esta issue atingiu ${total} comentários e está sendo rotacionada para manter legibilidade.\n\nÚltimo alerta antes do fechamento:\n\n---\n\n${body}`,
      });
      await gh('PATCH', `/repos/${owner}/${repo}/issues/${existing.number}`, {
        state: 'closed',
        state_reason: 'completed',
      });
      await garantirLabel(gh, owner, repo, label);
      const nova = await gh('POST', `/repos/${owner}/${repo}/issues`, {
        title,
        body: `Continuação de #${existing.number} (fechada por atingir ${total} comentários).\n\n---\n\n${body}`,
        labels: [label],
      });
      console.log(`Issue #${existing.number} rotacionada → #${nova.number}`);
      return nova.number;
    }

    await gh('POST', `/repos/${owner}/${repo}/issues/${existing.number}/comments`, { body });
    console.log(`Issue #${existing.number} atualizada com novo comentário.`);
    return existing.number;
  }

  await garantirLabel(gh, owner, repo, label);
  const nova = await gh('POST', `/repos/${owner}/${repo}/issues`, { title, body, labels: [label] });
  console.log(`Issue #${nova.number} aberta.`);
  return nova.number;
}

/** Fecha a issue de alerta se estiver aberta (sem regressão detectada). */
export async function fecharSeAberta(gh, owner, repo, label, title, mensagem) {
  const existing = await encontrarIssue(gh, owner, repo, label, title);
  if (!existing) return;
  await gh('POST', `/repos/${owner}/${repo}/issues/${existing.number}/comments`, {
    body: mensagem ?? '✅ Guarda verificado sem divergência — fechando automaticamente.',
  });
  await gh('PATCH', `/repos/${owner}/${repo}/issues/${existing.number}`, {
    state: 'closed',
    state_reason: 'completed',
  });
  console.log(`Issue #${existing.number} fechada.`);
}
