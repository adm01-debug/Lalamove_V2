# 📘 API Reference - Lalamove Guardian

**Versão:** 1.5.0  
**Base URL:** `https://[project-ref].supabase.co`  
**Última atualização:** 25 de dezembro de 2025

---

## 📋 Índice

- [Autenticação](#autenticação)
- [Edge Functions](#edge-functions)
- [Tabelas (REST API)](#tabelas-rest-api)
- [Integrações Externas](#integrações-externas)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)

---

## 🔐 Autenticação

### Supabase Auth

Todas as requisições ao banco requerem token JWT:

```bash
curl https://[project-ref].supabase.co/rest/v1/drivers \
  -H "apikey: [ANON_KEY]" \
  -H "Authorization: Bearer [JWT_TOKEN]"
```

**Obter Token:**

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'senha123'
});

const token = data.session.access_token;
```

### Service Role (Edge Functions apenas)

```bash
curl https://[project-ref].supabase.co/functions/v1/evaluate-driver \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]"
```

⚠️ **Nunca expor SERVICE_ROLE_KEY no frontend!**

---

## ⚡ Edge Functions

### 1. evaluate-driver

**Endpoint:** `POST /functions/v1/evaluate-driver`

**Descrição:** Avalia motorista e determina se requer aprovação manual

**Headers:**
```
Authorization: Bearer [SERVICE_ROLE_KEY]
Content-Type: application/json
```

**Request Body:**
```json
{
  "driverId": "550e8400-e29b-41d4-a716-446655440000",
  "orderId": "660e8400-e29b-41d4-a716-446655440001",
  "triggeredBy": "DRIVER_ASSIGNED"
}
```

**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `driverId` | UUID | Sim | ID do motorista |
| `orderId` | UUID | Opcional | ID do pedido relacionado |
| `triggeredBy` | String | Opcional | Fonte da avaliação (`DRIVER_ASSIGNED`, `MANUAL`) |

**Response 200:**
```json
{
  "success": true,
  "evaluation": {
    "approved": false,
    "requiresManual": true,
    "autoBlocked": false,
    "riskScore": 4.5,
    "riskLevel": "MEDIUM",
    "riskFactors": {
      "failureRate": 15.5,
      "incidentCount": 3,
      "avgDelay": 22.3,
      "rating": 3.8,
      "volume": 45,
      "recency": 7
    },
    "reasons": [
      "Taxa de falha acima da média (15.5%)",
      "Múltiplos incidentes recentes (3)",
      "Atrasos frequentes (22 min médio)"
    ],
    "recommendation": "Aprovação manual recomendada devido a histórico inconsistente",
    "actionRequired": "MANUAL_APPROVAL"
  }
}
```

**Error 400:**
```json
{
  "success": false,
  "error": "Invalid input",
  "message": "driverId is required"
}
```

**Error 404:**
```json
{
  "success": false,
  "error": "Driver not found",
  "message": "No driver found with ID: 550e8400..."
}
```

**Error 500:**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Failed to calculate risk score"
}
```

**Exemplo cURL:**
```bash
curl -X POST https://[project-ref].supabase.co/functions/v1/evaluate-driver \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "550e8400-e29b-41d4-a716-446655440000",
    "orderId": "660e8400-e29b-41d4-a716-446655440001"
  }'
```

**Exemplo TypeScript:**
```typescript
const { data, error } = await supabase.functions.invoke('evaluate-driver', {
  body: {
    driverId: '550e8400-e29b-41d4-a716-446655440000',
    orderId: '660e8400-e29b-41d4-a716-446655440001',
    triggeredBy: 'MANUAL'
  }
});
```

---

### 2. lalamove-webhook

**Endpoint:** `POST /functions/v1/lalamove-webhook`

**Descrição:** Recebe e processa webhooks da Lalamove API

**Headers:**
```
X-Lalamove-Signature: [HMAC_SIGNATURE]
Content-Type: application/json
```

**Validação HMAC:**
```typescript
const signature = crypto
  .createHmac('sha256', LALAMOVE_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');
```

**Request Body (DRIVER_ASSIGNED):**
```json
{
  "eventType": "DRIVER_ASSIGNED",
  "orderId": "LALAMOVE123456",
  "timestamp": "2025-12-25T10:30:00Z",
  "data": {
    "driverId": "DRIVER789",
    "driverName": "João Silva",
    "driverPhone": "+5511999998888",
    "vehicleType": "MOTORCYCLE",
    "vehiclePlate": "ABC-1234"
  }
}
```

**Request Body (DRIVER_LOCATION_UPDATE):**
```json
{
  "eventType": "DRIVER_LOCATION_UPDATE",
  "orderId": "LALAMOVE123456",
  "timestamp": "2025-12-25T10:35:00Z",
  "data": {
    "latitude": -23.550520,
    "longitude": -46.633308,
    "speed": 35.5,
    "heading": 180.0,
    "accuracy": 10.5
  }
}
```

**Request Body (ORDER_STATUS_CHANGED):**
```json
{
  "eventType": "ORDER_STATUS_CHANGED",
  "orderId": "LALAMOVE123456",
  "timestamp": "2025-12-25T11:00:00Z",
  "data": {
    "previousStatus": "ON_GOING",
    "currentStatus": "COMPLETED",
    "completedAt": "2025-12-25T11:00:00Z",
    "proofOfDeliveryUrl": "https://..."
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "eventId": "770e8400-e29b-41d4-a716-446655440002"
}
```

**Error 401:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid HMAC signature"
}
```

**Error 429:**
```json
{
  "success": false,
  "error": "Too many requests",
  "message": "Rate limit exceeded (100 req/min)"
}
```

---

### 3. route-analyzer

**Endpoint:** `POST /functions/v1/route-analyzer`

**Descrição:** Analisa rotas usando IA (Gemini 2.5 Flash)

**Request Body:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "origin": {
    "lat": -23.550520,
    "lng": -46.633308,
    "address": "Av. Paulista, 1000"
  },
  "destination": {
    "lat": -23.561684,
    "lng": -46.656140,
    "address": "Av. Faria Lima, 2000"
  },
  "currentPosition": {
    "lat": -23.555000,
    "lng": -46.640000
  },
  "context": {
    "estimatedTime": 25,
    "actualTime": 40,
    "traffic": "HEAVY"
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "analysis": {
    "summary": "O motorista está 1.2km desviado da rota ideal...",
    "isOnRoute": false,
    "deviationKm": 1.2,
    "estimatedDelay": 8,
    "severity": "MEDIUM",
    "recommendations": [
      "Retornar à Av. Paulista pela próxima conversão",
      "Evitar Rua Augusta devido a tráfego intenso",
      "Tempo estimado de correção: 5 minutos"
    ],
    "alternativeRoute": {
      "distance": 8.5,
      "duration": 22,
      "waypoints": [
        { "lat": -23.555000, "lng": -46.640000 },
        { "lat": -23.558000, "lng": -46.645000 }
      ]
    }
  }
}
```

---

### 4. send-notification

**Endpoint:** `POST /functions/v1/send-notification`

**Descrição:** Envia notificações multi-canal

**Request Body:**
```json
{
  "alertType": "DRIVER_BLOCKED",
  "severity": "CRITICAL",
  "data": {
    "driverName": "João Silva",
    "driverId": "550e8400-e29b-41d4-a716-446655440000",
    "reason": "Alta taxa de falha",
    "orderId": "660e8400-e29b-41d4-a716-446655440001"
  },
  "recipients": {
    "emails": ["supervisor@empresa.com"],
    "phones": ["+5511999998888"],
    "slackChannels": ["#logistics-critical"]
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "sent": {
    "email": 1,
    "sms": 0,
    "whatsapp": 1,
    "slack": 1,
    "bitrix24": 1,
    "push": 3
  },
  "failed": [],
  "messageId": "880e8400-e29b-41d4-a716-446655440003"
}
```

---

### 5. lalamove-api (Proxy)

**Endpoint:** `POST /functions/v1/lalamove-api`

**Descrição:** Proxy autenticado para Lalamove API

**Request Body:**
```json
{
  "method": "POST",
  "path": "/v3/quotations",
  "body": {
    "serviceType": "MOTORCYCLE",
    "stops": [
      {
        "lat": -23.550520,
        "lng": -46.633308
      },
      {
        "lat": -23.561684,
        "lng": -46.656140
      }
    ]
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "priceAmount": "25.50",
    "priceCurrency": "BRL",
    "distance": 8.5,
    "estimatedTime": 25
  }
}
```

---

### 6. bitrix24-sync

**Endpoint:** `POST /functions/v1/bitrix24-sync`

**Descrição:** Sincroniza pedidos com Bitrix24 CRM

**Request Body:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "action": "sync"
}
```

**Response 200:**
```json
{
  "success": true,
  "dealId": "12345",
  "stageId": "C1:NEW",
  "syncedAt": "2025-12-25T10:30:00Z"
}
```

---

### 7. get-mapbox-token

**Endpoint:** `GET /functions/v1/get-mapbox-token`

**Descrição:** Retorna token Mapbox seguro (server-side)

**Response 200:**
```json
{
  "token": "pk.eyJ1IjoibGFsYW1vdmUiLCJhIjoiY2x...",
  "expiresAt": "2025-12-25T23:59:59Z"
}
```

---

### 8. check-driver-alerts

**Endpoint:** `POST /functions/v1/check-driver-alerts`

**Descrição:** Verifica condições de alerta para motorista ativo

**Request Body:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200:**
```json
{
  "success": true,
  "alerts": [
    {
      "type": "ROUTE_DEVIATION",
      "severity": "WARNING",
      "message": "Motorista desviou 1.2km da rota",
      "createdAt": "2025-12-25T10:35:00Z"
    },
    {
      "type": "DRIVER_STOPPED",
      "severity": "WARNING",
      "message": "Motorista parado há 12 minutos",
      "createdAt": "2025-12-25T10:40:00Z"
    }
  ]
}
```

---

### 9. simulate-driver-movement

**Endpoint:** `POST /functions/v1/simulate-driver-movement`

**Descrição:** Simula movimento de motorista (testing)

**Request Body:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "route": [
    { "lat": -23.550520, "lng": -46.633308 },
    { "lat": -23.555000, "lng": -46.640000 },
    { "lat": -23.561684, "lng": -46.656140 }
  ],
  "speedKmh": 30,
  "intervalSeconds": 5
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Simulation started",
  "estimatedDuration": 300
}
```

