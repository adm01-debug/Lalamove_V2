# 05 — Progresso

Checklist de execução do plano de `04-PLANO.md`. O agente executor marca aqui, etapa por etapa.

- `[ ]` não começou · `[x]` concluída **com a verificação executada e a evidência anotada** ·
  `[~]` não aplicável (o código já não corresponde à evidência da etapa — anote o que encontrou).
- Uma etapa só vira `[x]` depois de a verificação do campo "Como verificar" ter rodado de verdade.
  Anote a evidência (saída do comando, resultado da consulta, corpo da resposta) na linha de baixo, indentada.
- Etapa com aprovação humana fica em `[ ]` com a PR aberta até o dono liberar; registre o link da PR.

Total: **300 etapas** · 79 aguardam aprovação humana.

### Onda 1 — Segurança e risco de perda de dado

- [ ] 001 — Rotacionar a chave e o segredo HMAC da Lalamove e atualizar os secrets das edges — onda 1 — Crítica
- [x] 002 — Remover do repositório os 11 arquivos com credencial e travar reincidência no guard de segredos — onda 1 — Crítica
  - **Concluída em 28/11/2026 (commit da branch `claude/fix-remove-credenciais-lalamove-n8n`).** A reincidência aconteceu: os exports `n8n/workflows/{f00-bootstrap,f01-cotacao,f02-pedido,f03-rastreamento,f04-pop-pod,bundle-import}.json` voltaram à `main` com a API key e o segredo HMAC de produção em texto puro (28 ocorrências). Sanitizados para `{{ $env.LALAMOVE_API_KEY }}` e `{{ $env.LALAMOVE_HMAC_SECRET }}`, com a tabela de variáveis documentada em `n8n/README.md`.
  - Trava criada: `scripts/ci/check-repo-secrets.mjs` (formatos `pk_prod_`, `sk_prod_`, `sb_publishable_`, `sb_secret_`, `sbp_`, token Mapbox, webhook Bitrix24) ligada ao job `security` da CI e ao `scripts/pre-commit-secrets.sh`. Antes do fix ela reprovava 3 arquivos e a varredura antiga não conhecia nenhum desses formatos.
  - **Parcialmente executada em 23/11/2026 — segue `[ ]` porque a etapa não foi concluída como definida.** Feito: os 11 arquivos removidos da `main`
    (`lalamove_documentacao_completa.{md,html,docx}`, `lalamove_suplemento_v2.{md,html}`,
    `lalamove_bundle_import.json`, `lalamove_f0{0,1,2,3,4}_*.json`). Evidência:
    `grep -rlE "pk_prod_[A-Za-z0-9]{10,}|sk_prod_[A-Za-z0-9]{10,}"` no HEAD → 0 arquivos.
    Correção do achado: eram **11** arquivos, não 10 — o `.docx` carregava a credencial dentro do zip e
    o grep original não leu arquivos compactados. `lalamove_suplemento_v2.docx` e
    `lalamove_documentacao_completa.md.pdf` conferidos e limpos (streams descomprimidos e por fragmento).
  - **NÃO feito, segue aberto:** (a) a etapa 001 (rotação da chave e do segredo no painel da Lalamove) —
    o dono optou por postergar; enquanto não rotacionar, quem já copiou do histórico público continua
    com acesso à conta Lalamove e consegue forjar webhook; (b) a extensão do
    `scripts/ci/check-bundle-secrets.mjs` para varrer `*.md/*.json/*.html/*.py` da raiz, que era a parte
    de "travar reincidência" desta etapa — fora do pedido "só apaga".
- [ ] 003 — O repositório está PÚBLICO no GitHub, com credenciais de produção no histórico — onda 1 — Crítica
  - **Bloqueada no dono — não é código.** Confirmado por `gh api repos/adm01-debug/Lalamove_V2`: `"visibility": "public"`. Sanitizar o HEAD (etapa 002) não apaga o histórico: o par `pk_prod_`/`sk_prod_` continua legível nos commits anteriores. Requer decisão de negócio (tornar o repo privado) e ação no painel — o agente não consegue reescrever histórico público de forma confiável sem force-push coordenado.
