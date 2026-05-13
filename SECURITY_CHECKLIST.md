# Security Checklist - Lalamove Guardian

## Desenvolvimento

### Código
- [ ] Nenhuma senha hardcoded
- [ ] `.env` no `.gitignore`
- [ ] Secrets no Supabase
- [ ] TypeScript strict mode
- [ ] ESLint security rules

### Dependências
- [ ] `npm audit` sem HIGH/CRITICAL
- [ ] Dependabot habilitado
- [ ] Lockfile commitado

### Git
- [ ] Pre-commit hook ativo
- [ ] Branch protection em `main`
- [ ] Require PR reviews

## Banco de Dados

### RLS
- [ ] RLS habilitado em todas tabelas
- [ ] Políticas testadas
- [ ] Nenhum `USING (true)` em prod

### Backups
- [ ] Backup automático diário
- [ ] Teste de restore mensal
- [ ] Backups seguros

## API e Integrações

### Autenticação
- [ ] HMAC implementado (Lalamove)
- [ ] OAuth2 seguro (Bitrix24)
- [ ] API keys rotacionadas

### Rate Limiting
- [ ] Webhooks limitados (100/min)
- [ ] API limitada
- [ ] Retry com backoff

### HTTPS
- [ ] HTTPS only
- [ ] HSTS header
- [ ] Certificados válidos

## Produção

### Infraestrutura
- [ ] Firewall configurado
- [ ] IP whitelist
- [ ] Logs ativos

### Monitoramento
- [ ] Alertas configurados
- [ ] Logs monitorados
- [ ] Uptime monitoring

### Compliance
- [ ] LGPD compliance
- [ ] Dados criptografados
- [ ] Política de retenção

## Pós-Incidente

- [ ] Procedimento documentado
- [ ] Contatos atualizados
- [ ] Plano de comunicação

---

**Mantido por:** Security Team
