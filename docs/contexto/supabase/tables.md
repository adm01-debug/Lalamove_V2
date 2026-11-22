# Tabelas

Um arquivo por tabela em `tables/<schema>/<tabela>.md` (colunas, constraints, índices, RLS/policies, triggers, grants). Métricas de volume em `stats.md`.

| tabela | tipo | RLS | policies | colunas | realtime | comentário |
|---|---|---|---|---|---|---|
| [public.active_tracking](tables/public/active_tracking.md) | table | sim | 5 | 32 | não | Tracking em tempo real dos motoristas: velocidade, heading, ETA, deteccao de parada e desvio de rota. |
| [public.alert_configurations](tables/public/alert_configurations.md) | table | sim | 5 | 33 | não | Configuracoes de alertas por tipo/canal: templates, intervalo minimo, condicoes personalizadas. |
| [public.alert_dedup](tables/public/alert_dedup.md) | table | sim | 1 | 6 | não | Controle de deduplicacao de alertas para evitar envio duplicado no mesmo intervalo. |
| [public.alerts](tables/public/alerts.md) | table | sim | 5 | 15 | não | Alertas do sistema (ROUTE_DEVIATION, DRIVER_STOPPED, LATE_DELIVERY etc) com severidade e status. |
| [public.alerts_sent](tables/public/alerts_sent.md) | table | sim | 4 | 11 | não | Historico de notificacoes enviadas por canal com status, retry e erro. |
| [public.audit_log](tables/public/audit_log.md) | table | sim | 2 | 9 | não | Registro de auditoria de ações |
| [public.auth_logs](tables/public/auth_logs.md) | table | sim | 3 | 9 | sim | Auditoria de autenticacao: IP, user agent e evento de cada acesso. |
| [public.bitrix24_activities](tables/public/bitrix24_activities.md) | table | sim | 4 | 7 | não | Atividades/timeline sincronizadas com o CRM Bitrix24. |
| [public.bitrix24_spa_sync](tables/public/bitrix24_spa_sync.md) | table | sim | 1 | 10 | não | Sincronizacao do pedido com o SPA 1690 do Bitrix24 (crm.item.*). Substitui bitrix24_sync (modelo de deals). |
| [public.bitrix24_stage_mappings](tables/public/bitrix24_stage_mappings.md) | table | sim | 4 | 5 | não | Mapeamento de estagios entre o sistema e os funis do Bitrix24. |
| [public.bitrix24_sync](tables/public/bitrix24_sync.md) | table | sim | 4 | 9 | não | Registro de sincronizacao de deals com o Bitrix24. |
| [public.bitrix24_tokens](tables/public/bitrix24_tokens.md) | table | sim | 4 | 7 | não | Tokens OAuth2 do Bitrix24 com refresh. |
| [public.blocked_ips](tables/public/blocked_ips.md) | table | sim | 2 | 11 | sim | IPs bloqueados por rate limit/seguranca com motivo e expiracao. |
| [public.cache_refresh_log](tables/public/cache_refresh_log.md) | table | sim | 1 | 9 | não | Historico de refresh das materialized views de cache (inicio, fim, duracao, erro). |
| [public.contacts](tables/public/contacts.md) | table | sim | 1 | 10 | não | Contatos cadastrados (empresas/parceiros) para integracao externa. |
| [public.contract_version_usage](tables/public/contract_version_usage.md) | table | sim | 1 | 8 | não | Uso de versoes de contrato por periodo. |
| [public.contract_version_usage_monthly](tables/public/contract_version_usage_monthly.md) | table | sim | 1 | 9 | não | Agregado mensal de uso de versoes de contrato. |
| [public.cron_job_logs](tables/public/cron_job_logs.md) | table | sim | 1 | 9 | não | Historico de execucoes dos cron jobs do sistema com duracao e resultado. |
| [public.driver_approval_queue](tables/public/driver_approval_queue.md) | table | sim | 5 | 14 | não | Fila de aprovacao de motoristas com score de risco, prioridade e status. |
| [public.driver_evaluations](tables/public/driver_evaluations.md) | table | sim | 5 | 19 | não | Historico de avaliacoes de risco dos motoristas com fatores detalhados. |
| [public.driver_incidents](tables/public/driver_incidents.md) | table | sim | 5 | 13 | não | Incidentes registrados por motorista (desvio de rota, parada longa, atraso, dano). |
| [public.driver_locations](tables/public/driver_locations.md) | table | sim | 5 | 9 | não | Historico detalhado de posicoes GPS dos motoristas. |
| [public.drivers](tables/public/drivers.md) | table | sim | 6 | 32 | não | Cadastro de motoristas com metricas de performance e score de risco. |
| [public.email_verifications](tables/public/email_verifications.md) | table | sim | 4 | 7 | não | Tokens de verificacao de email com expiracao. |
| [public.feature_flags](tables/public/feature_flags.md) | table | sim | 2 | 7 | não | Flags de feature para ativacao/desativacao de funcionalidades. |
| [public.geo_blocks](tables/public/geo_blocks.md) | table | sim | 5 | 10 | não | Bloqueios geograficos por pais (permanente ou temporario). |
| [public.geo_budget](tables/public/geo_budget.md) | table | sim | 2 | 7 | não | Orcamento mensal por provedor; geo_budget_status() informa bloqueio/aviso. |
| [public.geo_cache](tables/public/geo_cache.md) | table | sim | 0 | 6 | não | Cache de respostas de geocode/rota/static por hash de request (TTL por funcao). |
| [public.geo_defaults](tables/public/geo_defaults.md) | table | sim | 2 | 12 | não | Parametros globais de geofence/notificacao (raio, ETA, horario silencioso). |
| [public.geo_price_list](tables/public/geo_price_list.md) | table | sim | 2 | 6 | não |  |
| [public.geo_settings](tables/public/geo_settings.md) | table | sim | 2 | 6 | não | Provedor de mapas por funcao (google\|mapbox\|off) com fallback. Admin edita em /settings/maps. |
| [public.geo_usage](tables/public/geo_usage.md) | table | sim | 1 | 7 | não | Uso diario de APIs de mapa por provedor/funcao/sku com custo estimado (USD). |
| [public.ip_whitelist](tables/public/ip_whitelist.md) | table | sim | 5 | 8 | não | IPs autorizados com CIDR para acesso privilegiado. |
| [public.job_queue](tables/public/job_queue.md) | table | sim | 2 | 17 | não | Fila assincrona (webhook, notificacao, POD, sync). Recriada no baseline 2026-11 por drift: estava no ledger mas ausente na producao. |
| [public.job_queue_processing_log](tables/public/job_queue_processing_log.md) | table | sim | 1 | 8 | não | Historico das rodadas do processador de fila (processados, sucesso, falha, duracao). |
| [public.lalamove_order_replacements](tables/public/lalamove_order_replacements.md) | table | sim | 2 | 7 | sim | Registro de pedidos de reposicao/reescolha na Lalamove. |
| [public.lalamove_orders](tables/public/lalamove_orders.md) | table | sim | 6 | 72 | não | Pedidos Lalamove com campos customizados e status em tempo real. |
| [public.lalamove_priority_fee_history](tables/public/lalamove_priority_fee_history.md) | table | sim | 2 | 9 | não | Historico de taxas de prioridade aplicadas aos pedidos Lalamove. |
| [public.lalamove_rate_limits](tables/public/lalamove_rate_limits.md) | table | sim | 2 | 12 | não | Controle de rate limit das chamadas a API Lalamove. |
| [public.lalamove_status_history](tables/public/lalamove_status_history.md) | table | sim | 5 | 9 | não | Historico de mudancas de status de cada pedido Lalamove. |
| [public.lalamove_stop_proofs](tables/public/lalamove_stop_proofs.md) | table | sim | 5 | 14 | sim | Comprovantes (foto/assinatura) das paradas dos pedidos Lalamove. |
| [public.lalamove_stops](tables/public/lalamove_stops.md) | table | sim | 5 | 20 | não | Paradas/stops dos pedidos Lalamove com endereco e horarios. |
| [public.lalamove_uapi_sessions](tables/public/lalamove_uapi_sessions.md) | table | sim | 1 | 13 | não | Sessoes da Unified API da Lalamove (token e expiracao). |
| [public.lalamove_webhook_config](tables/public/lalamove_webhook_config.md) | table | sim | 1 | 9 | não | URL de webhook registrada na Lalamove por ambiente (GET /v3/webhook retorna 405, mantemos o registro). |
| [public.login_attempts](tables/public/login_attempts.md) | table | sim | 4 | 11 | não | Tentativas de login com IP e resultado para lockout de conta. |
| [public.map_settings_overrides](tables/public/map_settings_overrides.md) | table | sim | 1 | 8 | não | Overrides de configuracao de mapa por usuario/contexto. |
| [public.mcp_diagnostics_grants](tables/public/mcp_diagnostics_grants.md) | table | sim | 1 | 7 | não | Grants de acesso a diagnosticos via MCP (query_telemetry). |
| [public.mfa_sessions](tables/public/mfa_sessions.md) | table | sim | 5 | 9 | sim | Sessoes MFA (TOTP) registradas por usuario. |
| [public.new_device_alerts](tables/public/new_device_alerts.md) | table | sim | 4 | 8 | sim | Alertas de novo dispositivo detectado no login. |
| [public.notification_optouts](tables/public/notification_optouts.md) | table | sim | 2 | 4 | não | Telefones que pediram para nao receber avisos geo (etapa 60). send-notification consulta antes de enviar. |
| [public.order_geo_events](tables/public/order_geo_events.md) | table | sim | 1 | 14 | não | Eventos geograficos por pedido (aproximando/chegou coleta e entrega, atraso) - 1 por (pedido, evento, parada). |
| [public.password_reset_requests](tables/public/password_reset_requests.md) | table | sim | 3 | 11 | não | Requisicoes de reset de senha com aprovacao de admin. |
| [public.password_reset_tokens](tables/public/password_reset_tokens.md) | table | sim | 4 | 7 | não | Tokens de reset de senha com expiracao. |
| [public.permissions](tables/public/permissions.md) | table | sim | 4 | 6 | não | Permissoes granulares do sistema por modulo e acao. |
| [public.query_telemetry](tables/public/query_telemetry.md) | table | sim | 3 | 13 | não | Telemetria de consultas (logica/duracao/erro) para auditoria. |
| [public.rate_limit_logs](tables/public/rate_limit_logs.md) | table | sim | 2 | 11 | não | Log de requisicoes por endpoint para monitoramento de rate limiting. |
| [public.region_cache](tables/public/region_cache.md) | table | sim | 2 | 4 | não | Cache por regiao para performance de consultas. |
| [public.report_presets](tables/public/report_presets.md) | table | sim | 1 | 6 | sim | Presets de relatorios salvos pelos usuarios. |
| [public.risk_rules](tables/public/risk_rules.md) | table | sim | 5 | 8 | não | Regras configuraveis para calculo de risk score dos motoristas. |
| [public.role_permissions](tables/public/role_permissions.md) | table | sim | 5 | 4 | não | Associacao entre roles e permissoes (RBAC). |
| [public.runtime_error_logs](tables/public/runtime_error_logs.md) | table | sim | 4 | 21 | não | Logs de erros em runtime capturados pelo monitoramento. |
| [public.security_test_logs](tables/public/security_test_logs.md) | table | sim | 1 | 8 | não | Registro de testes de seguranca executados. |
| [public.tracking_events](tables/public/tracking_events.md) | partitioned | sim | 1 | 10 | não | Eventos de tracking particionados por mes (particionamento). |
| [public.tracking_events_default](tables/public/tracking_events_default.md) | table (partição) | sim | 1 | 10 | não | Particao padrao da tabela tracking_events. |
| [public.tracking_events_y2026m05](tables/public/tracking_events_y2026m05.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m06](tables/public/tracking_events_y2026m06.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m07](tables/public/tracking_events_y2026m07.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m08](tables/public/tracking_events_y2026m08.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m09](tables/public/tracking_events_y2026m09.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m10](tables/public/tracking_events_y2026m10.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m11](tables/public/tracking_events_y2026m11.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m12](tables/public/tracking_events_y2026m12.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2027m01](tables/public/tracking_events_y2027m01.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.user_devices](tables/public/user_devices.md) | table | sim | 5 | 14 | não | Dispositivos registrados dos usuarios para deteccao de novo login. |
| [public.user_passkeys](tables/public/user_passkeys.md) | table | sim | 4 | 11 | não | Chaves WebAuthn/passkeys registradas por usuario. |
| [public.user_roles](tables/public/user_roles.md) | table | sim | 4 | 10 | não | Roles atribuidas a cada usuario (RBAC). |
| [public.webauthn_challenges](tables/public/webauthn_challenges.md) | table | sim | 5 | 6 | não | Challenges WebAuthn para fluxo de autenticacao sem senha. |
| [public.webhook_events](tables/public/webhook_events.md) | table | sim | 4 | 9 | não | Log completo de todos webhooks recebidos do Lalamove. |