- [ ] 004 — Qualquer usuário autenticado pode se promover a admin (user_roles com INSERT/UPDATE WITH CHECK/USING true) — onda 1 — Crítica
- [ ] 005 — Nome, telefone e score de risco dos motoristas expostos sem login: materialized view driver_stats_cache com GRANT SELECT para anon — onda 1 — Crítica
- [ ] 006 — bitrix24-sync entrega o BITRIX24_CLIENT_SECRET para um domínio escolhido pelo chamador, e o domínio fica salvo no banco — onda 1 — Crítica
- [ ] 007 — external-db-bridge: qualquer usuário autenticado faz CRUD e RPC arbitrários no banco externo com a service_role dele — onda 1 — Crítica
- [ ] 008 — evaluate-driver: sem nenhuma autenticação em código, e o score de risco é calculado com números enviados pelo próprio chamador — dá para bloquear qualquer motorista — onda 1 — Crítica
- [ ] 009 — lalamove-api nao tem nenhuma checagem de papel: qualquer usuario logado cria pedido pago, cancela, aumenta taxa e redireciona o webhook da conta — onda 1 — Crítica
- [ ] 010 — Edges sensiveis so exigem login, sem nenhuma checagem de papel: viewer cria frete pago e redireciona o webhook da Lalamove — onda 1 — Crítica
- [ ] 011 — requireAdmin da lalamove-uapi aceita papel escrito pelo proprio usuario (escalonamento) e nunca reconhece o admin de verdade — onda 1 — Crítica
- [ ] 012 — `bitrix24-sync` action `oauth_callback` manda `BITRIX24_CLIENT_SECRET` para o domínio que vem na query — sem allowlist — onda 1 — Crítica
- [ ] 013 — Importação em massa da UAPI rebaixa o status de pedidos existentes e sobrescreve endereço e cliente com valores de espaço reservado — onda 1 — Crítica
- [ ] 014 — RLS de user_roles deixa qualquer usuario logado se promover a admin — onda 1 — Crítica
- [ ] 015 — Pedido criado e cobrado na Lalamove nao e gravado no banco: vehicle_type do formulario nao existe no enum do banco — onda 1 — Crítica
- [ ] 016 — Chave do dispatcher gravada em texto puro no comando do cron e chave publishable literal dentro de migration — contra a regra escrita do próprio repo — onda 1 — Alta
- [ ] 017 — audit_log aberto a qualquer usuário logado: política de leitura sem papel e RPC de escrita concedida a authenticated — onda 1 — Alta
- [ ] 018 — geo_evaluate_tracking perdeu as atribuições de v_notify_del e v_driver_name — notificação de entrega nunca é enfileirada e o nome do motorista some das mensagens — onda 1 — Alta
- [ ] 019 — Tokens da Unified API da Lalamove gravados em texto puro numa tabela legível pelo navegador do administrador — onda 1 — Alta
- [ ] 020 — Duas migrations dão papel admin a todos os usuários existentes e uma terceira reativa papéis desativados — onda 1 — Alta
- [ ] 021 — P-04 e P-10 afirmam que as chaves legacy foram rotacionadas e estao 401; banco.md diz o oposto e e a fonte mais recente — onda 1 — Alta
- [ ] 022 — route-analyzer: usuário `viewer` usa o LLM pago sem limite e recebe pedidos completos (nome do cliente) lidos com service_role — onda 1 — Alta
- [ ] 023 — new-device-alert confia no userId e no e-mail do corpo: registra dispositivo e grava auditoria no nome de outro usuário — onda 1 — Alta
- [ ] 024 — test-notification envia para destinatário e webhook arbitrários, sem papel e com CORS aberto — onda 1 — Alta
- [ ] 025 — Botão "Entrar com Biometria" nunca loga ninguém: o challenge é inserido como anônimo e a RLS recusa — onda 1 — Alta
- [ ] 026 — Registro de dispositivo e alerta de "novo acesso" gravam sempre IP 0.0.0.0, vindo do cliente — onda 1 — Alta
- [ ] 027 — O required check E2E passa sem exercitar RBAC e MFA: os testes autenticados fazem skip porque o ci.yml nao injeta a sessao — onda 1 — Alta
- [ ] 028 — Renovação do token Bitrix24 quebrada em dois pontos: self-call sem Authorization e erro do provedor virando 500 genérico — onda 1 — Alta
- [ ] 029 — `cancel` devolve HTTP 204 com corpo JSON: o pedido é cancelado na Lalamove e a tela recebe erro — onda 1 — Alta
- [ ] 030 — Duas edge functions de DDL destrutivo (apply-fixes, seed-fix-rls) continuam no repo e no deploy automático, sem nenhum chamador e sem checagem de papel — onda 1 — Alta
- [ ] 031 — A restrição de pod_status proíbe o próprio valor padrão da coluna, o que pode estar derrubando em silêncio toda a gravação de paradas do pedido — onda 1 — Alta
- [ ] 032 — SSRF em test-notification: a edge faz POST em qualquer URL enviada pelo caller, e dispara WhatsApp/e-mail para destinatario arbitrario — onda 1 — Alta
- [ ] 033 — Duas telas gravam alert_configurations com canais diferentes e o motor de alertas usa só o alert_type — desligar alerta pode não ter efeito — onda 1 — Alta
- [ ] 034 — Formulários de credencial da Lalamove (token UAPI e chaves V3) nunca conseguem salvar — o gateway devolve 501 — onda 1 — Alta
- [ ] 035 — Exportação em PDF injeta texto do banco no HTML sem escapar, em janela de mesma origem — onda 1 — Alta
- [ ] 036 — UI concede acesso por papel já expirado (front-end ignora expires_at que o banco respeita) — onda 1 — Alta
- [ ] 037 — Exigir MFA nas rotas que concedem privilégio — onda 1 — Alta
- [ ] 038 — Inverter o default do ProtectedRoute para exigir MFA, liberando explicitamente as exceções — onda 1 — Alta
- [ ] 039 — Alertas críticos de segurança do webhook e de quota da Lalamove param na tabela `alerts`: nada enfileira notificação e o escalonamento nasce desligado — onda 1 — Média
- [ ] 040 — Fila de aprovação de reset de senha não tem produtor: a única policy de INSERT exige usuário logado, mas o fluxo é pré-login — onda 1 — Média
- [ ] 041 — geo_blocks: tabela usada pelo front não é criada por nenhuma migration, não tem ENABLE RLS nem policy de SELECT no repo, e quebra o banco descartável — onda 1 — Média
- [ ] 042 — job_queue: policies permissivas de 2025 nunca removidas — leitura por qualquer autenticado e INSERT validado por metadado que o próprio usuário controla — onda 1 — Média
- [ ] 043 — refresh_cache_view executável por qualquer autenticado, sem checagem de papel — onda 1 — Média
- [ ] 044 — check-external-api: health check sem autorização alguma que queima credenciais pagas (Mapbox/Google geocoding) por request e fora do orçamento do geo-gateway — onda 1 — Média
- [ ] 045 — geo-admin: `manager` cunha e revoga credenciais de faturamento da Mapbox, e o token secreto novo volta no corpo da resposta para o navegador — onda 1 — Média
- [ ] 046 — geo-gateway: todas as chamadas internas (job-worker) compartilham um único balde de 20 req/min, porque o id do usuário cai em "service_role" — onda 1 — Média
- [ ] 047 — get-mapbox-token entrega o token Mapbox a qualquer caller, sem papel e sem medição, por fora do controle de custo do geo-gateway — onda 1 — Média
- [ ] 048 — llm-wh: o proxy de webhook quebra a assinatura v3 da Lalamove — todo evento repassado por ele é recusado com 401 — onda 1 — Média
- [ ] 049 — O campo que decide o efeito colateral do webhook (eventType) fica de fora da assinatura HMAC, e a checagem de frescor e opcional — onda 1 — Média
- [ ] 050 — O webhook grava no banco antes de qualquer autenticacao valida, com limite de requisicoes guardado so na memoria do processo e sem politica de retencao — onda 1 — Média
- [ ] 051 — lalamove-gateway deixa o chamador sobrescrever a action roteada via params, furando a propria lista branca de acoes — onda 1 — Média
- [ ] 052 — E-mail montado por concatenação de HTML sem escape, com texto vindo do banco e do chamador — onda 1 — Média
- [ ] 053 — Token de acesso do Bitrix24 viaja na query string e o telefone completo vai para o log no caminho Zapp — onda 1 — Média
- [ ] 054 — Telemetria de erro do front escreve com a chave publica sem o token da sessao, e a policy exige usuario autenticado — onda 1 — Média
- [ ] 055 — Bloco DO de 20260828000003 compara variável com coluna de mesmo nome e tenta abrir FOR ALL USING(true) em 13 tabelas sensíveis — onda 1 — Baixa
- [ ] 056 — Policy pública de leitura em alert_configurations sobreviveu ao fix de 22/11 — onda 1 — Baixa
- [ ] 057 — Arquivos de documentacao e bundle n8n na raiz expoem dado real de negocio e identificacao da conta — onda 1 — Baixa
- [ ] 058 — CORS das edges cai em '*' por omissao e ignora todas as origens alem da primeira — onda 1 — Baixa

