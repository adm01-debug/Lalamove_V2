/**
 * Script de Seed - Popula o banco Supabase com dados fictícios
 * Execute via: npx tsx scripts/seed-database.ts
 */

import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const SUPABASE_URL = 'https://iecgydonctmabiijadsf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2d5ZG9uY3RtYWJpaWphZHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2Njk5NTYsImV4cCI6MjEwMTI0NTk1Nn0.Us06xRWbkFNb7js95Zhvw5ADAphGDFI-9dN8vXX_8HQ';

// Cliente Supabase (com service role para bypassar RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// =====================================================
// DADOS FICTÍCIOS
// =====================================================

// Nomes brasileiros fictícios
const FIRST_NAMES = [
  'João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Fernanda', 'Lucas', 'Juliana',
  'Rafael', 'Camila', 'Bruno', 'Beatriz', 'André', 'Larissa', 'Felipe', 'Carolina',
  'Marcos', 'Patrícia', 'Rodrigo', 'Amanda', 'Diego', 'Tatiana', 'Gustavo', 'Renata'
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ferreira',
  'Rodrigues', 'Almeida', 'Nascimento', 'Araújo', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins',
  'Rocha', 'Moraes', 'Barbosa', 'Melo', 'Cardoso', 'Cruz', 'Machado', 'Moreira'
];

// Endereços fictícios em São Paulo
const ADDRESSES = [
  { address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP', lat: -23.5629, lng: -46.6544 },
  { address: 'Rua Augusta, 1500 - Consolação, São Paulo - SP', lat: -23.5555, lng: -46.6609 },
  { address: 'Av. Faria Lima, 2000 - Itaim Bibi, São Paulo - SP', lat: -23.5848, lng: -46.6822 },
  { address: 'Av. Rebouças, 2500 - Pinheiros, São Paulo - SP', lat: -23.5676, lng: -46.6876 },
  { address: 'Av. Paulista, 2000 - Cerqueira César, São Paulo - SP', lat: -23.5619, lng: -46.6555 },
  { address: 'Rua Oscar Freire, 500 - Jardins, São Paulo - SP', lat: -23.5634, lng: -46.6713 },
  { address: 'Av. Brasil, 3000 - Jardim América, São Paulo - SP', lat: -23.5775, lng: -46.6900 },
  { address: 'Av. 9 de Julho, 4000 - Jardim Europa, São Paulo - SP', lat: -23.5840, lng: -46.6720 },
  { address: 'Rua Haddock Lobo, 800 - Cerqueira César, São Paulo - SP', lat: -23.5589, lng: -46.6655 },
  { address: 'Av. Wesceslau Brás, 100 - Butantã, São Paulo - SP', lat: -23.5896, lng: -46.7264 },
  { address: 'Av. Dr. Chucri Zaidan, 200 - Vila São Luís, São Paulo - SP', lat: -23.6076, lng: -46.6983 },
  { address: 'Av. Giovanni Gronchi, 500 - Morumbi, São Paulo - SP', lat: -23.6254, lng: -46.7388 },
  { address: 'Rua dos Pinheiros, 1000 - Pinheiros, São Paulo - SP', lat: -23.5705, lng: -46.6912 },
  { address: 'Av. Brigadeiro Faria Lima, 3500 - Itaim Bibi, São Paulo - SP', lat: -23.5850, lng: -46.6840 },
  { address: 'Av. Engenheiro Luís Carlos Berrini, 200 - Brooklin, São Paulo - SP', lat: -23.5976, lng: -46.6855 },
];

// Status de pedidos
const ORDER_STATUSES = ['PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP', 'COMPLETED', 'CANCELLED'] as const;
const VEHICLE_TYPES = ['MOTORCYCLE', 'CAR', 'VAN', 'TRUCK'] as const;
const DRIVER_STATUSES = ['APPROVED', 'PENDING_APPROVAL', 'BLOCKED'] as const;
const INCIDENT_TYPES = ['ROUTE_DEVIATION', 'LONG_STOP', 'LATE_DELIVERY', 'CUSTOMER_COMPLAINT', 'DAMAGE'] as const;
const ALERT_TYPES = ['DRIVER_BLOCKED', 'ROUTE_DEVIATION', 'DRIVER_STOPPED', 'LATE_DELIVERY', 'APPROVAL_REQUIRED'] as const;

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function generatePhone(): string {
  const ddd = ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '72', '73', '74', '75', '76', '77', '78', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99'];
  const dddVal = randomElement(ddd);
  const first = randomInt(90000, 99999);
  const second = randomInt(1000, 9999);
  return `+55${dddVal}${first}${second}`;
}

function generatePlate(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const l1 = letters[randomInt(0, 25)];
  const l2 = letters[randomInt(0, 25)];
  const l3 = letters[randomInt(0, 25)];
  const n1 = randomInt(0, 9);
  const n2 = randomInt(0, 9);
  const n3 = randomInt(0, 9);
  const n4 = randomInt(0, 9);
  return `${l1}${l2}${l3}-${n1}${n2}${n3}${n4}`;
}

function generateLalamoveId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars[randomInt(0, chars.length - 1)];
  }
  return result;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function randomDate(daysBack: number = 30): Date {
  const now = new Date();
  const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
}