---

## 📊 Tabelas (REST API)

### Base URL
```
https://[project-ref].supabase.co/rest/v1
```

### Headers Obrigatórios
```
apikey: [ANON_KEY]
Authorization: Bearer [JWT_TOKEN]
Content-Type: application/json
Prefer: return=representation  # Retorna objeto criado/atualizado
```

---

### drivers

**GET /drivers**

Listar motoristas

**Query Params:**
```
?status=eq.APPROVED
&risk_score=gte.5.0
&order=risk_score.desc
&limit=20
&offset=0
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "lalamove_driver_id": "DRIVER123",
    "name": "João Silva",
    "status": "APPROVED",
    "risk_score": 3.5,
    "risk_level": "MEDIUM",
    "total_deliveries": 150,
    "success_rate": 92.5,
    "rating": 4.3
  }
]
```

**POST /drivers**

Criar motorista

**Body:**
```json
{
  "lalamove_driver_id": "DRIVER123",
  "name": "João Silva",
  "phone": "+5511999998888",
  "email": "joao@email.com"
}
```

**PATCH /drivers?id=eq.[UUID]**

Atualizar motorista

**Body:**
```json
{
  "status": "APPROVED",
  "whitelisted": true
}
```

---

### lalamove_orders

**GET /lalamove_orders**

