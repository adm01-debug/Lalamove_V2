/**
 * Proíbe comparação direta (`===`/`!==`) de identificadores que aludam a
 * credencial. Exige comparação em tempo constante.
 *
 * Pega: `token !== serviceRole`, `key === expected`, `assinatura !== secret`.
 * Não pega: literais e expressões sem nome legível.
 *
 * PORTADO do Zapp Web V2 (`scripts/eslint/no-secret-compare.js`). Única
 * adaptação: a mensagem apontava para `_shared/cron-secret-auth.ts`, que não
 * existe aqui. O equivalente real deste repo é `timingSafeEqual` em
 * `supabase/functions/lalamove-webhook/security.ts:8` (usado pela validação de
 * HMAC em `security.ts:38`).
 *
 * Como ligar (NÃO está ligado hoje): `eslint.config.js` começa com
 * `{ ignores: ["dist", "supabase/functions/**"] }`, e é justamente em
 * `supabase/functions/**` que vivem as comparações de segredo. Ligar exige um
 * bloco de override no flat config, por exemplo:
 *
 *   import noSecretCompare from "./scripts/eslint/no-secret-compare.js";
 *   // ...
 *   {
 *     files: ["supabase/functions/**\/*.ts"],
 *     plugins: { local: { rules: { "no-secret-compare": noSecretCompare } } },
 *     rules: { "local/no-secret-compare": "error" },
 *   }
 *
 * Esse bloco mexe no lint de todo o repo, então fica como passo a decidir pelo
 * dono — não foi aplicado nesta porta.
 */
const CREDENTIAL_RE = /secret|token|key|password|senha|segredo|assinatura|signature/i;

function nameOf(node) {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && node.property?.type === 'Identifier') return node.property.name;
  return null;
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Proíbe === / !== em variáveis de credencial; use timingSafeEqual.' },
    messages: {
      noSecretCompare: 'Comparação direta de credencial "{{name}}": use timingSafeEqual (supabase/functions/lalamove-webhook/security.ts).',
    },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator !== '===' && node.operator !== '!==') return;
        const leftName = nameOf(node.left);
        const rightName = nameOf(node.right);
        if (leftName && CREDENTIAL_RE.test(leftName)) {
          context.report({ node, messageId: 'noSecretCompare', data: { name: leftName } });
        } else if (rightName && CREDENTIAL_RE.test(rightName)) {
          context.report({ node, messageId: 'noSecretCompare', data: { name: rightName } });
        }
      },
    };
  },
};