// =====================================================
// SEED FUNCTIONS
// =====================================================

async function clearTables() {
  console.log('🗑️  Limpando tabelas existentes...');

  const tables = [
    'tracking_events',
    'active_tracking',
    'alerts_sent',
    'alerts',
    'lalamove_stops',
    'lalamove_status_history',
    'driver_incidents',
    'driver_approval_queue',
    'lalamove_orders',
    'drivers'
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', generateUUID());
    if (error) {
      console.log(`  ⚠️  Erro ao limpar ${table}: ${error.message}`);
    }
  }

  console.log('✅ Tabelas limpas\n');
}

async function seedDrivers(count: number = 20) {
  console.log(`👤 Criando ${count} motoristas...`);

  const drivers = [];
  for (let i = 0; i < count; i++) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const status = randomElement(DRIVER_STATUSES);

    drivers.push({
      id: generateUUID(),
      lalamove_id: generateLalamoveId(),
      name: `${firstName} ${lastName}`,
      phone: generatePhone(),
      photo_url: `https://i.pravatar.cc/150?u=${i}`,
      vehicle_type: randomElement(VEHICLE_TYPES),
      vehicle_plate: generatePlate(),
      risk_score: randomFloat(1, 10, 1),
      status: status,
      total_deliveries: randomInt(50, 500),
      completed_deliveries: randomInt(40, 450),
      rating: randomFloat(3.5, 5, 1),
      last_active_at: randomDate(7).toISOString(),
      created_at: randomDate(180).toISOString(),
      updated_at: randomDate(7).toISOString(),
    });
  }

  const { data, error } = await supabase.from('drivers').insert(drivers).select('id');

  if (error) {
    console.log(`  ❌ Erro ao criar motoristas: ${error.message}`);
    return [];
  }

  console.log(`  ✅ ${data?.length || 0} motoristas criados\n`);
  return data || [];
}