### Onda 2 — Fluxos principais quebrados

- [ ] 059 — Cancelamento manual grava 'CANCELED' numa coluna que só aceita 'CANCELLED' — o pedido nunca é marcado como cancelado no banco — onda 2 — Crítica
- [ ] 060 — Nenhuma guarda de transição na única função que muda status do pedido: evento desconhecido vira 'ON_GOING' e ressuscita pedido já concluído — onda 2 — Crítica
- [ ] 061 — Job travado volta para PENDING sem incrementar attempts — laço infinito de redispatch, sem limite de tentativas — onda 2 — Alta
- [ ] 062 — banco.md ensina que "o merge e o apply" de migration e nega a existencia de workflow de migration; existe .github/workflows/apply-migrations.yml, manual — onda 2 — Alta
- [ ] 063 — deploy.md afirma que nao existe automacao de deploy de edge function; .github/workflows/deploy-edges.yml faz exatamente isso em push para main — onda 2 — Alta
- [ ] 064 — docs/DEPLOYMENT.md e README.md descrevem a producao na Lovable, e banco.md usa o DEPLOYMENT.md como fonte do fluxo de migration — onda 2 — Alta
- [ ] 065 — mensageria.md manda o plantao olhar o ledger notification_messages e a edge zapp-callback; nenhum dos dois existe no repo — onda 2 — Alta
- [ ] 066 — Cancelamento de pedido sempre responde erro 500: a resposta e montada com HTTP 204 e corpo JSON, o que o runtime proibe — onda 2 — Alta
- [ ] 067 — O worker horario de renovacao do token UAPI nunca renova nada: depende de um proxy que nao existe e, no caminho de sucesso, nao grava o token novo — so zera o contador de idade — onda 2 — Alta
- [ ] 068 — Pedido concluido ou cancelado pela Lalamove nao fecha o ciclo: os handlers que incrementam entregas e avisam o time respondem a eventos que a v3 nao envia — onda 2 — Alta
- [ ] 069 — Telefone vindo de alert_configurations é enviado sem normalização — só o caminho ad-hoc normaliza — onda 2 — Alta
- [ ] 070 — Botão "Avaliar motorista" nunca mostra o resultado: o hook lê um formato de resposta que a edge evaluate-driver não devolve — onda 2 — Alta
- [ ] 071 — Painel de SLA: 5 consultas sem limite a cada 10 s, uma delas inútil, e erro de consulta vira "100% no prazo" — onda 2 — Alta
- [ ] 072 — Fallback de geocodificação do pedido nunca funciona: lê `json.data[0]` mas o geo-gateway devolve array puro — e os 12 testes do módulo mockam o formato errado — onda 2 — Alta
- [ ] 073 — `priority-fee` grava a taxa e o histórico sem checar se a Lalamove aceitou — onda 2 — Alta
- [ ] 074 — A sincronização periódica grava o status cru da Lalamove no enum: pedido cancelado trava como ativo e é re-sincronizado para sempre — onda 2 — Alta
- [ ] 075 — Criar a tabela de tradução única de status em _shared e cobri-la de teste — onda 2 — Alta
- [ ] 076 — Passar os pontos de escrita de status a usar a tradução única — onda 2 — Alta
- [ ] 077 — Botões 'Trajeto' e 'Google' do popup do motorista não fazem nada em produção (listener nunca é anexado) — onda 2 — Alta
- [ ] 078 — Falha do get-mapbox-token deixa o mapa ao vivo travado no spinner, sem mensagem e sem retry — onda 2 — Alta
- [ ] 079 — Regras de risco: 5 dos 8 campos oferecidos na tela não existem no avaliador — a regra é salva como Ativa e nunca dispara — onda 2 — Alta
- [ ] 080 — Salvar permissões sempre falha: a chave do pendingChanges é quebrada por split('-') em UUID — onda 2 — Alta
- [ ] 081 — "Total de motoristas" do Analytics vem de uma consulta com limit(10) e nunca passa de 10 — onda 2 — Alta
- [ ] 082 — Página "Fila de Jobs" não lê a tabela job_queue real; "Processando" e "Tempo Médio" são constantes — onda 2 — Alta
- [ ] 083 — SLO: disponibilidade soma falhas que não estão no total de requisições e pode ficar negativa; o gráfico usa outra fórmula — onda 2 — Alta

### Onda 3 — Integridade de dados e regras de negócio

