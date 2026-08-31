# 📖 Dicionário de Dados — Lalamove Intelligence

## Tabelas Principais

### `drivers`
Armazena informações cadastrais e de desempenho dos motoristas.
- `id`: UUID (PK)
- `lalamove_id`: ID único fornecido pela API Lalamove
- `name`: Nome do motorista
- `risk_score`: Pontuação de risco (0-100, onde 100 é risco máximo)
- `status`: Estado atual (ACTIVE, BLOCKED, PENDING_APPROVAL)

### `lalamove_orders`
Pedidos de entrega criados via API Lalamove.
- `id`: UUID (PK)
- `lalamove_id`: ID do pedido na Lalamove
- `status`: Status do pedido (PENDING, ON_GOING, COMPLETED, CANCELLED)
- `total_cost`: Custo total da entrega
- `driver_id`: FK para `drivers.id`

### `tracking_events`
Log de alta volumetria com posições GPS e eventos de rastreamento.
- `order_id`: FK para `lalamove_orders.id`
- `latitude` / `longitude`: Coordenadas geográficas
- `speed`: Velocidade registrada
- `event_type`: Tipo de evento (LOCATION_UPDATE, ROUTE_DEVIATION, STOP_TIMEOUT)

### `alerts`
Alertas gerados automaticamente pelo sistema de screening e rastreamento.
- `type`: Categoria (RISK, DELAY, DEVIATION, SECURITY)
- `severity`: Nível (INFO, WARNING, CRITICAL)
- `is_dismissed`: Indica se o alerta foi visualizado/arquivado
