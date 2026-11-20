# P-03 · Chat em tempo real Cliente-Motorista (auditoria 5.2)

**Status:** Pendente (não implementado)
**Origem:** docs/audit_report.md seção 5, item 5.2 (P2)

## O que a auditoria pede
Chat em tempo real entre cliente e motorista.

## Evidência do estado atual (2026-11-26)
- NÃO existe chat cliente-motorista. O único "chat" no código é o AIRouteChatbot.tsx (chatbot de rotas IA no dashboard), importado em DashboardRedesigned.tsx — não é chat de comunicação.
- Não há rota de chat, tabela de mensagens nem edge function de chat em supabase/functions/.

## Impacto no negócio
- Sem canal de comunicação em tempo real, cliente e motorista dependem de telefone externo.

## Decisão
- Confirmar com o dono se chat em tempo real é requisito atual. Se sim, é feature nova (front + tabela com RLS + realtime), projeto de escopo médio — planejar em fatia própria.
