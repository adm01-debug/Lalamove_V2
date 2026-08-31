# 🚀 Deployment - Lalamove Guardian

**Versão:** 1.5.0

## Ambientes

### Development
- **URL:** http://localhost:54321
- **Comando:** `supabase start`

### Production
- **URL:** https://lalamove-guardian.lovable.app
- **Branch:** `main`
- **Auto-deploy:** ✅ Automático via Lovable

## Deploy Process

### 1. Commit e Push
```bash
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
```

### 2. Auto-deploy
Lovable sincroniza automaticamente:
- Frontend → Build + publish
- Edge Functions → Deploy
- Migrations → Aplicadas

### 3. Verificação
```bash
curl https://lalamove-guardian.lovable.app/health
```

## Migrations

### Criar Migration
```bash
supabase migration new add_new_table
nano supabase/migrations/xxx_add_new_table.sql
supabase db reset  # Aplicar local
git push  # Deploy automático
```

### Verificar em Produção
```sql
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC LIMIT 5;
```

## Secrets

### Configurar
```bash
supabase secrets set LALAMOVE_API_KEY=xxx
supabase secrets set LALAMOVE_API_SECRET=yyy
```

### Listar
```bash
supabase secrets list
```

## Rollback

### Via Git
```bash
git revert HEAD
git push origin main
```

### Via Lovable UI
1. Acessar "Deployments"
2. Selecionar versão anterior
3. "Redeploy"

## Checklist Pós-Deploy

- [ ] Logs sem erros (1h)
- [ ] Webhooks funcionando
- [ ] Realtime conectado
- [ ] Edge Functions OK
- [ ] Métricas normais

---

**Mantido por:** DevOps Team
