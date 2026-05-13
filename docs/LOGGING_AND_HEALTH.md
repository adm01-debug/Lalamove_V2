# 📊 Logging & Health Checks

Documentação completa do sistema de logging estruturado e monitoramento de saúde do sistema.

---

## 📋 Índice

1. [Logger Aprimorado](#logger-aprimorado)
2. [Health Checks Expandidos](#health-checks-expandidos)
3. [Uso](#uso)
4. [Monitoramento](#monitoramento)
5. [Troubleshooting](#troubleshooting)

---

## 📝 Logger Aprimorado

### Características

✅ **Níveis configuráveis** (debug, info, warn, error, critical)  
✅ **Contexto rico** (userId, requestId, source, metadata)  
✅ **Batch processing** (agrupa logs antes de enviar ao banco)  
✅ **Performance tracking** (mede duração de operações)  
✅ **Alertas críticos** (notifica equipe via Slack/Email)  
✅ **Console formatado** (cores e emojis para facilitar debug)

---

### Uso Básico

```typescript
import { logger } from '@/utils/logger-enhanced';

// Diferentes níveis
logger.debug('Debug info', { metadata: { key: 'value' } });
logger.info('Process started');
logger.warn('High memory usage', { metadata: { usage: '85%' } });
logger.error('Failed to save', { metadata: { error: err.message } });
logger.critical('System down!');  // ⚠️ Envia alerta para equipe
```

---

### Contexto e Metadata

```typescript
logger.info('User logged in', {
  source: 'auth-service',
  userId: 'user-123',
  requestId: 'req-abc',
  metadata: {
    ip: '192.168.1.1',
    browser: 'Chrome',
    loginMethod: 'google'
  }
});

// Log resultante no banco:
// {
//   level: 'info',
//   message: 'User logged in',
//   source: 'auth-service',
//   user_id: 'user-123',
//   metadata: {
//     ip: '192.168.1.1',
//     browser: 'Chrome',
//     loginMethod: 'google',
//     timestamp: '2025-12-26T15:00:00Z',
//     env: 'production'
//   }
// }
```

---

### Logger com Contexto Pré-definido

```typescript
// Criar logger específico para um módulo
const driverLogger = logger.withContext({
  source: 'driver-service',
  metadata: { module: 'evaluation' }
});

// Todos os logs já terão esse contexto
driverLogger.info('Evaluating driver');  // source = 'driver-service'
driverLogger.error('Evaluation failed'); // source = 'driver-service'
```

---

### Medição de Performance

**Método 1 - PerformanceLogger:**
```typescript
import { PerformanceLogger } from '@/utils/logger-enhanced';

async function complexOperation() {
  const perf = new PerformanceLogger(logger, 'complexOperation');
  
  // Executar operação...
  await processData();
  
  perf.end();  // Loga duração automaticamente
}

// Log: "complexOperation completed" (duration: 1234ms)
```

**Método 2 - measurePerformance helper:**
```typescript
import { measurePerformance } from '@/utils/logger-enhanced';

const result = await measurePerformance(
  'Database query',
  async () => {
    return await supabase.from('drivers').select('*');
  },
  { source: 'database' }
);

// Loga automaticamente com duração
```

**Método 3 - Decorator (classes):**
```typescript
import { LogMethod } from '@/utils/logger-enhanced';

class DriverService {
  @LogMethod('DriverService.evaluate')
  async evaluate(driverId: string) {
    // Método automaticamente logado com duração
    const result = await calculateRisk(driverId);
    return result;
  }
}
```

---

### Batch Processing

O logger agrupa logs antes de enviar ao banco para otimizar performance:

```typescript
// Configuração (já definida):
BATCH_SIZE = 10      // Enviar quando atingir 10 logs
BATCH_DELAY = 5000   // Ou após 5 segundos

// Logs são agrupados automaticamente
logger.info('Log 1');
logger.info('Log 2');
logger.info('Log 3');
// ... após 10 logs ou 5s, todos são enviados de uma vez

// Forçar envio imediato (se necessário):
await logger.flush();
```

---

### Níveis de Log

| Nível | Quando Usar | Console | Banco | Alerta |
|-------|-------------|---------|-------|---------|
| **debug** | Desenvolvimento, detalhes técnicos | ✅ | ❌ | ❌ |
| **info** | Eventos normais, fluxo do sistema | ✅ | ✅ | ❌ |
| **warn** | Situações anormais mas não críticas | ✅ | ✅ | ❌ |
| **error** | Erros que precisam atenção | ✅ | ✅ | ❌ |
| **critical** | Sistema em risco, ação urgente | ✅ | ✅ | ✅ |

---

### Configurar Nível Mínimo

```typescript
import { logger } from '@/utils/logger-enhanced';

// Desenvolvimento: mostrar tudo
logger.setLevel('debug');

// Produção: apenas info e acima
logger.setLevel('info');

// Debug específico: apenas erros
logger.setLevel('error');
```

Configuração automática por ambiente:
- **DEV:** `debug` (mostra tudo)
- **PROD:** `info` (omite debug)

---

## 🏥 Health Checks Expandidos

### Componentes Monitorados

#### Core Components
1. **Frontend** - React app responsiveness
2. **Database** - PostgreSQL latency e conectividade
3. **Edge Functions** - Serverless functions health
4. **Realtime** - WebSocket connections

#### Backend Systems
5. **Cache** - Materialized Views freshness
6. **Queue** - Job queue backlog e failures

#### External APIs
7. **Lalamove** - Delivery API
8. **Bitrix24** - CRM webhook
9. **Evolution API** - WhatsApp gateway
10. **Mapbox** - Maps & geocoding

---

### Uso

```typescript
import { useSystemHealthExpanded } from '@/hooks/useSystemHealthExpanded';

function HealthDashboard() {
  const { data: health, isLoading } = useSystemHealthExpanded();
  
  if (isLoading) return <Loader />;
  
  return (
    <div>
      <h1>Overall Status: {health.overall}</h1>
      
      <h2>Database</h2>
      <p>Status: {health.database.status}</p>
      <p>Latency: {health.database.latency}ms</p>
      
      <h2>External APIs</h2>
      <p>Lalamove: {health.externalAPIs.lalamove.status}</p>
      <p>Bitrix24: {health.externalAPIs.bitrix24.status}</p>
    </div>
  );
}
```

---

### Status Types

```typescript
type HealthStatus = 'ok' | 'degraded' | 'down' | 'unknown';

// ok       - Funcionando normalmente
// degraded - Funcionando com performance reduzida
// down     - Não está respondendo
// unknown  - Não foi possível verificar
```

---

### Thresholds de Latência

| Componente | OK | Degraded | Down |
|------------|------|----------|------|
| **Database** | <1000ms | 1000-2000ms | >2000ms ou erro |
| **Edge Functions** | <2000ms | 2000-5000ms | >5000ms ou erro |
| **External APIs** | <5000ms | 5000-10000ms | >10000ms ou erro |

---

### Overall Status Logic

```typescript
// down - Se Database ou Edge Functions estão down
if (database === 'down' || edgeFunctions === 'down') {
  overall = 'down';
}

// degraded - Se algum componente está degraded ou down (não crítico)
else if (anyComponent === 'degraded' || anyNonCritical === 'down') {
  overall = 'degraded';
}

// ok - Todos componentes estão ok
else {
  overall = 'ok';
}
```

---

### Health Check de APIs Externas

Para proteger API keys, os checks de APIs externas são feitos via Edge Function:

```typescript
// Frontend (seguro)
const lalamove = await checkLalamoveAPI();

// Internamente chama:
const { data } = await supabase.functions.invoke('check-external-api', {
  body: { service: 'lalamove' }
});

// Edge Function (com acesso às secrets)
async function checkLalamove() {
  const response = await fetch('https://rest.lalamove.com/v3/ping', {
    headers: { Authorization: `Bearer ${LALAMOVE_TOKEN}` }
  });
  
  return {
    status: response.ok ? 'ok' : 'down',
    message: response.statusText
  };
}
```

---

## 📊 Monitoramento

### Dashboard (/system-health-expanded)

**Visualização:**
- 🟢 Overall system status (ok/degraded/down)
- 📊 Core components (4 cards)
- 🔧 Backend systems (2 cards)
- 🌐 External APIs (4 cards)
- 📈 Latency de cada componente
- 🕐 Timestamp do último check

**Auto-refresh:** A cada 30 segundos

---

### Queries SQL Úteis

**Logs recentes por nível:**
```sql
SELECT 
  level,
  COUNT(*) as count,
  MAX(created_at) as last_occurrence
FROM system_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY level
ORDER BY count DESC;
```

**Logs de erros:**
```sql
SELECT *
FROM system_logs
WHERE level IN ('error', 'critical')
ORDER BY created_at DESC
LIMIT 50;
```

**Logs por source:**
```sql
SELECT 
  source,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE level = 'error') as errors
FROM system_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY total DESC;
```

**Duração média de operações:**
```sql
SELECT 
  metadata->>'operation' as operation,
  AVG((metadata->>'duration')::NUMERIC) as avg_duration_ms,
  COUNT(*) as count
FROM system_logs
WHERE metadata->>'duration' IS NOT NULL
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY metadata->>'operation'
ORDER BY avg_duration_ms DESC;
```

---

## 🔧 Troubleshooting

### Problema: Logs não aparecem no banco

**Verificar:**
1. Ambiente está em PROD?
   ```typescript
   console.log(import.meta.env.PROD);  // Deve ser true
   ```

2. Batch está sendo enviado?
   ```typescript
   await logger.flush();  // Forçar envio
   ```

3. Tabela system_logs existe?
   ```sql
   SELECT * FROM system_logs LIMIT 1;
   ```

---

### Problema: Health check reportando "down" incorretamente

**Database:**
```sql
-- Testar query
SELECT id FROM drivers LIMIT 1;

-- Verificar latência
EXPLAIN ANALYZE SELECT id FROM drivers LIMIT 1;
```

**Edge Functions:**
```bash
# Testar diretamente
curl -X POST https://xxx.supabase.co/functions/v1/get-mapbox-token \
  -H "Authorization: Bearer xxx" \
  -d '{"healthCheck": true}'
```

**External APIs:**
```bash
# Verificar secrets
echo $LALAMOVE_API_KEY
echo $BITRIX24_WEBHOOK_URL
```

---

### Problema: Alertas críticos não estão sendo enviados

**Verificar:**
1. Edge Function send-notification existe?
2. Slack webhook configurado?
3. Logs estão sendo marcados como critical?

```typescript
// Testar
logger.critical('Test alert', {
  metadata: { test: true }
});
```

---

## 🚀 Melhores Práticas

### Logging

**✅ BOM:**
```typescript
logger.info('Driver evaluated', {
  source: 'driver-evaluator',
  metadata: {
    driverId: '123',
    riskScore: 4.5,
    decision: 'APPROVED'
  }
});
```

**❌ RUIM:**
```typescript
console.log('Driver 123 evaluated with score 4.5 and approved');
```

---

### Performance Tracking

**✅ BOM:**
```typescript
await measurePerformance('calculateRisk', async () => {
  return await calculateRisk(driverId);
});
```

**❌ RUIM:**
```typescript
const start = Date.now();
const result = await calculateRisk(driverId);
console.log('Duration:', Date.now() - start);
```

---

### Health Checks

**✅ BOM:**
```typescript
// Auto-refresh a cada 30s
const { data } = useSystemHealthExpanded(30000);
```

**❌ RUIM:**
```typescript
// Refresh manual sempre
useEffect(() => {
  checkHealth();
}, []);
```

---

## 📈 Métricas

### Logger Performance

- **Batch size:** 10 logs
- **Batch delay:** 5 segundos
- **Overhead:** <1ms por log (console)
- **Throughput:** ~2000 logs/minuto

### Health Checks

- **Interval:** 30 segundos
- **Duration:** ~2-5 segundos (total)
- **Parallel checks:** 9 componentes simultaneamente
- **Timeout:** 5 segundos por API externa

---

**Versão:** 1.0.0  
**Última atualização:** 26 de dezembro de 2025