- [ ] 084 — A edge `new-device-alert` publicada responde 500 em vez de 422 — o alerta de login em dispositivo novo não é enviado — onda 3 — Alta
- [ ] 085 — Canal realtime compartilhado por tópico: desmontar uma tela mata o tempo real de todas as outras (alerta crítico para de aparecer) — onda 3 — Alta
- [ ] 086 — A CI da `main` está vermelha há três execuções e o AGENTS.md afirma por escrito que está verde — onda 3 — Alta
- [ ] 087 — Avaliação de risco não é gravada para nenhum motorista com falha: CHECK de failure_rate espera fração, a edge grava percentual — onda 3 — Alta
- [ ] 088 — Minutos de aviso e de crítico configurados em /alert-configurations não têm efeito nenhum no alerta de motorista parado — onda 3 — Alta
- [ ] 089 — Pontualidade é calculada com três fórmulas diferentes e uma delas conta pedido sem prazo como "no prazo" — onda 3 — Alta
- [ ] 090 — Regra de risco configurada como "+N pontos" só aplica metade — onda 3 — Alta
- [ ] 091 — Score de risco do motorista: fórmula e faixas divergem do que está documentado, e mais fatores de risco podem BAIXAR o score — onda 3 — Alta
- [ ] 092 — Tolerância de atraso do ETA tem duas fontes diferentes; a do job-worker usa o campo de intervalo entre alertas como se fosse regra de negócio — onda 3 — Alta
- [ ] 093 — DRIVER_ASSIGNED força status 'MATCHED' sem guarda e sem registrar nada no histórico — onda 3 — Alta
- [ ] 094 — Fila de aprovação aceita decisão em cima de decisão: dois gestores simultâneos, e o desfazer devolve motorista bloqueado para 'aguardando aprovação' — onda 3 — Alta
- [ ] 095 — usage_ratio é gravado em duas escalas diferentes pelas edges; o painel de Quota mostra 0,9% no lugar de 90% e o alerta crítico dispara errado — onda 3 — Alta
- [ ] 096 — Auditoria de MFA nunca grava: log_mfa_session() insere na coluna aal_level, que não existe, e omite duas colunas NOT NULL — onda 3 — Média
- [ ] 097 — Schema local divergente do de produção: CREATE TABLE IF NOT EXISTS antigo vence e as migrations de restauração viram no-op — onda 3 — Média
- [ ] 098 — Valor de enum DRIVER_ASSIGNED pode não existir em produção, derrubando o alerta de motorista designado — onda 3 — Média
- [ ] 099 — tracking_events perdeu chave primária e as duas chaves estrangeiras ao ser reparticionada — onda 3 — Média
- [ ] 100 — Contagens de inventario erradas e em cadeia nos docs de agentes: 153/157 migrations contra 191 reais, 4 specs e2e contra 7, 6 rotas com MFA contra 7 — onda 3 — Média
- [ ] 101 — O indice do backlog (docs/pendencias/README.md) nao lista P-14, P-15 e P-16 — inclusive o unico item ativo da fila — onda 3 — Média
- [ ] 102 — O procedimento de confirmacao de deploy documentado em deploy.md nao funciona com o acesso desta sessao, e o doc da a CI/build como quebrada enquanto o AGENTS.md a da como verde — onda 3 — Média
- [ ] 103 — github-ci.md declara a main sem branch protection e sem required checks; a API mostra 7 required checks e enforce_admins ligado — onda 3 — Média
- [ ] 104 — github-ci.md descreve 1 workflow e 8 jobs e afirma que os guards nao estao ligados ao CI; sao 5 workflows, 13 jobs e o guard e required check — onda 3 — Média
- [ ] 105 — rotate-tokens: sem autorização e sem agendador — qualquer caller força a rotação dos tokens OAuth do Bitrix24 e pode derrubar a integração — onda 3 — Média
- [ ] 106 — A troca de motorista tenta gravar o historico em colunas que nao existem (lalamove_id, changed_at) e sem order_id, que e NOT NULL — onda 3 — Média
- [ ] 107 — Cada uma das cinco funcoes responde erro num formato diferente, e so um deles o front sabe ler — onda 3 — Média
- [ ] 108 — Jobs de fila dos tipos email/whatsapp/slack nunca entregam e são marcados como concluídos — onda 3 — Média
- [ ] 109 — skip_dedup e is_escalation aceitos de qualquer usuário autenticado — onda 3 — Média
- [ ] 110 — Recalculo de risco no navegador sobrescreve o score da edge com outra matemática e ignora whitelist/blacklist — onda 3 — Média
- [ ] 111 — Migration só é aplicada à mão, com o nome do arquivo digitado, enquanto o código sobe sozinho no merge — onda 3 — Média
- [ ] 112 — Quatro jobs de teste de banco nao estao entre os required checks: podem ficar vermelhos sem bloquear merge — onda 3 — Média
- [ ] 113 — Tres suites Deno existem no repo e nenhum job as executa — onda 3 — Média
- [ ] 114 — github-settings-baseline.json afirma que a main nao tem branch protection, e a API diz o contrario — varios workflows repetem a informacao errada — onda 3 — Média
- [ ] 115 — xlsx vem de tarball fora do registro npm: build, typecheck e teste caem juntos quando cdn.sheetjs.com nao responde, e o npm audit nao enxerga a dependencia — onda 3 — Média
- [ ] 116 — O health check da Lalamove chama endpoint e autenticação que não existem no contrato v3 — resultado é sempre "degraded" — onda 3 — Média
- [ ] 117 — `route-analyzer` não checa papel nem limita taxa: qualquer autenticado gasta crédito de IA e manda a base de motoristas e pedidos para fora — onda 3 — Média
- [ ] 118 — Os dois ratchets de tipo têm baseline desatualizado: 17 erros já corrigidos continuam na lista de perdoados e podem voltar com a CI verde — onda 3 — Média
- [ ] 119 — Toda a camada de edge functions está fora do lint e de qualquer verificação de tipo na CI: 94 arquivos .ts sem análise estática, apesar dos 7 checks obrigatórios — onda 3 — Média
- [ ] 120 — A mesma faixa de risco está escrita com cortes diferentes em quatro lugares — onda 3 — Média
- [ ] 121 — Análise preditiva mostra percentual de SLA inventado e nunca encontra motoristas em risco — onda 3 — Média
- [ ] 122 — Aprovação de motorista não registra quem aprovou e é feita em dois updates sem transação — onda 3 — Média
- [ ] 123 — Bloqueio e limite por IP no login nunca são acionados — o front sempre envia o IP como indefinido — onda 3 — Média
- [ ] 124 — Dinheiro somado em ponto flutuante, com moeda de um pedido aplicada ao total e denominadores diferentes para o mesmo "custo médio" — onda 3 — Média
- [ ] 125 — Tabela de pedidos e análise preditiva tratam o limiar configurado como se fosse o desvio medido — onda 3 — Média
- [ ] 126 — A coluna lalamove_status, que os gatilhos de geo leem como status primário do pedido, nunca é escrita por ninguém — e as listas de liberação não cobrem o vocabulário real — onda 3 — Média
- [ ] 127 — A regra de transição existe, está testada e verde, mas nenhum código de produção a chama — e o P-09 declara o problema obsoleto por causa dela — onda 3 — Média
- [ ] 128 — Evento de POD repetido ou fora de ordem apaga a foto e a data de entrega já gravadas — onda 3 — Média
- [ ] 129 — Pedido em 'ASSIGNING_DRIVER', 'DELIVERING' ou 'QUOTED' joga o negócio de volta para a etapa 'Novo' no Bitrix24 — onda 3 — Média
- [ ] 130 — Quatro eventos que não mudam status gravam uma transição falsa para 'ON_GOING' no histórico do pedido — onda 3 — Média
- [ ] 131 — Troca de motorista duplica pedidos de aprovação: a fila não tem unicidade por pedido e a edge não checa se já existe um pendente — onda 3 — Média
- [ ] 132 — check-driver-alerts alerta sobre pedidos já encerrados: não filtra nem o status do pedido nem o rastreio encerrado — onda 3 — Média
- [ ] 133 — Negação de papel do ProtectedRoute (o único portão RBAC do app) não tem teste em lugar nenhum — onda 3 — Média
- [ ] 134 — Teste e2e obrigatório bate no endpoint real de recuperação de senha, sem interceptar, e só passa no caminho feliz — onda 3 — Média
- [ ] 135 — src/__tests__/improvements-validation.test.tsx: 40 testes que não importam uma linha do aplicativo — onda 3 — Média
- [ ] 136 — Atribuir papel exige UUID digitado à mão e revogar não pede confirmação — onda 3 — Média
- [ ] 137 — Validação de IP rejeita IPv6 abreviado, inclusive o exemplo do próprio formulário — onda 3 — Média
- [ ] 138 — Raio e ETA de aproximacao do pedido so sao validados pelo navegador: valor negativo desliga o aviso em silencio — onda 3 — Média
- [ ] 139 — "Tempo médio de entrega" calculado com três denominadores diferentes, um deles subestimando a média — onda 3 — Média
- [ ] 140 — Gráficos diários usam o dia em UTC enquanto o rótulo é o dia local: pedidos da noite caem no dia seguinte e a tendência exibe a data errada — onda 3 — Média
- [ ] 141 — Monitoramento de Cache esconde justamente as views com falha e mostra "última verificação" da view errada — onda 3 — Média