async function seedOrders(drivers: { id: string; lalamove_id: string }[], count: number = 50) {
  console.log(`📦 Criando ${count} pedidos...`);

  const orders = [];
  for (let i = 0; i < count; i++) {
    const status = randomElement(ORDER_STATUSES);
    const pickup = randomElement(ADDRESSES);
    const delivery = randomElement(ADDRESSES);
    const driver = status !== 'PENDING' && status !== 'CANCELLED' && status !== 'EXPIRED'
      ? randomElement(drivers)
      : null;
    const scheduledAt = randomDate(30);

    orders.push({
      id: generateUUID(),
      lalamove_id: generateLalamoveId(),
      internal_order_id: `INT-${randomInt(10000, 99999)}`,
      status: status,
      pickup_address: pickup.address,
      pickup_latitude: pickup.lat,
      pickup_longitude: pickup.lng,
      delivery_address: delivery.address,
      delivery_latitude: delivery.lat,
      delivery_longitude: delivery.lng,
      customer_name: `${randomElement(FIRST_NAMES)} ${randomElement(LAST_NAMES)}`,
      customer_phone: generatePhone(),
      scheduled_at: scheduledAt.toISOString(),
      estimated_delivery: new Date(scheduledAt.getTime() + randomInt(30, 120) * 60000).toISOString(),
      actual_delivery: ['COMPLETED', 'PICKED_UP'].includes(status)
        ? new Date(scheduledAt.getTime() + randomInt(20, 180) * 60000).toISOString()
        : null,
      driver_id: driver?.id || null,
      vehicle_type: randomElement(VEHICLE_TYPES),
      total_cost: randomFloat(15, 350, 2),
      currency: 'BRL',
      tags: status === 'COMPLETED' ? ['delivered'] : [],
      quotation_id: generateLalamoveId(),
      metadata: { source: 'seed_script', order_index: i },
      created_at: randomDate(30).toISOString(),
      updated_at: randomDate(7).toISOString(),
    });
  }

  const { data, error } = await supabase.from('lalamove_orders').insert(orders).select('id, lalamove_id');

  if (error) {
    console.log(`  ❌ Erro ao criar pedidos: ${error.message}`);
    return [];
  }

  console.log(`  ✅ ${data?.length || 0} pedidos criados\n`);
  return data || [];
}

async function seedOrderStops(orders: { id: string }[]) {
  console.log('🛑 Criando paradas para pedidos...');

  const stops = [];
  for (const order of orders.slice(0, 30)) {
    const numStops = randomInt(1, 3);
    for (let i = 0; i < numStops; i++) {
      const addr = randomElement(ADDRESSES);
      stops.push({
        id: generateUUID(),
        order_id: order.id,
        stop_index: i,
        address: addr.address,
        latitude: addr.lat,
        longitude: addr.lng,
        contact_name: `${randomElement(FIRST_NAMES)} ${randomElement(LAST_NAMES)}`,
        contact_phone: generatePhone(),
        arrived_at: i === 0 ? randomDate(1).toISOString() : null,
        completed_at: i < numStops - 1 ? randomDate(1).toISOString() : null,
        created_at: randomDate(30).toISOString(),
      });
    }
  }

  const { data, error } = await supabase.from('lalamove_stops').insert(stops).select();

  if (error) {
    console.log(`  ❌ Erro ao criar paradas: ${error.message}`);
  } else {
    console.log(`  ✅ ${data?.length || 0} paradas criadas\n`);
  }
}

async function seedStatusHistory(orders: { id: string; status: string }[]) {
  console.log('📝 Criando histórico de status...');

  const history = [];
  const statusFlow: Record<string, string[]> = {
    'PENDING': ['PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP', 'COMPLETED'],
    'MATCHED': ['MATCHED', 'ON_GOING', 'PICKED_UP', 'COMPLETED', 'CANCELLED'],
    'ON_GOING': ['ON_GOING', 'PICKED_UP', 'COMPLETED', 'CANCELLED'],
    'PICKED_UP': ['PICKED_UP', 'COMPLETED', 'CANCELLED'],
    'COMPLETED': ['COMPLETED'],
    'CANCELLED': ['CANCELLED'],
  };

  for (const order of orders.slice(0, 40)) {
    const flow = statusFlow[order.status] || ['PENDING'];
    for (let i = 0; i < flow.length; i++) {
      history.push({
        id: generateUUID(),
        order_id: order.id,
        status: flow[i] as any,
        notes: i === flow.length - 1 ? `Status final: ${flow[i]}` : null,
        metadata: { step: i },
        created_at: randomDate(30 - i).toISOString(),
      });
    }
  }

  const { data, error } = await supabase.from('lalamove_status_history').insert(history).select();

  if (error) {
    console.log(`  ❌ Erro ao criar histórico: ${error.message}`);
  } else {
    console.log(`  ✅ ${data?.length || 0} entradas de histórico criadas\n`);
  }
}