Listar pedidos

**Query Params:**
```
?status=eq.COMPLETED
&driver_id=eq.[UUID]
&created_at=gte.2025-12-01
&order=created_at.desc
```

**POST /lalamove_orders**

Criar pedido

**Body:**
```json
{
  "lalamove_order_id": "ORDER123",
  "driver_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "pickup_address": "Av. Paulista, 1000",
  "delivery_address": "Av. Faria Lima, 2000",
  "customer_name": "Maria Santos"
}
```

---

### driver_approval_queue

**GET /driver_approval_queue**

Fila de aprovações

**Query Params:**
```
?status=eq.PENDING
&order=requested_at.asc
```

**Response:**
```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "driver_id": "550e8400-e29b-41d4-a716-446655440000",
    "driver_name": "João Silva",
    "status": "PENDING",
    "risk_score": 4.5,
    "requested_at": "2025-12-25T10:00:00Z"
  }
]
```

**PATCH /driver_approval_queue?id=eq.[UUID]**

Aprovar/Rejeitar

**Body:**
```json
{
  "status": "APPROVED",
  "reviewed_at": "2025-12-25T10:30:00Z",
  "reviewed_by": "[USER_UUID]",
  "decision_notes": "Histórico aceitável após análise"
}
```

---

### driver_evaluations

**GET /driver_evaluations**

Histórico de avaliações

**Query Params:**
```
?driver_id=eq.[UUID]
&order=evaluated_at.desc
```

**Response:**
```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "driver_id": "550e8400-e29b-41d4-a716-446655440000",
    "risk_score": 4.5,
    "risk_level": "MEDIUM",
    "approved": false,
    "requires_manual": true,
    "risk_factors": {
      "failureRate": 15.5,
      "incidentCount": 3
    },
    "evaluated_at": "2025-12-25T10:00:00Z"
  }
]
```

---

### active_tracking

**GET /active_tracking**

Rastreamento ativo

**Query Params:**
```
?order_id=eq.[UUID]
```