### Onda 4 — Funcionalidades incompletas

- [ ] 142 — A matriz de special requests da edge divergiu do catálogo oficial: todo extra pago escolhido na tela é descartado em silêncio antes da cotação — onda 4 — Alta
- [ ] 143 — IP Whitelist e Bloqueio Geográfico são telas de segurança que nenhum código aplica — onda 4 — Alta
- [ ] 144 — Dashboard de Analytics mostra variação percentual inventada (+12%, +8%, -3%, -15%) como "vs período anterior" — onda 4 — Alta
- [ ] 145 — AGENTS.md indica a edge mapbox-proxy como o proxy do Mapbox; ela foi removida do repo na etapa 61 — onda 4 — Média
- [ ] 146 — pendencias-dono.md apresenta 3 PRs como abertas aguardando decisao do dono; as 3 estao mergeadas na main — onda 4 — Média
- [ ] 147 — Fallback temporizado entre WhatsApp e SMS está escrito e testado, mas nenhum código o usa — onda 4 — Média
- [ ] 148 — Falhas de consulta engolidas: contadores da sidebar e contagem de incidentes viram zero sem avisar — onda 4 — Média
- [ ] 149 — Painel de saúde do sistema mostra números inventados e mina um token Mapbox a cada 30 segundos — onda 4 — Média
- [ ] 150 — Nao existe vercel.json nem fallback de SPA no repositorio, com 58 rotas em BrowserRouter — onda 4 — Média
- [ ] 151 — Abrir o painel de configurações do mapa zera os limiares de alerta que o operador acabou de ajustar — onda 4 — Média
- [ ] 152 — Traçado de rota fica no mapa para sempre depois que o pedido sai do rastreamento — onda 4 — Média
- [ ] 153 — Zonas de risco do mapa são polígonos fixos escritos no código, apresentados como informação operacional — onda 4 — Média
- [ ] 154 — Aba Acessibilidade das preferências não aplica nem salva nada — onda 4 — Média
- [ ] 155 — Banner 'Secrets de notificação pendentes' é fixo no código e o botão Configurar não faz nada — onda 4 — Média
- [ ] 156 — Provedor reserva (fallback) do mapa é só exibido, nunca configurável — onda 4 — Média
- [ ] 157 — Consulta que falha aparece como 'nenhum registro' em tres blocos do detalhe do pedido — onda 4 — Média
- [ ] 158 — Importacao de CSV adota a primeira coluna como ID quando nao reconhece o cabecalho, sem limite de linhas nem como cancelar — onda 4 — Média
- [ ] 159 — Operadores de busca documentados na propria tela de pedidos nunca funcionam — onda 4 — Média
- [ ] 160 — Três crons de cache documentados como ativos vêm de migration que nunca rodou, e dois apontam para materialized views que não existem em lugar nenhum — onda 4 — Baixa
- [ ] 161 — Artefatos gerados e commitados estão desatualizados: o inventário diz 54 rotas e 20 problemas, o real é 56 e 0 — onda 4 — Baixa
- [ ] 162 — mapa-repo.md afirma que nenhum doc e gerado por script e que vários scripts tem service_role/PAT no codigo; as duas afirmacoes sao falsas hoje — onda 4 — Baixa
- [ ] 163 — Formatadores de moeda e data reescritos à mão em 12 lugares, com a moeda fixada em BRL em uma das cópias — onda 4 — Baixa
- [ ] 164 — Oito arquivos de front (~1.900 linhas) exportados e nunca importados por ninguém, incluindo um componente marcado como placeholder — onda 4 — Baixa
- [ ] 165 — Painel de quota da Lalamove subnotifica chamadas sem avisar: a janela de 24 h é cortada em 2000 linhas — onda 4 — Baixa
- [ ] 166 — A quarentena de E2E não exclui nada: o playwright.config.ts não tem testIgnore e o guard que cobra prazo não roda na CI — onda 4 — Baixa
- [ ] 167 — Limite de cobertura de 70% em vitest.config.ts é decorativo: o pacote de cobertura não está instalado e nenhum workflow pede cobertura — onda 4 — Baixa
- [ ] 168 — Opções 'Grátis' do seletor usam tiles públicos de OSM e Esri direto do servidor de origem — onda 4 — Baixa
- [ ] 169 — Classes de cor montadas em tempo de execução não existem no CSS final — onda 4 — Baixa

### Onda 5 — Robustez: erros, estados, concorrência

