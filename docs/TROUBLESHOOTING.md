# 🔧 Troubleshooting - Lalamove Guardian

**Versão:** 1.5.0

## Problemas Comuns

### 1. Edge Function Não Responde

**Sintomas:**
- Timeout (30s)
- Error 500
- Logs vazios

**Soluções:**

A) Verificar logs:
```bash
supabase functions logs evaluate-driver --tail
```

B) Testar localmente:
```bash
supabase functions serve evaluate-driver
curl -X POST http://localhost:54321/functions/v1/evaluate-driver \
  -H "Authorization: Bearer xxx" \
  -d '{"driverId":"xxx"}'
```

C) Redeploy:
```bash
supabase functions deploy evaluate-driver
```

---

### 2. Webhook Não Processa

**Debug:**

A) Verificar webhook_events:
```sql
SELECT * FROM webhook_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

B) Verificar signature:
```typescript
console.log('Received:', headers.get('x-lalamove-signature'));
console.log('Calculated:', calculatedSignature);
```

C) Testar manualmente:
```bash
curl -X POST https://xxx.supabase.co/functions/v1/lalamove-webhook \
  -H "Content-Type: application/json" \
  -d '{"eventType":"DRIVER_ASSIGNED","orderId":"test"}'
```

---

### 3. Realtime Não Atualiza

**Soluções:**

A) Verificar subscription:
```typescript
console.log('Status:', supabase.channel('approvals').state);
```

B) Reconectar:
```typescript
supabase.removeAllChannels();
// Recarregar página
```

C) Verificar RLS:
```sql
SELECT * FROM pg_policies WHERE tablename = 'driver_approval_queue';
```

---

### 4. Mapa Não Carrega

**Soluções:**

A) Verificar token:
```typescript
console.log(import.meta.env.VITE_MAPBOX_TOKEN);
```

B) Verificar edge function:
```bash
curl https://xxx.supabase.co/functions/v1/get-mapbox-token
```

C) Limpar cache:
```bash
Ctrl + Shift + R (Windows)
Cmd + Shift + R (Mac)
```

---

### 5. Aprovação Não Processa

**Debug:**

A) Verificar banco:
```sql
SELECT * FROM driver_approval_queue WHERE id = 'xxx';
SELECT status FROM drivers WHERE id = 'yyy';
```

B) Executar manualmente:
```sql
UPDATE driver_approval_queue 
SET status = 'APPROVED', reviewed_at = NOW()
WHERE id = 'xxx';

UPDATE drivers SET status = 'APPROVED' WHERE id = 'yyy';
```

---

## Queries Úteis

### Últimas Avaliações
```sql
SELECT 
  e.driver_id,
  d.name,
  e.risk_score,
  e.approved,
  e.evaluated_at
FROM driver_evaluations e
JOIN drivers d ON d.id = e.driver_id
ORDER BY e.evaluated_at DESC
LIMIT 10;
```

### Aprovações Pendentes
```sql
SELECT 
  id,
  driver_name,
  risk_score,
  requested_at,
  NOW() - requested_at AS waiting_time
FROM driver_approval_queue
WHERE status = 'PENDING'
ORDER BY requested_at ASC;
```

### Alertas Não Lidos
```sql
SELECT type, severity, message, created_at
FROM alerts
WHERE is_read = false
ORDER BY created_at DESC;
```

---

## Contato Suporte

**Emergência (P0):**
- Slack: #lalamove-critical

**Normal (P1-P3):**
- Email: tech@promobrindes.com
- Slack: #lalamove-support

---

**Mantido por:** Support Team