async function seedIncidents(drivers: { id: string }[]) {
  console.log('⚠️  Criando incidentes...');

  const incidents = [];
  for (let i = 0; i < 15; i++) {
    const driver = randomElement(drivers);
    incidents.push({
      id: generateUUID(),
      driver_id: driver.id,
      order_id: null,
      type: randomElement(INCIDENT_TYPES) as any,
      severity: randomElement(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) as any,
      description: `Incidente registrado automaticamente pelo sistema de monitoramento`,
      metadata: { source: 'seed', index: i },
      created_at: randomDate(30).toISOString(),
    });
  }

  const { data, error } = await supabase.from('driver_incidents').insert(incidents).select();

  if (error) {
    console.log(`  ❌ Erro ao criar incidentes: ${error.message}`);
  } else {
    console.log(`  ✅ ${data?.length || 0} incidentes criados\n`);
  }
}

async function seedApprovals(drivers: { id: string }[]) {
  console.log('✅ Criando fila de aprovação...');

  const approvals = [];
  const pendingDrivers = drivers.slice(0, 10);

  for (const driver of pendingDrivers) {
    approvals.push({
      id: generateUUID(),
      driver_id: driver.id,
      order_id: generateUUID(),
      status: randomElement(['PENDING', 'APPROVED', 'REJECTED']) as any,
      risk_score: randomFloat(5, 10, 1),
      risk_factors: ['Velocidade excessiva', 'Paradas prolongadas'],
      requested_at: randomDate(7).toISOString(),
      reviewed_at: Math.random() > 0.5 ? randomDate(3).toISOString() : null,
      reviewed_by: null,
      notes: null,
    });
  }

  const { data, error } = await supabase.from('driver_approval_queue').insert(approvals).select();

  if (error) {
    console.log(`  ❌ Erro ao criar aprovações: ${error.message}`);
  } else {
    console.log(`  ✅ ${data?.length || 0} aprovações criadas\n`);
  }
}

async function seedActiveTracking(orders: { id: string }[], drivers: { id: string }[]) {
  console.log('📍 Criando rastreamento ativo...');

  const trackings = [];
  for (const order of orders.slice(0, 20)) {
    const driver = randomElement(drivers);
    const baseAddr = randomElement(ADDRESSES);

    trackings.push({
      id: generateUUID(),
      order_id: order.id,
      driver_id: driver.id,
      current_latitude: baseAddr.lat + randomFloat(-0.01, 0.01, 8),
      current_longitude: baseAddr.lng + randomFloat(-0.01, 0.01, 8),
      heading: randomFloat(0, 360, 2),
      speed: randomFloat(0, 80, 2),
      is_on_route: Math.random() > 0.2,
      is_stopped: Math.random() > 0.8,
      stopped_since: Math.random() > 0.8 ? randomDate(0.1).toISOString() : null,
      eta_minutes: randomInt(5, 45),
      last_updated: randomDate(0.1).toISOString(),
    });
  }

  const { data, error } = await supabase.from('active_tracking').insert(trackings).select();

  if (error) {
    console.log(`  ❌ Erro ao criar rastreamento: ${error.message}`);
  } else {
    console.log(`  ✅ ${data?.length || 0} rastreamentos criados\n`);
  }
}