- [ ] 170 — Os quatro crons que chamam edge functions são disparo cego: nada lê a resposta HTTP e o pg_cron marca 'succeeded' mesmo com 401 — onda 5 — Alta
- [ ] 171 — Rotinas de retenção e rollup existem mas nunca foram agendadas: logs de erro e uso de contrato crescem sem corte — onda 5 — Média
- [ ] 172 — lalamove-api e lalamove-uapi chamam a Lalamove sem nenhum timeout, com ate 3 tentativas por chamada — onda 5 — Média
- [ ] 173 — Canais Resend, Slack, Bitrix24, n8n e Evolution fazem fetch sem timeout, em laço sequencial — onda 5 — Média
- [ ] 174 — Opt-out é furado pelo canal de contingência e pelo fallback imediato de SMS — onda 5 — Média
- [ ] 175 — Limitar e paginar as consultas de motorista e avaliação (useDrivers, useDriverEvaluations, useReportData) — onda 5 — Média
- [ ] 176 — Limitar e paginar incidentes, dispositivos e contatos (useIncidents, useUserDevices, useContacts) — onda 5 — Média
- [ ] 177 — Limitar e paginar os logs de rate limit, webhook e aprovação de senha — onda 5 — Média
- [ ] 178 — Rastreamento ao vivo refaz a consulta inteira a cada evento de GPS, além do intervalo de 5 s — onda 5 — Média
- [ ] 179 — Falha transitória na RPC de permissões tranca o usuário em /unauthorized até recarregar a página — onda 5 — Média
- [ ] 180 — Fila de jobs: "Deletar" e "Processar fila" não fazem nada mas confirmam sucesso, e o filtro de status ignora as avaliações — onda 5 — Média
- [ ] 181 — Gate de MFA abre quando a consulta de nível de autenticação falha — onda 5 — Média
- [ ] 182 — 24 referencias de GitHub Action por tag mutavel e 2 actions fora da allowlist — onda 5 — Média
- [ ] 183 — Nenhuma chamada a terceiro tem timeout: 9 arquivos de integração usam `fetch` sem `AbortController` — onda 5 — Média
- [ ] 184 — O bloqueio por tentativas de login (anti-força-bruta) não tem nenhum teste da implementação real — o e2e simula o backend inteiro — onda 5 — Média
- [ ] 185 — O teste de RBAC autenticado passa tanto se o usuário for barrado quanto se ele entrar — onda 5 — Média
- [ ] 186 — Webhook da Lalamove: só o HMAC é testado; mapeamento de status, replay e idempotência não têm teste e o arquivo não exporta nada — onda 5 — Média
- [ ] 187 — Google Earth 3D falha calado: biblioteca maps3d não é carregada com a chave própria e nenhuma mensagem ou fallback aparece — onda 5 — Média
- [ ] 188 — Provedor de mapa decidido por duas regras diferentes: mapa ao vivo segue a preferência do usuário, mini-mapa do pedido segue só a política do admin — onda 5 — Média
- [ ] 189 — Blacklist e Whitelist de motorista executam no primeiro clique, sem confirmação e sem desfazer — onda 5 — Média
- [ ] 190 — Decisão de aprovação de motorista não checa o status atual: duas abas sobrescrevem uma à outra — onda 5 — Média
- [ ] 191 — Editar configuração de alerta sobrescreve o que outra aba salvou e perde a edição se o salvamento falhar — onda 5 — Média
- [ ] 192 — Falha ao carregar lista vira estado vazio em três telas de segurança e aprovação — onda 5 — Média
- [ ] 193 — Botao 'Exportar' da tela de pedidos nao tem handler nenhum — onda 5 — Média
- [ ] 194 — KPI "Taxa Auto-Aprovação" compara fila por pedido com total de motoristas e trava em 0% — onda 5 — Média
- [ ] 195 — /reset-password aceita qualquer sessão ativa, não só o link de recuperação — troca de senha sem pedir a senha atual — onda 5 — Média
- [ ] 196 — Rota 404 quebra: NotFound é lazy e é a única rota sem Suspense, caindo no ErrorBoundary — onda 5 — Média
- [ ] 197 — notification_optouts tem chave primária no telefone cru, mas a consulta compara o telefone normalizado — onda 5 — Baixa
- [ ] 198 — CORS: a configuracao de origens so respeita a primeira da lista, e duas das cinco funcoes liberam qualquer origem de forma fixa — onda 5 — Baixa
- [ ] 199 — bitrix24-process-queue processa a fila sem reservar a linha e sem serializar o refresh de token — onda 5 — Baixa
- [ ] 200 — Cache de permissões e de dados administrativos sobrevive à troca de usuário quando a sessão cai sem signOut explícito — onda 5 — Baixa
- [ ] 201 — O logout promete limpar as preferências da sessão anterior mas apaga apenas 2 de ~8 chaves — onda 5 — Baixa
- [ ] 202 — Nenhum job do ci.yml tem timeout nem concurrency — onda 5 — Baixa
- [ ] 203 — Os limites de cobertura de 70% do vitest nunca sao aplicados: a CI roda vitest sem --coverage — onda 5 — Baixa
- [ ] 204 — npm run lint nunca pode falhar: todas as regras ruidosas sao warning e o ratchet que conteria a divida esta quebrado — onda 5 — Baixa
- [ ] 205 — Telemetria de quota da Lalamove lê o header sem o sufixo de endpoint: `lalamove_rate_limits` sempre nulo e o alerta de quota crítica nunca dispara — onda 5 — Baixa
- [ ] 206 — `geo-admin` ficou fora do registro de contratos, mas o doc afirma "26 de 26 Edge Functions com entrada validada" — onda 5 — Baixa
- [ ] 207 — Cálculo de risco de motorista duplicado: cópia morta no front com pesos diferentes da que roda de verdade na edge evaluate-driver — onda 5 — Baixa
- [ ] 208 — Dois `useWalletBalance` exportados com formatos de dado diferentes; a tela de UAPI usa a versão sem trava de configuração e consulta a cada 30s mesmo sem Lalamove configurado — onda 5 — Baixa
- [ ] 209 — O mapa "hero" do dashboard tem altura fixa de 300px dentro de um cartão de até 600px, e a prop activeDeliveries que ele recebe nunca é usada — onda 5 — Baixa
- [ ] 210 — Orçamento de mapas do Mapbox nasce com limite zero e parada obrigatória — bloqueia no primeiro centavo e sem aviso prévio — onda 5 — Baixa
- [ ] 211 — Trocar a velocidade do replay de trajeto não tem efeito enquanto a reprodução está rodando — onda 5 — Baixa
- [ ] 212 — Download do comprovante abre a janela depois do await e falha calado quando o navegador bloqueia — onda 5 — Baixa
- [ ] 213 — Cabeçalho mostra "Dashboard" em 25 das 49 telas internas, inclusive no Mapa ao Vivo canônico — onda 5 — Baixa

### Onda 6 — Performance