**Response:**
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440000",
  "order_id": "660e8400-e29b-41d4-a716-446655440001",
  "current_lat": -23.555000,
  "current_lng": -46.640000,
  "speed": 35.5,
  "heading": 180.0,
  "is_on_route": true,
  "is_stopped": false,
  "eta_minutes": 15,
  "last_update": "2025-12-25T10:35:00Z"
}
```

---

### alerts

**GET /alerts**

Alertas do sistema

**Query Params:**
```
?is_read=eq.false
&severity=eq.CRITICAL
&order=created_at.desc
```

**Response:**
```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "type": "DRIVER_BLOCKED",
    "severity": "CRITICAL",
    "title": "Motorista Bloqueado",
    "message": "João Silva foi bloqueado automaticamente",
    "driver_id": "550e8400-e29b-41d4-a716-446655440000",
    "is_read": false,
    "created_at": "2025-12-25T10:00:00Z"
  }
]
```

---

## 🔗 Integrações Externas

### Lalamove API

**Base URL:** `https://rest.lalamove.com`

**Autenticação:** HMAC-SHA256

**Exemplo de assinatura:**
```typescript
const timestamp = Date.now();
const method = 'POST';
const path = '/v3/orders';
const body = JSON.stringify(payload);

const signatureData = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
const signature = crypto
  .createHmac('sha256', LALAMOVE_API_SECRET)
  .update(signatureData)
  .digest('hex');

const headers = {
  'Authorization': `hmac ${LALAMOVE_API_KEY}:${timestamp}:${signature}`,
  'Content-Type': 'application/json',
  'Market': 'BR'
};
```

### Bitrix24 REST API

**Base URL:** `https://[domain].bitrix24.com.br/rest`

**Autenticação:** OAuth2

**Refresh Token:**
```bash
POST https://[domain].bitrix24.com.br/oauth/token/
{
  "grant_type": "refresh_token",
  "client_id": "[CLIENT_ID]",
  "client_secret": "[CLIENT_SECRET]",
  "refresh_token": "[REFRESH_TOKEN]"
}
```

### Mapbox API

**Base URL:** `https://api.mapbox.com`

**Endpoints usados:**
- `/v4/directions` - Rotas
- `/geocoding/v5` - Geocoding
- `/styles/v1` - Tiles de mapa

---

## ❌ Error Codes

### HTTP Status Codes

| Code | Significado | Ação |
|------|-------------|------|
| 200 | OK | Sucesso |
| 201 | Created | Recurso criado |
| 400 | Bad Request | Verificar payload |
| 401 | Unauthorized | Token inválido |
| 403 | Forbidden | Sem permissão |
| 404 | Not Found | Recurso não existe |
| 409 | Conflict | Conflito (ex: ID duplicado) |
| 429 | Too Many Requests | Rate limit excedido |
| 500 | Internal Server Error | Erro do servidor |
| 503 | Service Unavailable | Serviço indisponível |

### Error Response Format

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Driver ID is required",
  "details": {
    "field": "driverId",
    "constraint": "required"
  },
  "timestamp": "2025-12-25T10:00:00Z",
  "requestId": "req_abc123"
}
```

---

## ⏱️ Rate Limiting

### Limites por Endpoint

| Endpoint | Limite | Janela |
|----------|--------|--------|
| `/functions/v1/lalamove-webhook` | 100 req | 1 min |
| `/rest/v1/*` | 1000 req | 1 min |
| `/functions/v1/evaluate-driver` | 100 req | 1 min |
| `/functions/v1/route-analyzer` | 50 req | 1 min |

### Headers de Rate Limit

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640433600
```

### Resposta 429

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "retryAfter": 45
}
```

---

## 📚 SDKs e Bibliotecas

### JavaScript/TypeScript

```bash
npm install @supabase/supabase-js
```

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://[project-ref].supabase.co',
  '[ANON_KEY]'
);

// Query
const { data, error } = await supabase
  .from('drivers')
  .select('*')
  .eq('status', 'APPROVED');

// Realtime
supabase
  .channel('approvals')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'driver_approval_queue'
  }, (payload) => {
    console.log('Change received!', payload);
  })
  .subscribe();
```

---

## 🧪 Testing

### Postman Collection

Disponível em: `/docs/postman-collection.json`

### cURL Examples

**Avaliar motorista:**
```bash
curl -X POST https://[project-ref].supabase.co/functions/v1/evaluate-driver \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"driverId":"550e8400-e29b-41d4-a716-446655440000"}'
```

**Listar aprovações pendentes:**
```bash
curl https://[project-ref].supabase.co/rest/v1/driver_approval_queue?status=eq.PENDING \
  -H "apikey: [ANON_KEY]" \
  -H "Authorization: Bearer [JWT_TOKEN]"
```

---

**Documento mantido por:** Backend Team  
**Próxima revisão:** Q1 2026  
**Feedback:** tech@promobrindes.com
