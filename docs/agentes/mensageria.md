# Mensageria — motoristas, Zapp e SMS

Runbook da comunicação com motorista, contato de coleta e contato de entrega (plano de 150 etapas).
Vale para quem está de plantão e precisa decidir em minutos, sem ler código.

## O caminho de uma mensagem

1. Um evento nasce no banco: trigger `geo_evaluate_tracking`, webhook da Lalamove ou job da fila.
2. `send-notification` resolve rota e canal (`_shared/messaging/router.ts`), aplica idempotência,
   horário de silêncio e limite por motorista, e despacha.
3. O canal é o Zapp (WhatsApp) por padrão. SMS só entra como contingência: número inválido, contato
   bloqueado, opt-out, instância fora do ar.
4. O que foi enviado e o que voltou fica no ledger `notification_messages` (migration
   `20261125120000_notification_ledger.sql`). `alerts_sent` é legado até a tela migrar (etapa 138).
5. A resposta do motorista chega pelo `zapp-callback`, é classificada (`_shared/messaging/inbound.ts`)
   e vira efeito (`_shared/messaging/inbound-actions.ts`): carimbo no pedido, evento de rastreio,
   incidente ou badge para o operador.

## Número banido ou instância caída no Zapp

Sintoma: `[WhatsApp]` com erro `instance_unavailable`, `unauthorized` ou `recipient_blocked`; o motorista
diz que não recebeu nada.

- `instance_unavailable` / erro HTTP do Evolution → o SMS entra na hora (fallback imediato) quando
  `SMS_PROVIDER_API_KEY` está configurado. Sem ele, o envio falha visível no ledger, não some.
- `recipient_blocked` / `invalid_number` → o número está errado no cadastro. Corrija o telefone do
  motorista; o próximo envio resolve.
- Número banido pelo WhatsApp: **não existe rota de código para isso**. O caminho é abrir um número novo,
  trocar `ZAPP_INSTANCE_NAME`/QR no app do Zapp e rodar um envio de teste pela tela Admin > Mensageria.

## Provedor de SMS fora do ar

- `SMS_PROVIDER` escolhe o provedor (`comtele` padrão, `zenvia`). Sem `SMS_PROVIDER_API_KEY` não há SMS:
  `smsChannelFromEnv()` devolve `null` de propósito, para nunca existir canal quebrado.
- Trocar de provedor = mudar as duas variáveis e redeployar `send-notification`; nada no banco muda.
- Custo por segmento vai para `messaging_usage` (etapa 129, pendente de DDL). Enquanto ela não existe, o
  consumo é lido do próprio provedor.

## Fila morta de callbacks

Sintoma: mensagem aparece como `sent` e nunca vira `delivered`/`read`.

- O callback do Zapp exige HMAC válido e janela anti-replay (`zapp-callback/security.ts`). Relógio
  errado no provedor derruba tudo: confira `ZAPP_CALLBACK_SECRET` e o timestamp do payload.
- Callback repetido é inofensivo: `provider_message_id` tem índice único e o ledger descarta duplicata.
- Callback fora de ordem não perde evento: `provider_sequence` + `occurred_at` decidem o que vale.
- Fila morta de verdade só aparece se a edge `zapp-callback` estiver fora. Confira o log da função no
  painel Supabase antes de suspeitar do provedor.

## Rotação de chave

- `ZAPP_CALLBACK_SECRET`: gere ≥32 caracteres, troque em `supabase secrets set` **e** no painel do Zapp na
  mesma janela. Durante a troca, callbacks com assinatura antiga são recusados — nenhum dado se perde, o
  Zapp reenvia.
- `SMS_PROVIDER_API_KEY`: rotacione no provedor, atualize o secret e redeploye `send-notification`.
- `ZAPP_API_KEY`: idem. Depois de qualquer rotação, mande uma mensagem de teste pela tela Admin > Mensageria.

## Opt-out do motorista

- O motorista escreve SAIR (ou PARAR, descadastrar). **CANCELAR não é opt-out**: para ele, cancelar é
  recusar aquela corrida, e tratá-lo como saída tirava o motorista do briefing para sempre.
- O reconhecimento está em `_shared/messaging/inbound.ts` (`isOptOutKeyword`). O leitor do bloqueio é
  `is_phone_opted_out()`, chamado no `send-notification` antes de qualquer envio.
- Reativar um número é feito pela tela Admin > Opt-outs (etapa 136, pendente de DDL).

## O que ainda não existe

Não prometa o que não está no ar: tela Admin > Mensageria (133), editor de templates (134), matriz
evento × papel (135), CRUD de opt-outs (136), uso/custo (137) e a tela de histórico lendo o ledger (138)
dependem das migrations `messaging_settings`, `message_templates`, `notification_routes` e
`messaging_usage`, ainda não aplicadas. Até lá, a configuração é por variável de ambiente.
