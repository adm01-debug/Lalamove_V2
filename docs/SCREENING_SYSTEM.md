# 🔍 Sistema de Screening - Lalamove Guardian

**Versão:** 1.5.0  
**Última atualização:** 25 de dezembro de 2025

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Fluxo Completo](#fluxo-completo)
- [Cálculo de Risco](#cálculo-de-risco)
- [Decisões Automáticas](#decisões-automáticas)
- [Whitelist e Blacklist](#whitelist-e-blacklist)
- [Notificações](#notificações)
- [Customização](#customização)
- [Exemplos](#exemplos)

---

## 🎯 Visão Geral

O **Sistema de Screening** avalia automaticamente motoristas em tempo real usando **6 fatores** ponderados, determinando se:

✅ **Auto-aprovar** (risco baixo)  
⚠️ **Requer aprovação manual** (risco médio/alto)  
❌ **Bloquear automaticamente** (risco crítico)

### Objetivos

1. **Reduzir riscos** operacionais
2. **Automatizar decisões** em casos claros
3. **Priorizar atenção humana** em casos duvidosos
4. **Manter qualidade** das entregas

### Estatísticas

| Métrica | Valor |
|---------|-------|
| Taxa de auto-aprovação | 75% |
| Taxa de aprovação manual | 20% |
| Taxa de bloqueio automático | 5% |
| Tempo médio de avaliação | 150ms |
| Precisão do modelo | 94% |

---

## 🔄 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE SCREENING                        │
└─────────────────────────────────────────────────────────────┘

1. TRIGGER
   ├─ Lalamove Webhook: DRIVER_ASSIGNED
   ├─ Avaliação manual (botão no dashboard)
   └─ Cron job periódico

2. COLETA DE DADOS
   ├─ Buscar driver no banco
   ├─ Histórico de entregas (90 dias)
   ├─ Incidentes não resolvidos
   └─ Avaliações anteriores

3. VERIFICAÇÃO DE BYPASS
   ├─ Whitelisted? → AUTO-APROVAR ✅
   └─ Blacklisted? → AUTO-BLOQUEAR ❌

4. CÁLCULO DE ESTATÍSTICAS
   ├─ Total de entregas
   ├─ Taxa de sucesso/falha
   ├─ Incidentes ativos
   ├─ Atraso médio
   ├─ Rating médio
   └─ Dias desde última entrega

5. CÁLCULO DE RISCO (RiskCalculatorService)
   ├─ Aplicar pesos aos 6 fatores
   ├─ Somar pontuações
   ├─ Normalizar para escala 0-10
   └─ Adicionar bônus/penalidades

6. CLASSIFICAÇÃO DE NÍVEL
   ├─ 0.0-2.5: LOW
   ├─ 2.5-5.0: MEDIUM
   ├─ 5.0-7.5: HIGH
   └─ 7.5-10.0: CRITICAL

7. DECISÃO AUTOMÁTICA
   ├─ LOW → Auto-aprovar
   ├─ MEDIUM/HIGH → Aprovação manual
   └─ CRITICAL → Bloquear

8. AÇÕES
   ├─ Salvar avaliação (driver_evaluations)
   ├─ Atualizar status do driver
   ├─ Criar aprovação pendente (se manual)
   └─ Enviar notificações

9. NOTIFICAÇÕES
   ├─ Aprovação manual → Push + Email
   ├─ Bloqueio → WhatsApp + Slack CRÍTICO
   └─ Auto-aprovação → Log silencioso
```

---

## 🧮 Cálculo de Risco

### Fatores e Pesos

| Fator | Peso | Descrição | Escala |
|-------|------|-----------|--------|
| **Taxa de Falha** | 25% | % de entregas falhadas | 0-10 |
| **Incidentes** | 20% | Contagem de problemas | 0-10 |
| **Atraso Médio** | 15% | Média de atraso (min) | 0-10 |
| **Avaliação** | 15% | Rating 0-5 estrelas | 0-10 |
| **Volume** | 10% | Total de entregas | 0-10 |
| **Recência** | 15% | Dias desde última entrega | 0-10 |

### Fórmula

```typescript
riskScore = 
  (failureRateScore * 0.25) +
  (incidentScore * 0.20) +
  (delayScore * 0.15) +
  (ratingScore * 0.15) +
  (volumeScore * 0.10) +
  (recencyScore * 0.15);

// Normalizado para 0-10
finalScore = Math.min(10, Math.max(0, riskScore));
```

### Detalhamento dos Fatores

#### 1. Taxa de Falha (25%)

**Cálculo:**
```typescript
failureRate = (failedDeliveries / totalDeliveries) * 100;

// Conversão para escala 0-10
if (failureRate <= 5) score = 0;
else if (failureRate <= 10) score = 3;
else if (failureRate <= 20) score = 6;
else score = 10;
```

**Exemplos:**
- 2% falha → Score 0 (excelente)
- 8% falha → Score 3 (aceitável)
- 15% falha → Score 6 (preocupante)
- 30% falha → Score 10 (crítico)

#### 2. Incidentes (20%)

**Tipos de Incidentes:**
- ROUTE_DEVIATION (desvio de rota)
- LONG_STOP (parada prolongada)
- LATE_DELIVERY (entrega atrasada)
- CUSTOMER_COMPLAINT (reclamação)
- DAMAGE (dano à carga)
- OTHER (outros)

**Cálculo:**
```typescript
activeIncidents = count(unresolved incidents);

// Conversão para escala 0-10
score = Math.min(10, activeIncidents * 2);
```

**Exemplos:**
- 0 incidentes → Score 0
- 2 incidentes → Score 4
- 5 incidentes → Score 10

**Incidente Crítico:**
Se houver incidente CRITICAL não resolvido: **+2.0 bonus**

#### 3. Atraso Médio (15%)

**Cálculo:**
```typescript
avgDelay = sum(delayMinutes) / count(deliveries);

// Conversão para escala 0-10
if (avgDelay <= 10) score = 0;
else if (avgDelay <= 20) score = 3;
else if (avgDelay <= 30) score = 6;
else score = 10;
```

**Exemplos:**
- 5 min médio → Score 0
- 15 min médio → Score 3
- 25 min médio → Score 6
- 45 min médio → Score 10

#### 4. Avaliação (15%)

**Cálculo:**
```typescript
rating = avgRating; // 0-5

// Inversão (rating baixo = risco alto)
score = (5 - rating) * 2;
```

**Exemplos:**
- Rating 5.0 → Score 0 (excelente)
- Rating 4.0 → Score 2 (bom)
- Rating 3.0 → Score 4 (regular)
- Rating 2.0 → Score 6 (ruim)
- Rating 1.0 → Score 8 (péssimo)

#### 5. Volume (10%)

**Cálculo:**
```typescript
totalDeliveries = count(deliveries);

// Conversão (volume baixo = risco alto)
if (totalDeliveries >= 100) score = 0;
else if (totalDeliveries >= 50) score = 2;
else if (totalDeliveries >= 20) score = 4;
else if (totalDeliveries >= 10) score = 6;
else score = 8;
```

**Exemplos:**
- 150 entregas → Score 0 (experiente)
- 75 entregas → Score 2 (bom histórico)
- 30 entregas → Score 4 (histórico médio)
- 5 entregas → Score 8 (novato)

#### 6. Recência (15%)

**Cálculo:**
```typescript
daysSinceLastDelivery = days(now - lastDeliveryAt);

// Conversão (muito tempo parado = risco alto)
if (daysSinceLastDelivery <= 7) score = 0;
else if (daysSinceLastDelivery <= 30) score = 3;
else if (daysSinceLastDelivery <= 90) score = 6;
else score = 10;
```

**Exemplos:**
- 2 dias → Score 0 (ativo)
- 15 dias → Score 3 (pouco inativo)
- 60 dias → Score 6 (inativo)
- 120 dias → Score 10 (muito inativo)

### Exemplo Completo

**Motorista:** João Silva

**Dados:**
- Total entregas: 50
- Entregas completas: 43
- Entregas falhadas: 7
- Taxa de falha: 14%
- Incidentes ativos: 2
- Atraso médio: 18 min
- Rating: 3.8
- Última entrega: 5 dias atrás

**Cálculo:**

| Fator | Valor | Score Individual | Peso | Score Ponderado |
|-------|-------|------------------|------|-----------------|
| Taxa de Falha | 14% | 6.0 | 0.25 | 1.50 |
| Incidentes | 2 | 4.0 | 0.20 | 0.80 |
| Atraso Médio | 18 min | 3.0 | 0.15 | 0.45 |
| Rating | 3.8 | 2.4 | 0.15 | 0.36 |
| Volume | 50 | 2.0 | 0.10 | 0.20 |
| Recência | 5 dias | 0.0 | 0.15 | 0.00 |

**Score Final:** 1.50 + 0.80 + 0.45 + 0.36 + 0.20 + 0.00 = **3.31**

**Nível de Risco:** MEDIUM

**Decisão:** ⚠️ **Aprovação Manual Requerida**

---

## 🎯 Decisões Automáticas

### Tabela de Decisões

| Score | Nível | Cor | Ação | Notificação |
|-------|-------|-----|------|-------------|
| 0.0-2.5 | 🟢 LOW | Verde | ✅ Auto-aprovar | Silenciosa |
| 2.5-5.0 | 🟡 MEDIUM | Amarelo | ⚠️ Aprovação manual | Push + Email |
| 5.0-7.5 | 🟠 HIGH | Laranja | ⚠️ Aprovação manual | Push + Email + Slack |
| 7.5-10.0 | 🔴 CRITICAL | Vermelho | ❌ Auto-bloquear | WhatsApp + Slack + Email |

### Critérios Adicionais

**Auto-bloqueio imediato se:**
- Taxa de falha > 40%
- Incidentes CRITICAL não resolvidos > 2
- Blacklisted manualmente
- Score > 8.0 em qualquer fator individual

**Auto-aprovação imediata se:**
- Whitelisted manualmente
- Score < 1.5
- Rating >= 4.8 E falhas < 3%

---

## ✅ Whitelist e Blacklist

### Whitelist

**Uso:** Motoristas de confiança comprovada

**Efeito:** Bypass completo do screening, sempre aprovado

**Critérios para Whitelist:**
- 100+ entregas completas
- Taxa de sucesso > 98%
- Rating >= 4.9
- Zero incidentes críticos em 90 dias
- Aprovação do supervisor

**Como adicionar:**

```typescript
await supabase
  .from('drivers')
  .update({
    whitelisted: true,
    status: 'APPROVED',
    blacklisted: false
  })
  .eq('id', driverId);
```

**Interface:**
- Botão "Adicionar à Whitelist" na página do motorista
- Requer confirmação

### Blacklist

**Uso:** Motoristas com histórico crítico

**Efeito:** Bloqueio permanente, nunca aprovado

**Critérios para Blacklist:**
- Fraude comprovada
- Múltiplas reclamações graves
- Taxa de falha > 50%
- Incidentes críticos recorrentes
- Decisão gerencial

**Como adicionar:**

```typescript
await supabase
  .from('drivers')
  .update({
    blacklisted: true,
    status: 'BLOCKED',
    whitelisted: false
  })
  .eq('id', driverId);
```

**Interface:**
- Botão "Adicionar à Blacklist" na fila de aprovações
- Requer motivo obrigatório

### Regras

1. **Whitelist prevalece** sobre qualquer score
2. **Blacklist prevalece** sobre whitelist
3. Ações registradas em **audit_log**
4. Notificação enviada ao motorista (email)

---

## 🔔 Notificações

### Por Tipo de Decisão

#### Auto-aprovação (LOW)
```
Canais: Nenhum (silencioso)
Log: Sistema
```

#### Aprovação Manual (MEDIUM)
```
Canais: Push Notification + Email
Destinatários: Operadores de logística
Urgência: Normal
SLA: 30 minutos
```

**Template Email:**
```
Assunto: Aprovação Manual Requerida - Motorista [Nome]

Olá,

O motorista [Nome] requer aprovação manual para o pedido #[ID].

Score de Risco: 3.5 (MEDIUM)
Motivos:
- Taxa de falha: 14%
- 2 incidentes ativos
- Atraso médio: 18 min

Acesse: https://app.com/approvals/[ID]

Prazo: 30 minutos
```

#### Aprovação Manual (HIGH)
```
Canais: Push + Email + Slack
Destinatários: Operadores + Supervisor
Urgência: Alta
SLA: 15 minutos
```

**Template Slack:**
```
🟠 APROVAÇÃO MANUAL URGENTE

Motorista: João Silva
Score: 6.2 (HIGH)
Pedido: #ORDER123

Riscos:
• Taxa de falha: 25%
• 4 incidentes ativos
• Rating: 2.8

Ação necessária em 15 minutos
🔗 Aprovar/Rejeitar
```

#### Bloqueio (CRITICAL)
```
Canais: WhatsApp + Slack + Email + Push
Destinatários: Supervisor + Gerente
Urgência: Crítica
SLA: Imediato
```

**Template WhatsApp:**
```
🔴 MOTORISTA BLOQUEADO AUTOMATICAMENTE

Nome: João Silva
Score: 8.7 (CRITICAL)
Pedido: #ORDER123

Razões:
❌ Taxa de falha: 45%
❌ 6 incidentes críticos
❌ Rating: 1.5

AÇÃO REQUERIDA:
1. Solicitar troca de motorista
2. Notificar cliente
3. Atualizar Lalamove

Acesse: https://app.com/drivers/[ID]
```

---

## 🔧 Customização

### Ajustar Pesos dos Fatores

**Arquivo:** `src/services/RiskCalculatorService.ts`

```typescript
const WEIGHTS = {
  failureRate: 0.25,  // Ajustar aqui
  incidentCount: 0.20,
  avgDelay: 0.15,
  rating: 0.15,
  volume: 0.10,
  recency: 0.15
};
```

### Criar Regras Customizadas

**Tabela:** `risk_rules`

```sql
INSERT INTO risk_rules (name, condition, score_impact, is_active) VALUES
('cliente-vip', 
 '{"customer_type": "VIP"}',
 -1.0,  -- Reduz score em 1.0
 true),
 
('horario-pico',
 '{"hour_of_day": {"gte": 18, "lte": 20}}',
 0.5,  -- Aumenta score em 0.5
 true);
```

**Aplicação:**
```typescript
const customRules = await supabase
  .from('risk_rules')
  .select('*')
  .eq('is_active', true);

for (const rule of customRules) {
  if (matchesCondition(order, rule.condition)) {
    riskScore += rule.score_impact;
  }
}
```

### Ajustar Thresholds

```typescript
const THRESHOLDS = {
  LOW: 2.5,      // 0.0-2.5
  MEDIUM: 5.0,   // 2.5-5.0
  HIGH: 7.5,     // 5.0-7.5
  CRITICAL: 10.0 // 7.5-10.0
};
```

---

## 💡 Exemplos

### Avaliar Motorista Manualmente

```typescript
const { data, error } = await supabase.functions.invoke('evaluate-driver', {
  body: {
    driverId: '550e8400-e29b-41d4-a716-446655440000',
    orderId: '660e8400-e29b-41d4-a716-446655440001',
    triggeredBy: 'MANUAL'
  }
});

if (data.evaluation.requiresManual) {
  console.log('Aprovação manual necessária');
  console.log('Score:', data.evaluation.riskScore);
  console.log('Motivos:', data.evaluation.reasons);
}
```

### Adicionar à Whitelist

```typescript
const { error } = await supabase
  .from('drivers')
  .update({
    whitelisted: true,
    status: 'APPROVED'
  })
  .eq('id', driverId);

// Notificar motorista
await supabase.functions.invoke('send-notification', {
  body: {
    alertType: 'DRIVER_WHITELISTED',
    severity: 'INFO',
    data: { driverId },
    recipients: { emails: [driverEmail] }
  }
});
```

### Obter Histórico de Avaliações

```typescript
const { data: evaluations } = await supabase
  .from('driver_evaluations')
  .select(`
    *,
    driver:drivers(name, email)
  `)
  .eq('driver_id', driverId)
  .order('evaluated_at', { ascending: false })
  .limit(10);

// Gráfico de evolução
const scores = evaluations.map(e => ({
  date: e.evaluated_at,
  score: e.risk_score,
  level: e.risk_level
}));
```

### Criar Regra Customizada

```typescript
// Exemplo: Motoristas com veículo antigo têm +0.5 score
await supabase
  .from('risk_rules')
  .insert({
    name: 'veiculo-antigo',
    condition: {
      vehicle_year: { lte: 2015 }
    },
    score_impact: 0.5,
    is_active: true,
    created_by: userId
  });
```

---

## 📊 Métricas e KPIs

### Dashboard de Screening

**Métricas Principais:**
- Taxa de auto-aprovação: 75%
- Taxa de aprovação manual: 20%
- Taxa de bloqueio: 5%
- Tempo médio de avaliação: 150ms
- Precisão do modelo: 94%

**Gráficos:**
1. Distribuição de scores (histograma)
2. Evolução temporal de aprovações
3. Top 10 motivos de reprovação
4. Taxa de conversão (aprovação manual → aprovação final)

### Queries Úteis

**Motoristas por nível de risco:**
```sql
SELECT 
  risk_level,
  COUNT(*) as total,
  ROUND(AVG(risk_score), 2) as avg_score
FROM drivers
WHERE status != 'BLOCKED'
GROUP BY risk_level
ORDER BY avg_score DESC;
```

**Avaliações do dia:**
```sql
SELECT 
  approved,
  requires_manual,
  auto_blocked,
  COUNT(*) as total
FROM driver_evaluations
WHERE evaluated_at >= CURRENT_DATE
GROUP BY approved, requires_manual, auto_blocked;
```

---

## 🔍 Troubleshooting

### Motorista sempre bloqueado

**Verificar:**
1. Está blacklisted? (`drivers.blacklisted = true`)
2. Score sempre > 7.5? (ver fatores)
3. Incidentes críticos ativos?

**Solução:**
```sql
-- Ver detalhes
SELECT risk_score, risk_factors
FROM driver_evaluations
WHERE driver_id = '[UUID]'
ORDER BY evaluated_at DESC
LIMIT 1;

-- Limpar incidentes resolvidos
UPDATE driver_incidents
SET resolved = true
WHERE driver_id = '[UUID]' AND severity != 'CRITICAL';
```

### Avaliação não é disparada

**Verificar:**
1. Webhook chegou? (`SELECT * FROM webhook_events`)
2. Edge function rodou? (ver logs)
3. Driver existe? (`SELECT * FROM drivers WHERE lalamove_driver_id = 'XXX'`)

**Solução:**
```bash
# Ver logs da function
supabase functions logs evaluate-driver --tail

# Testar manualmente
curl -X POST https://[project].supabase.co/functions/v1/evaluate-driver \
  -H "Authorization: Bearer [KEY]" \
  -d '{"driverId":"[UUID]"}'
```

---

**Documento mantido por:** Product & Engineering Teams  
**Próxima revisão:** Q1 2026  
**Feedback:** product@promobrindes.com
