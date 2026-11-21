# P-03 · Chat em tempo real Cliente-Motorista (auditoria 5.2)

**Status:** ADIADO PARA V3 (decisão do dono 2026-11-21) — a V3 será concorrente do Lalamove; a V2 atual é parceira
**Origem:** docs/audit_report.md seção 5, item 5.2 (P2)

## O que a auditoria pede
Chat em tempo real entre cliente e motorista.

## Evidência do estado atual (2026-11-26)
- NÃO existe chat cliente-motorista. O único "chat" no código é o AIRouteChatbot.tsx (chatbot de rotas IA no dashboard), importado em DashboardRedesigned.tsx — não é chat de comunicação.
- Não há rota de chat, tabela de mensagens nem edge function de chat em supabase/functions/.

## Impacto no negócio
- Sem canal de comunicação em tempo real, cliente e motorista dependem de telefone externo.

## Decisão (2026-11-21, dono)
- **ADIADO para a V3.** A V3 será concorrente do Lalamove (plataforma própria de motoristas); a V2 atual é parceira. No escopo V2 este item NÃO será executado.
- Escopo definido para quando abrir a V3: chat em tempo real cliente↔motorista via Supabase Realtime (front + tabela de mensagens com RLS + publicação realtime). **Depende do P-02** (sem o motorista no app, o chat não faz sentido).
