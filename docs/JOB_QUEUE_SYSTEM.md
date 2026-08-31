# 📦 Sistema de Filas Assíncronas - Job Queue

Sistema de filas assíncronas implementado com PostgreSQL (pg_cron) para processamento confiável de jobs em background.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Tipos de Jobs](#tipos-de-jobs)
4. [Como Usar](#como-usar)
5. [Monitoramento](#monitoramento)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

### Problema Resolvido

**ANTES:**
- ❌ Webhooks processados sincronamente
- ❌ Sem retry automático
- ❌ Timeout de 30s poderia falhar
- ❌ Perda de dados em caso de falha

**DEPOIS:**
- ✅ Processamento assíncrono via fila
- ✅ Retry automático com backoff exponencial
- ✅ Sem timeout (jobs processam até completar)
- ✅ Zero perda de dados

### Características

- **Confiável:** Retry automático até 3 tentativas
- **Escalável:** Processa 10 jobs por minuto (configurável)
- **Monitorável:** Dashboard de métricas e saúde
- **Prioritizado:** Jobs com prioridade 1-10
- **Auditável:** Histórico completo de execuções

---

## 🏗️ Arquitetura

```
┌─────────────────────┐
│   Trigger Event     │
│  (Webhook, etc)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   add_job()         │
│  ├─ type            │
│  ├─ payload         │
│  └─ priority        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   job_queue table   │
│  ├─ PENDING         │
│  ├─ PROCESSING      │
│  ├─ COMPLETED       │
│  └─ FAILED          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   pg_cron job       │
│  (a cada minuto)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ process_job_queue() │
│  Busca 10 jobs      │
│  pendentes          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Edge Function      │
│   job-worker        │
│  └─ Processa job    │
│  └─ Marca completo  │
│  └─ Ou agenda retry │
└─────────────────────┘
```

---

## 🔄 Tipos de Jobs

### 1. webhook
Processar webhooks do Lalamove

**Payload:**
```json
{
  "eventType": "DRIVER_ASSIGNED",
  "driverId": "LAL123",
  "orderId": "ORD456",
  "timestamp": "2025-12-26T10:00:00Z"
}
```

### 2. notification
Enviar notificações (WhatsApp, Slack, Email)

**Payload:**
```json
{
  "channel": "whatsapp",
  "recipient": "+5511999999999",
  "message": "Motorista bloqueado!",
  "priority": "high"
}
```

### 3. evaluation
Avaliar motorista

**Payload:**
```json
{
  "driverId": "uuid",
  "orderId": "uuid",
  "trigger": "manual"
}
```

### 4. bitrix_sync
Sincronizar com Bitrix24

**Payload:**
```json
{
  "entity": "driver",
  "action": "update",
  "data": {...}
}
```

### 5. email
Enviar email

**Payload:**
```json
{
  "to": "email@example.com",
  "subject": "Alerta",
  "body": "Conteúdo"
}
```

### 6. whatsapp
Enviar WhatsApp

**Payload:**
```json
{
  "number": "+5511999999999",
  "text": "Mensagem"
}
```

### 7. slack
Enviar Slack

**Payload:**
```json
{
  "channel": "#alerts",
  "message": "Alerta crítico"
}
```

---

## 💻 Como Usar

### Adicionar Job à Fila

**SQL:**
```sql
-- Adicionar webhook job
SELECT add_job(
  p_type := 'webhook',
  p_payload := '{"eventType": "DRIVER_ASSIGNED", "driverId": "LAL123"}'::jsonb,
  p_priority := 8,
  p_max_attempts := 3
);
```

**TypeScript (Edge Function):**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Adicionar job
const { data, error } = await supabase.rpc('add_job', {
  p_type: 'webhook',
  p_payload: {
    eventType: 'DRIVER_ASSIGNED',
    driverId: 'LAL123',
    orderId: 'ORD456'
  },
  p_priority: 8,
  p_max_attempts: 3,
  p_metadata: {
    source: 'lalamove-webhook',
    timestamp: new Date().toISOString()
  }
});

console.log('Job ID:', data);
```

**React (Frontend):**
```typescript
import { supabase } from '@/integrations/supabase/client';

// Adicionar job (requer permissão de admin)
async function addJobFromFrontend() {
  const { data, error } = await supabase.rpc('add_job', {
    p_type: 'evaluation',
    p_payload: {
      driverId: 'uuid-here',
      trigger: 'manual'
    },
    p_priority: 5
  });
  
  if (error) {
    console.error('Failed to add job:', error);
    return;
  }
  
  console.log('Job added:', data);
}
```

### Verificar Status de um Job

```sql
-- Buscar job por ID
SELECT * FROM job_queue
WHERE id = 'uuid-aqui';

-- Buscar jobs pendentes
SELECT * FROM job_queue
WHERE status = 'PENDING'
ORDER BY priority DESC, created_at ASC
LIMIT 10;

-- Buscar jobs falhados
SELECT * FROM job_queue
WHERE status = 'FAILED'
ORDER BY created_at DESC;
```

### Cancelar Job

```sql
SELECT cancel_job('uuid-do-job');
```

---

## 📊 Monitoramento

### Estatísticas da Fila

```sql
-- Ver estatísticas gerais
SELECT * FROM get_queue_stats();
```

**Retorna:**
```
total_jobs       | 1523
pending_jobs     | 12
processing_jobs  | 3
completed_jobs   | 1480
failed_jobs      | 28
cancelled_jobs   | 0
avg_attempts     | 1.15
oldest_pending   | 2025-12-26 10:05:23
jobs_by_type     | {"webhook": {...}, "notification": {...}}
```

### Saúde da Fila

```sql
-- Verificar saúde
SELECT * FROM monitor_queue_health();
```

**Retorna:**
```
metric                  | value | threshold | status   | message
------------------------|-------|-----------|----------|----------------------------
pending_jobs            | 12    | 100       | OK       | Total de jobs aguardando
processing_jobs         | 3     | 20        | OK       | Jobs sendo processados
failed_jobs_1h          | 2     | 10        | OK       | Jobs falhados na última hora
oldest_pending_age_min  | 5     | 30        | OK       | Idade do job mais antigo
```

### Histórico de Execuções do Cron

```sql
-- Ver últimas execuções
SELECT * FROM cron_job_run_history
LIMIT 20;
```

### Status dos Cron Jobs

```sql
-- Ver status de todos os cron jobs
SELECT * FROM get_cron_jobs_status();
```

---

## 🎯 Dashboard de Monitoramento (React)

### Hook useJobQueueStats

```typescript
// src/hooks/useJobQueueStats.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QueueStats {
  total_jobs: number;
  pending_jobs: number;
  processing_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  cancelled_jobs: number;
  avg_attempts: number;
  oldest_pending: string | null;
  jobs_by_type: Record<string, any>;
}

export const useJobQueueStats = () => {
  return useQuery({
    queryKey: ['job-queue-stats'],
    queryFn: async (): Promise<QueueStats> => {
      const { data, error } = await supabase.rpc('get_queue_stats');
      
      if (error) throw error;
      
      return data[0];
    },
    refetchInterval: 10000 // Atualizar a cada 10s
  });
};
```

### Componente JobQueueDashboard

```typescript
// src/components/JobQueueDashboard.tsx
import { useJobQueueStats } from '@/hooks/useJobQueueStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const JobQueueDashboard = () => {
  const { data: stats, isLoading } = useJobQueueStats();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>Total Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats?.total_jobs}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Pending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-yellow-600">
            {stats?.pending_jobs}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">
            {stats?.processing_jobs}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Failed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">
            {stats?.failed_jobs}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## 🔧 Configuração

### Variáveis de Ambiente

Configurar no **Supabase Dashboard > Settings > Vault**:

```
app.settings.edge_function_url = https://xxx.supabase.co/functions/v1/job-worker
app.settings.service_role_key = eyJhbGc...
```

### Ajustar Frequência do Cron

```sql
-- Parar cron atual
SELECT cron.unschedule('process-job-queue');

-- Recriar com nova frequência (a cada 30 segundos)
SELECT cron.schedule(
  'process-job-queue',
  '*/30 * * * * *',  -- A cada 30s
  'SELECT process_job_queue()'
);
```

### Ajustar Limite de Jobs por Execução

```sql
-- Editar função process_job_queue
-- Alterar linha: SELECT * FROM get_next_jobs(10)
-- Para: SELECT * FROM get_next_jobs(20)
```

---

## 🐛 Troubleshooting

### Jobs Ficando Presos em PROCESSING

**Sintoma:** Jobs com status PROCESSING há muito tempo

**Solução:**
```sql
-- Resetar jobs presos (há mais de 5 minutos)
UPDATE job_queue
SET status = 'PENDING',
    started_at = NULL,
    next_retry_at = NOW()
WHERE status = 'PROCESSING'
  AND started_at < NOW() - INTERVAL '5 minutes';
```

### Muitos Jobs Falhando

**Sintoma:** Taxa alta de jobs com status FAILED

**Diagnóstico:**
```sql
-- Ver erros mais comuns
SELECT 
  error_message,
  COUNT(*) as count
FROM job_queue
WHERE status = 'FAILED'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY error_message
ORDER BY count DESC;
```

**Solução:**
- Corrigir erro na Edge Function
- Aumentar timeout
- Revisar payload dos jobs

### Fila Crescendo Muito

**Sintoma:** pending_jobs > 100

**Soluções:**
1. Aumentar frequência do cron (30s em vez de 60s)
2. Aumentar limite de jobs por execução (20 em vez de 10)
3. Verificar se Edge Function está lenta

### Cron Job Não Executando

**Verificar:**
```sql
-- Ver últimas execuções
SELECT * FROM cron_job_run_history
ORDER BY start_time DESC
LIMIT 10;

-- Ver status do cron
SELECT * FROM cron.job
WHERE jobname = 'process-job-queue';
```

**Solução:**
```sql
-- Recriar cron job
SELECT cron.unschedule('process-job-queue');
SELECT cron.schedule(
  'process-job-queue',
  '* * * * *',
  'SELECT process_job_queue()'
);
```

---

## 📈 Métricas de Performance

### SLA Targets

| Métrica | Target | Crítico |
|---------|--------|---------|
| Pending Jobs | < 50 | > 100 |
| Processing Jobs | < 10 | > 20 |
| Failed Jobs (1h) | < 5 | > 10 |
| Oldest Pending (min) | < 15 | > 30 |
| Avg Attempts | < 1.5 | > 2.0 |

### Benchmarks

Em condições normais:
- **Throughput:** 600 jobs/hora (10 jobs/min)
- **Latência:** < 5 segundos por job
- **Taxa de Sucesso:** > 95%
- **Taxa de Retry:** < 20%

---

## 🚀 Próximos Passos

### Melhorias Futuras

1. **Dead Letter Queue:** Jobs que falharam 3x vão para DLQ
2. **Priority Lanes:** Filas separadas por prioridade
3. **Scheduled Jobs:** Jobs agendados para futuro
4. **Batch Processing:** Processar múltiplos jobs em batch
5. **Webhooks de Status:** Notificar quando job completa

---

**Versão:** 1.0.0  
**Última atualização:** 26 de dezembro de 2025  
**Status:** ✅ IMPLEMENTADO