- [ ] 214 — useSidebarCounts.refetchCounts muda de identidade a cada render e recria o canal realtime da sidebar sem parar — onda 6 — Alta
- [ ] 215 — Mover os totais dos painéis para contagem no banco (count exact) em vez de somar no navegador — onda 6 — Alta
- [ ] 216 — Mover as médias e taxas para agregação no banco (RPC) em vez de média do navegador — onda 6 — Alta
- [ ] 217 — Fazer a exportação (CSV/PDF/XLSX) buscar o conjunto completo, não a página da tela — onda 6 — Alta
- [ ] 218 — Fila do Bitrix24: o trigger enfileira a cada mudança de status, mas nada drena — só um botão manual na tela — onda 6 — Média
- [ ] 219 — refresh_geo_jobs enfileira 1 a 2 jobs por rastreio ativo a cada 5 min contra um dispatcher de 10 jobs por minuto — onda 6 — Média
- [ ] 220 — Aviso automático ao fornecedor é reemitido a cada novo alerta de parada, sem teto por pedido — onda 6 — Média
- [ ] 221 — Teto de 6 mensagens/10min por motorista lê alerts_sent sem filtro por destinatário nem limite — onda 6 — Média
- [ ] 222 — Fila de aprovações é cortada em 50 itens sem paginação enquanto o contador mostra o total — onda 6 — Média
- [ ] 223 — useSLAMetrics recria o canal realtime a cada render (handleUpdate depende do objeto da query) — onda 6 — Média
- [ ] 224 — useTrackingHistory sem proteção contra resposta atrasada: histórico de um motorista pode sobrescrever o de outro — onda 6 — Média
- [ ] 225 — Os jobs de SQL testam a migration por faixas de linha fixas (sed -n '277,345p') — onda 6 — Média
- [ ] 226 — Balão de informações do motorista fecha sozinho a cada ciclo de atualização — onda 6 — Média
- [ ] 227 — Cada troca de estilo ou de provedor recria o mapa Mapbox e cobra um novo map load, além de refazer as chamadas de Directions — onda 6 — Média
- [ ] 228 — Loop de animação a 60 fps roda sem parar no mapa ao vivo, inclusive sem movimento e com provedor Google ativo — onda 6 — Média
- [ ] 229 — Mesma tabela active_tracking consultada por 2 a 3 pollings simultâneos e 2 canais realtime, e o kill-switch documentado não desliga o polling — onda 6 — Média
- [ ] 230 — Cartoes de estatistica da tela de pedidos misturam total geral com contagem da pagina atual — onda 6 — Média
- [ ] 231 — Endereco escolhido no CRM ou em 'Ja usados' entra no pedido sem a coordenada que o sistema ja tinha gravada — onda 6 — Média
- [ ] 232 — Cinco índices redundantes: duplicam o prefixo de um índice único ou composto já existente — onda 6 — Baixa
- [ ] 233 — Trigger de auditoria da configuração de mapas grava resource_id aleatório porque a coluna é uuid NOT NULL — onda 6 — Baixa
- [ ] 234 — active_tracking.tracking_status sem CHECK e já gravado em caixas diferentes ('ACTIVE' e 'ended') — onda 6 — Baixa
- [ ] 235 — O comentário do workflow de contexto diz "a cada 10 min"; o agendamento é horário — onda 6 — Baixa
- [ ] 236 — Canal de contingência dispara mesmo quando a mensagem já saiu ou foi barrada por opt-out — onda 6 — Baixa
- [ ] 237 — escalate-alerts dispara a mesma escalação uma vez por linha de configuração do tipo, e a escalação não passa por dedup — onda 6 — Baixa
- [ ] 238 — O job deploy do ci.yml so imprime uma frase e aparece como deploy bem-sucedido — onda 6 — Baixa

### Onda 7 — Experiência de uso e consistência

- [ ] 239 — Buscar o endereco pelo CEP depois de escolher no autocomplete deixa a coordenada antiga: a cotacao vai com o ponto do endereco anterior — onda 7 — Alta
- [ ] 240 — A cadeia de migrations não aplica do zero: quatro colisões abortam `supabase db reset` / recriação do banco — onda 7 — Média
- [ ] 241 — Trigger de geofence lê OLD em INSERT: o primeiro ponto do rastreio pode abortar o upsert e o rastreio nunca começa — onda 7 — Média
- [ ] 242 — Prova de entrega sem stopIndex sobrescreve TODAS as paradas do pedido com a mesma imagem e o mesmo status — onda 7 — Média
- [ ] 243 — Tema agendado só funciona enquanto a tela de preferências está aberta: dois hooks de tema disputam a mesma classe com chaves diferentes — onda 7 — Média
- [ ] 244 — Erro do Bitrix24 chega em corpo HTTP 200 e é contado como sucesso em três pontos — onda 7 — Média
- [ ] 245 — Botão de renomear dispositivo não pergunta o nome: grava um rótulo automático — onda 7 — Média
- [ ] 246 — Cartões de estatística das aprovações de senha contam apenas a lista já filtrada — 'Aprovadas' e 'Rejeitadas' ficam sempre em zero — onda 7 — Média
- [ ] 247 — Filtro de busca sem escape: virgula ou parentese no termo quebram a consulta da lista de pedidos — onda 7 — Média
- [ ] 248 — "Motoristas Ativos" conta linhas de rastreamento e de cache, não motoristas distintos — onda 7 — Média
- [ ] 249 — "Pedidos (7d)" do Cache Status são as 7 linhas mais recentes da view, que podem abranger meses — onda 7 — Média
- [ ] 250 — Busca de erros monta o filtro do PostgREST por concatenação: vírgula ou parêntese no termo quebra a consulta — onda 7 — Média
- [ ] 251 — CSV de Relatórios traz a coluna "Tempo Médio (min)" sempre zerada — onda 7 — Média
- [ ] 252 — Rate Limiting: "Total Requests" conta linhas de log (teto 500) ignorando request_count, e o gráfico "Últimas 24 horas" são os últimos 24 registros — onda 7 — Média
- [ ] 253 — SLO: o "orçamento de erro" da latência não é orçamento — indicador saudável aparece com 0% livre — onda 7 — Média
- [ ] 254 — Saúde geral cai para "degradado" sem incidente: sistema ocioso e ausência de canais realtime são tratados como falha — onda 7 — Média
- [ ] 255 — Score de Performance mostra 0/100 "Ruim" quando ainda não há métricas e normaliza o resultado pelo que foi coletado — onda 7 — Média
- [ ] 256 — Command palette lista todas as rotas de administração sem filtro de papel e fica ativa na tela pública de login — onda 7 — Média
- [ ] 257 — Menu lateral não sabe expressar o papel 'operator', então o viewer vê 7 itens que a rota recusa — onda 7 — Média
- [ ] 258 — Navegação mobile ignora o RBAC por completo: viewer vê e toca em Aprovações, Webhooks, Regras de Risco e Configurações — onda 7 — Média
- [ ] 259 — Dois pares de crons agendam a mesma rotina com nomes diferentes, e o documento descreve cada par como rotinas distintas — onda 7 — Baixa
- [ ] 260 — Nove chaves estrangeiras para auth.users sem ON DELETE — apagar um usuário falha — onda 7 — Baixa
- [ ] 261 — simulate-driver-movement: o botão "Simular" do mapa ao vivo sempre falha em produção e mostra mensagem de permissão errada — onda 7 — Baixa
- [ ] 262 — Erro cru da Lalamove e mensagem interna de excecao voltam para o cliente — onda 7 — Baixa
- [ ] 263 — bitrix24 aceito como fallback_channel pelo banco cai no ramo 'canal não suportado' do despacho — onda 7 — Baixa
- [ ] 264 — Contador de espera da fila: a faixa "urgente" (15–30 min) é desenhada igual à de "atenção", e o outro componente usa cinco faixas em vez de quatro — onda 7 — Baixa
- [ ] 265 — Alerta crítico pode ser salvo com tempo menor que o de aviso — onda 7 — Baixa
- [ ] 266 — 'Bloquear motorista' executa direto no primeiro clique, sem confirmacao — onda 7 — Baixa
- [ ] 267 — Cupons e frota da conta Lalamove mostram so a primeira pagina, sem indicacao de que ha mais — onda 7 — Baixa
- [ ] 268 — Parametro de pagina da URL nao e validado e vai direto para o intervalo da consulta — onda 7 — Baixa
- [ ] 269 — Mesma nota de motorista aparece como 5,0 em uma tela e 0,0 em outra — onda 7 — Baixa

