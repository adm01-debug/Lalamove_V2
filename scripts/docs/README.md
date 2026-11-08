# scripts/docs — guarda da documentação e do Realtime

| Arquivo | O que faz | Comando |
|---|---|---|
| `verificar-docs-realtime.mjs` | Reprova quando a documentação envelheceu ou quando uma assinatura de Realtime aponta para tabela fora da publication | `node scripts/docs/verificar-docs-realtime.mjs` |

Não escreve nada. Exit 0 = ok, 1 = achados.

Confere:

1. todo `arquivo:linha` citado em `docs/**.md` existe e a linha citada existe no arquivo;
2. toda tabela assinada em `postgres_changes` no `src/` está na publication `supabase_realtime`, provado
   por **replay** das migrations de `supabase/migrations/` em ordem de nome (comentário de linha é
   ignorado, então rollback documentado não conta);
3. informativo: tabelas publicadas que nenhum código assina.

A checagem 2 é a que mais pega: assinar tabela fora da publication **não dá erro em runtime** — o canal
conecta e nunca recebe evento.

**Secrets: nenhum.** Não há acesso ao banco: a publication é provada pelas migrations do repo, não por
consulta. Se alguém tiver mexido na publication direto no banco, o replay divergirá — e é o replay que
vale como evidência no repo.

Escopo: `docs/**.md` **menos** `docs/agentes/**`, que tem guarda própria
(`scripts/ci/check-agents-md-integrity.mjs`). Citação com placeholder (`xxx_`, `<algo>`, `...`) é ignorada
de propósito: `docs/DEPLOYMENT.md:41` usa `supabase/migrations/xxx_add_new_table.sql` como exemplo.

## Adaptação em relação ao Zapp Web V2

Lá o script valida três documentos específicos (`docs/REALTIME-CHANNELS-INVENTORY.md`, `ADR-009`,
`docs/JORNADA_MENSAGEM_WHATSAPP.md`) e faz parsing da tabela de canais do inventário, incluindo a linha
"Fora da publication hoje: ...". Nenhum desses documentos existe aqui (`docs/adr/` tem só ADR-001 e
ADR-002) e não há inventário de canais, então aquele parser daria um guard que falha na primeira linha por
documento ausente. A parte genérica (citação `arquivo:linha`) virou `docs/**.md`, e a parte de Realtime
trocou "documento → publication" por "**código** → publication", que não depende de documento nenhum.
