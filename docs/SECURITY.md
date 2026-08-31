# 🔒 Security - Lalamove Guardian

## Variáveis Sensíveis

### ❌ NUNCA commitar:
```
.env
.env.local
*.pem
*.key
```

### ✅ Usar Supabase Secrets:
```bash
supabase secrets set LALAMOVE_API_KEY=xxx
supabase secrets set LALAMOVE_API_SECRET=yyy
```

## Row Level Security (RLS)

### Verificar RLS:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### Políticas Obrigatórias:
```sql
CREATE POLICY "drivers_select" ON drivers
FOR SELECT USING (auth.uid() IS NOT NULL);
```

## Rate Limiting

### Webhook:
- 100 requests/min
- Bloqueio 5min se exceder

### API:
```typescript
const { data } = useQuery({
  queryKey: ['drivers'],
  retry: 3,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000)
});
```

## Autenticação

### HMAC (Lalamove):
```typescript
const signature = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');
```

### OAuth2 (Bitrix24):
- Tokens em Supabase Secrets
- Refresh automático

## Checklist

### Desenvolvimento
- [ ] `.env` no `.gitignore`
- [ ] Secrets no Supabase
- [ ] RLS habilitado
- [ ] Sem senhas hardcoded

### Produção
- [ ] HTTPS ativo
- [ ] Rate limiting configurado
- [ ] Logs sem dados sensíveis
- [ ] Backups automáticos
- [ ] 2FA habilitado

## Vulnerabilidades

**NÃO criar issue pública**

Email: security@promobrindes.com

---

**Mantido por:** Security Team
