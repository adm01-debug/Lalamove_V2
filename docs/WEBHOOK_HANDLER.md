# 📡 Webhook Handler - Lalamove Guardian

**Versão:** 1.5.0  
**Última atualização:** 25 de dezembro de 2025

## Configuração

### URL do Webhook
```
https://[project-ref].supabase.co/functions/v1/lalamove-webhook
```

### Eventos Registrados
- `ORDER_STATUS_CHANGED`
- `DRIVER_ASSIGNED` ⭐ (Trigger evaluate-driver)
- `DRIVER_LOCATION_UPDATE`
- `POD_UPLOADED`

## Validação HMAC

```typescript
const signature = crypto
  .createHmac('sha256', LALAMOVE_SECRET)
  .update(JSON.stringify(requestBody))
  .digest('hex');

if (signature !== headers['x-lalamove-signature']) {
  return new Response('Unauthorized', { status: 401 });
}
```

## Rate Limiting

- **Limite:** 100 requests/min por IP
- **Bloqueio:** 5 minutos se exceder
- **IPs confiáveis:** Whitelist AWS Singapore

```typescript
// Trusted IPs (Lalamove AWS)
const trustedIPs = [
  '52.76.0.0/16',
  '54.251.0.0/16',
  '13.228.0.0/16',
  '18.136.0.0/16'
];
```

## Processamento por Evento

### DRIVER_ASSIGNED

**Payload:**
```json
{
  "eventType": "DRIVER_ASSIGNED",
  "orderId": "ORDER123",
  "driverId": "DRIVER456",
  "driverName": "João Silva",
  "timestamp": "2025-12-25T10:00:00Z"
}
```

**Ações:**
1. Criar/atualizar driver
2. Vincular order
3. **Disparar evaluate-driver**
4. Broadcast via Realtime

### DRIVER_LOCATION_UPDATE

**Payload:**
```json
{
  "eventType": "DRIVER_LOCATION_UPDATE",
  "orderId": "ORDER123",
  "latitude": -23.5489,
  "longitude": -46.6388,
  "speed": 35.5,
  "heading": 180
}
```

**Ações:**
1. Update active_tracking
2. Insert driver_locations (histórico)
3. Verificar desvio de rota (>1km)
4. Verificar parada prolongada (>10min)
5. Disparar alertas se necessário

### ORDER_STATUS_CHANGED

**Ações:**
1. Update lalamove_orders
2. Insert status_history
3. Sync com Bitrix24 (se configurado)

## Monitoramento

**Logs:**
```typescript
console.log({
  event: 'webhook_received',
  type: payload.eventType,
  orderId: payload.orderId,
  processed: true,
  timestamp: new Date()
});
```

**Métricas:**
- Total webhooks/dia
- Taxa de erro
- Latência média
- Eventos por tipo

## Troubleshooting

**Webhook não processa:**

1. Verificar logs:
```bash
supabase functions logs lalamove-webhook --tail
```

2. Verificar signature:
```sql
SELECT * FROM webhook_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

3. Testar manualmente:
```bash
curl -X POST https://[project].supabase.co/functions/v1/lalamove-webhook \
  -H "Content-Type: application/json" \
  -d '{"eventType":"DRIVER_ASSIGNED","orderId":"TEST"}'
```

---

**Mantido por:** DevOps Team