async function seedTrackingEvents(orders: { id: string }[], drivers: { id: string }[]) {
  console.log('🗺️  Criando eventos de rastreamento...');

  const events = [];
  for (const order of orders.slice(0, 15)) {
    const driver = randomElement(drivers);
    const numEvents = randomInt(5, 20);

    for (let i = 0; i < numEvents; i++) {
      const baseAddr = randomElement(ADDRESSES);
      events.push({
        id: generateUUID(),
        order_id: order.id,
        driver_id: driver.id,
        latitude: baseAddr.lat + randomFloat(-0.02, 0.02, 8),
        longitude: baseAddr.lng + randomFloat(-0.02, 0.02, 8),
        heading: randomFloat(0, 360, 2),
        speed: randomFloat(0, 80, 2),
        event_type: randomElement(['location_update', 'stop', 'delivery']),
        metadata: { index: i },
        created_at: randomDate(7 - i * 0.1).toISOString(),
      });
    }
  }

  const { data, error } = await supabase.from('tracking_events').insert(events).select();

  if (error) {
    console.log(`  ❌ Erro ao criar eventos: ${error.message}`);
  } else {
    console.log(`  ✅ ${data?.length || 0} eventos de rastreamento criados\n`);
  }
}

async function seedAlerts(orders: { id: string }[], drivers: { id: string }[]) {
  console.log('🚨 Criando alertas...');

  const alerts = [];
  for (let i = 0; i < 25; i++) {
    const order = randomElement(orders);
    const driver = randomElement(drivers);

    alerts.push({
      id: generateUUID(),
      type: randomElement(ALERT_TYPES) as any,
      severity: randomElement(['INFO', 'WARNING', 'CRITICAL']) as any,
      title: `Alerta: ${randomElement(['Motorista desviou da rota', 'Entrega atrasada', 'Motorista parado', 'Aprovação necessária'])}`,
      message: `Alerta registrado pelo sistema de monitoramento em ${randomDate(7).toLocaleString('pt-BR')}`,
      order_id: order.id,
      driver_id: driver.id,
      is_read: Math.random() > 0.6,
      is_dismissed: Math.random() > 0.8,
      metadata: { source: 'seed' },
      created_at: randomDate(14).toISOString(),
    });
  }

  const { data, error } = await supabase.from('alerts').insert(alerts).select();

  if (error) {
    console.log(`  ❌ Erro ao criar alertas: ${error.message}`);
  } else {
    console.log(`  ✅ ${data?.length || 0} alertas criados\n`);
  }
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('\n🚀 ========================================');
  console.log('   SEED DO BANCO DE DADOS LALAMOVE V2');
  console.log('   ========================================\n');

  console.log(`📡 Conectando ao Supabase: ${SUPABASE_URL}\n`);

  try {
    // Testar conexão
    const { data: testData, error: testError } = await supabase.from('drivers').select('count').limit(1);
    if (testError) {
      console.log(`❌ Erro de conexão: ${testError.message}`);
      console.log('   Verifique se as credenciais estão corretas e o banco está acessível.\n');
      return;
    }
    console.log('✅ Conexão estabelecida com sucesso!\n');

    // Executar seed
    await clearTables();

    const drivers = await seedDrivers(20);
    const orders = await seedOrders(drivers, 50);

    if (orders.length > 0) {
      await seedOrderStops(orders);
      await seedStatusHistory(orders.map(o => ({ id: o.id, status: randomElement(ORDER_STATUSES) })));
    }

    await seedIncidents(drivers);
    await seedApprovals(drivers);

    if (orders.length > 0) {
      await seedActiveTracking(orders, drivers);
      await seedTrackingEvents(orders, drivers);
      await seedAlerts(orders, drivers);
    }

    console.log('🎉 ========================================');
    console.log('   SEED CONCLUÍDO COM SUCESSO!');
    console.log('   ========================================\n');
    console.log('📊 Resumo:');
    console.log(`   - ${drivers.length} motoristas`);
    console.log(`   - ${orders.length} pedidos`);
    console.log(`   - 15 incidentes`);
    console.log(`   - 25 alertas`);
    console.log('\n💡 O banco está pronto para testes!\n');

  } catch (error) {
    console.error('❌ Erro durante o seed:', error);
  }
}

main();