### Onda 8 — Higiene: código morto, CI, observabilidade

- [ ] 270 — O guarda que vigia as configurações do GitHub dá "tudo certo" quando o token é recusado — onda 8 — Alta
- [ ] 271 — A cadeia de migrations não roda do zero: três arquivos referenciam objetos que não existem ou que são criados depois — onda 8 — Média
- [ ] 272 — A linha de base anti-regressao, que as regras da pasta mandam rodar antes e depois de cada fatia, esta desatualizada e se contradiz com _ordem.md — onda 8 — Média
- [ ] 273 — P-15 e P-16 registram a PR #119 como aberta e a main sem o trabalho dela; migration e tela ja estao na main — onda 8 — Média
- [ ] 274 — Ligar na CI os guardas de segredo e de exposição (bundle, artefato de e2e, erro de edge, workflow com secret) — onda 8 — Média
- [ ] 275 — Ligar na CI os ratchets de qualidade (lint, typecheck, implicit-any, a11y, i18n, bundle) — onda 8 — Média
- [ ] 276 — Ligar na CI os guardas de perímetro e de workflow (pins de action, invariantes, settings do GitHub, matriz edge×tabela) — onda 8 — Média
- [ ] 277 — O job security so quebra em vulnerabilidade critica: high passa verde — onda 8 — Média
- [ ] 278 — deploy das edge functions em producao nao depende da CI: contract test vermelho nao impede o deploy — onda 8 — Média
- [ ] 279 — workflow_dispatch de apply-migrations.yml interpola o input direto no bash, com o token de producao no ambiente — onda 8 — Média
- [ ] 280 — O retorno do OAuth do Bitrix24 é impossível: a URL de redirect aponta para uma edge com `verify_jwt = true` — onda 8 — Média
- [ ] 281 — Edge geo-admin: rotação do token do Mapbox foi construída, está deployada e nunca roda — nenhum chamador, nenhuma entrada de menu, nenhum agendamento — onda 8 — Média
- [ ] 282 — Cotação, criação e cancelamento de pedido na edge lalamove-api: nenhuma das 15 ações tem teste, nem a assinatura HMAC que autentica todas elas — onda 8 — Média
- [ ] 283 — O guard que detecta teste órfão falha hoje (exit 1) e nenhum workflow o executa — onda 8 — Média
- [ ] 284 — Suíte órfã com teste vermelho há tempo indeterminado: baseline congelada de assinaturas realtime não bate mais com o código — onda 8 — Média
- [ ] 285 — Aba 'Permissões' da tela de Roles mostra todas as permissões como concedidas para qualquer papel — onda 8 — Média
- [ ] 286 — Após login o usuário sempre cai no painel: AppLayout redireciona sem guardar a rota de origem — onda 8 — Média
- [ ] 287 — docs/DATA_DICTIONARY.md diverge do schema em cinco pontos, inclusive na escala do score de risco — onda 8 — Baixa
- [ ] 288 — `SUPABASE_ACCESS_TOKEN` existe há dois dias, mas o workflow que depende dele afirma que não está configurado — onda 8 — Baixa
- [ ] 289 — Deferimento por horário de silêncio perde os destinatários do pedido — onda 8 — Baixa
- [ ] 290 — useDriver e useDriverIncidents sem nenhum consumidor (não cobertos pela triagem de órfãos) — onda 8 — Baixa
- [ ] 291 — .lintstagedrc configurado sem lint-staged, husky nem prettier instalados — onda 8 — Baixa
- [ ] 292 — A PR automatica do inventario semanal nasce sem CI e, com os required checks ativos, nao tem como ser mergeada — onda 8 — Baixa
- [ ] 293 — Atualização automática de dependência vulnerável está desligada num repositório público — onda 8 — Baixa
- [ ] 294 — Doc e teste de integração afirmam um gate de IP no webhook da Lalamove que o código só registra em log — e o teste passa por acaso — onda 8 — Baixa
- [ ] 295 — Dashboard principal mostra o código em inglês do status e some com o ícone do veículo: o mapa de status/ícones do OrdersTable divergiu da cópia usada na página de Pedidos — onda 8 — Baixa
- [ ] 296 — docs/pendencias/P-10 contradiz o codigo atual e o AGENTS.md sobre chaves em scripts/ e sobre a rotacao — onda 8 — Baixa
- [ ] 297 — Ferramental de teste declarado em `dependencies` em vez de `devDependencies` — onda 8 — Baixa
- [ ] 298 — O teste que protege a coordenada do pedido se auto-pula justamente quando o geo-gateway falha — onda 8 — Baixa
- [ ] 299 — Campo CIDR da whitelist aceita qualquer texto e pode quebrar a função de verificação de IP no banco — onda 8 — Baixa
- [ ] 300 — Componente Badge importado e nunca usado na tela de pedidos — onda 8 — Baixa

---

## Achados novos durante a execução

Problema encontrado no caminho **não é corrigido na hora**. Anote aqui, com `arquivo:linha` e uma linha
de impacto, e siga a etapa em curso.

| # | Encontrado durante | Arquivo:linha | O que é | Impacto |
|---|---|---|---|---|
| | | | | |
