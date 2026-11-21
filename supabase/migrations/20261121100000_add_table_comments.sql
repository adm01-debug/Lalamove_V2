-- P-13: COMMENT ON TABLE para as 55 tabelas public sem documentacao de schema
-- Descoberto na analise exaustiva planejado vs implementado (P-12, 2026-11-21).
-- Migration aditiva: apenas adiciona comentarios; sem DROP/REVOKE/rename.
-- Protocolo Fase 2: aditiva pode ir sem aprovacao.

COMMENT ON TABLE public.active_tracking IS 'Tracking em tempo real dos motoristas: velocidade, heading, ETA, deteccao de parada e desvio de rota.';
COMMENT ON TABLE public.alert_configurations IS 'Configuracoes de alertas por tipo/canal: templates, intervalo minimo, condicoes personalizadas.';
COMMENT ON TABLE public.alert_dedup IS 'Controle de deduplicacao de alertas para evitar envio duplicado no mesmo intervalo.';
COMMENT ON TABLE public.alerts IS 'Alertas do sistema (ROUTE_DEVIATION, DRIVER_STOPPED, LATE_DELIVERY etc) com severidade e status.';
COMMENT ON TABLE public.alerts_sent IS 'Historico de notificacoes enviadas por canal com status, retry e erro.';
COMMENT ON TABLE public.auth_logs IS 'Auditoria de autenticacao: IP, user agent e evento de cada acesso.';
COMMENT ON TABLE public.bitrix24_activities IS 'Atividades/timeline sincronizadas com o CRM Bitrix24.';
COMMENT ON TABLE public.bitrix24_stage_mappings IS 'Mapeamento de estagios entre o sistema e os funis do Bitrix24.';
COMMENT ON TABLE public.bitrix24_sync IS 'Registro de sincronizacao de deals com o Bitrix24.';
COMMENT ON TABLE public.bitrix24_tokens IS 'Tokens OAuth2 do Bitrix24 com refresh.';
COMMENT ON TABLE public.blocked_ips IS 'IPs bloqueados por rate limit/seguranca com motivo e expiracao.';
COMMENT ON TABLE public.contacts IS 'Contatos cadastrados (empresas/parceiros) para integracao externa.';
COMMENT ON TABLE public.contract_version_usage IS 'Uso de versoes de contrato por periodo.';
COMMENT ON TABLE public.contract_version_usage_monthly IS 'Agregado mensal de uso de versoes de contrato.';
COMMENT ON TABLE public.cron_job_logs IS 'Historico de execucoes dos cron jobs do sistema com duracao e resultado.';
COMMENT ON TABLE public.driver_approval_queue IS 'Fila de aprovacao de motoristas com score de risco, prioridade e status.';
COMMENT ON TABLE public.driver_evaluations IS 'Historico de avaliacoes de risco dos motoristas com fatores detalhados.';
COMMENT ON TABLE public.driver_incidents IS 'Incidentes registrados por motorista (desvio de rota, parada longa, atraso, dano).';
COMMENT ON TABLE public.driver_locations IS 'Historico detalhado de posicoes GPS dos motoristas.';
COMMENT ON TABLE public.drivers IS 'Cadastro de motoristas com metricas de performance e score de risco.';
COMMENT ON TABLE public.email_verifications IS 'Tokens de verificacao de email com expiracao.';
COMMENT ON TABLE public.feature_flags IS 'Flags de feature para ativacao/desativacao de funcionalidades.';
COMMENT ON TABLE public.geo_blocks IS 'Bloqueios geograficos por pais (permanente ou temporario).';
COMMENT ON TABLE public.ip_whitelist IS 'IPs autorizados com CIDR para acesso privilegiado.';
COMMENT ON TABLE public.lalamove_order_replacements IS 'Registro de pedidos de reposicao/reescolha na Lalamove.';
COMMENT ON TABLE public.lalamove_orders IS 'Pedidos Lalamove com campos customizados e status em tempo real.';
COMMENT ON TABLE public.lalamove_priority_fee_history IS 'Historico de taxas de prioridade aplicadas aos pedidos Lalamove.';
COMMENT ON TABLE public.lalamove_rate_limits IS 'Controle de rate limit das chamadas a API Lalamove.';
COMMENT ON TABLE public.lalamove_status_history IS 'Historico de mudancas de status de cada pedido Lalamove.';
COMMENT ON TABLE public.lalamove_stop_proofs IS 'Comprovantes (foto/assinatura) das paradas dos pedidos Lalamove.';
COMMENT ON TABLE public.lalamove_stops IS 'Paradas/stops dos pedidos Lalamove com endereco e horarios.';
COMMENT ON TABLE public.lalamove_uapi_sessions IS 'Sessoes da Unified API da Lalamove (token e expiracao).';
COMMENT ON TABLE public.login_attempts IS 'Tentativas de login com IP e resultado para lockout de conta.';
COMMENT ON TABLE public.map_settings_overrides IS 'Overrides de configuracao de mapa por usuario/contexto.';
COMMENT ON TABLE public.mcp_diagnostics_grants IS 'Grants de acesso a diagnosticos via MCP (query_telemetry).';
COMMENT ON TABLE public.mfa_sessions IS 'Sessoes MFA (TOTP) registradas por usuario.';
COMMENT ON TABLE public.new_device_alerts IS 'Alertas de novo dispositivo detectado no login.';
COMMENT ON TABLE public.password_reset_requests IS 'Requisicoes de reset de senha com aprovacao de admin.';
COMMENT ON TABLE public.password_reset_tokens IS 'Tokens de reset de senha com expiracao.';
COMMENT ON TABLE public.permissions IS 'Permissoes granulares do sistema por modulo e acao.';
COMMENT ON TABLE public.query_telemetry IS 'Telemetria de consultas (logica/duracao/erro) para auditoria.';
COMMENT ON TABLE public.rate_limit_logs IS 'Log de requisicoes por endpoint para monitoramento de rate limiting.';
COMMENT ON TABLE public.region_cache IS 'Cache por regiao para performance de consultas.';
COMMENT ON TABLE public.report_presets IS 'Presets de relatorios salvos pelos usuarios.';
COMMENT ON TABLE public.risk_rules IS 'Regras configuraveis para calculo de risk score dos motoristas.';
COMMENT ON TABLE public.role_permissions IS 'Associacao entre roles e permissoes (RBAC).';
COMMENT ON TABLE public.runtime_error_logs IS 'Logs de erros em runtime capturados pelo monitoramento.';
COMMENT ON TABLE public.security_test_logs IS 'Registro de testes de seguranca executados.';
COMMENT ON TABLE public.tracking_events IS 'Eventos de tracking particionados por mes (particionamento).';
COMMENT ON TABLE public.tracking_events_default IS 'Particao padrao da tabela tracking_events.';
COMMENT ON TABLE public.user_devices IS 'Dispositivos registrados dos usuarios para deteccao de novo login.';
COMMENT ON TABLE public.user_passkeys IS 'Chaves WebAuthn/passkeys registradas por usuario.';
COMMENT ON TABLE public.user_roles IS 'Roles atribuidas a cada usuario (RBAC).';
COMMENT ON TABLE public.webauthn_challenges IS 'Challenges WebAuthn para fluxo de autenticacao sem senha.';
COMMENT ON TABLE public.webhook_events IS 'Log completo de todos webhooks recebidos do Lalamove.';

