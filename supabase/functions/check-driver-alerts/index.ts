import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";
import {
  errorResponse,
  parseJsonBody,
  resolveContractVersion,
  validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";
import { notifyDriver } from "../_shared/messaging/notify-driver.ts";
import {
  sendConfirmationEscalations,
  sendConfirmationNudges,
  sendScheduledReminders,
} from "../_shared/messaging/auto-notices.ts";

const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Default configuration values
const DEFAULT_STOPPED_WARNING_MINUTES = 5;
const DEFAULT_STOPPED_CRITICAL_MINUTES = 10;
const DEFAULT_POD_DEADLINE_MINUTES = 30;

interface AlertConfig {
  alert_type: string;
  is_enabled: boolean;
  config: {
    warning_minutes?: number;
    critical_minutes?: number;
    threshold_minutes?: number;
    pod_deadline_minutes?: number;
  };
}

/**
 * Aviso ao motorista pelo motor do Bloco 7 (M9 e M10 do plano de mensageria).
 * Rota desligada, modo sombra, horario silencioso e dedup por
 * `client_message_id` ficam dentro de `notifyDriver`; aqui so garantimos que
 * uma falha de mensagem nao derrube a checagem do Guardian.
 */
// deno-lint-ignore no-explicit-any
async function avisarMotorista(supabase: any, event: string, driverId: string, orderId: string): Promise<void> {
  try {
    const result = await notifyDriver(supabase, { event, driverId, orderId });
    logger.log(`[Guardian] Aviso ${event} ao motorista: ${result.outcome}${result.reason ? ` (${result.reason})` : ''}${result.channel ? ` via ${result.channel}` : ''}`);
  } catch (error) {
    logger.error(`[Guardian] Aviso ${event} ao motorista falhou:`, error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // Contrato de entrada (formato único de erro 422 + versão v1/v2):
    // supabase/functions/_shared/contract.ts e _shared/schemas.ts.
    const contractVersion = resolveContractVersion(req);
    trackContractUsage("check-driver-alerts", contractVersion);
    const parsedBody = await parseJsonBody(req, contractVersion);
    if (!parsedBody.ok) return errorResponse(parsedBody, corsHeaders);
    const contract = validateContract(
      getSchema("check-driver-alerts", contractVersion),
      parsedBody.value,
      contractVersion,
    );
    if (!contract.ok) return errorResponse(contract, corsHeaders);
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    logger.log('Checking for driver alerts (Guardian System)...');

    // Fetch alert configurations from database
    const { data: configsData, error: configError } = await supabase
      .from('alert_configurations')
      .select('alert_type, is_enabled, config');

    if (configError) {
      logger.error('Error fetching alert configs:', configError);
    }

    // Parse configurations
    const configs: Record<string, AlertConfig> = {};
    (configsData || []).forEach((c: AlertConfig) => {
      configs[c.alert_type] = c;
    });

    // Get settings with defaults
    const stoppedConfig = configs['DRIVER_STOPPED'] || { is_enabled: true, config: {} };
    const routeConfig = configs['ROUTE_DEVIATION'] || { is_enabled: true, config: {} };
    const podConfig = configs['MISSING_POD'] || { is_enabled: true, config: {} };
    
    const STOPPED_ALERT_ENABLED = stoppedConfig.is_enabled !== false;
    const OFF_ROUTE_ALERT_ENABLED = routeConfig.is_enabled !== false;
    const POD_ALERT_ENABLED = podConfig.is_enabled !== false;
    const POD_DEADLINE = podConfig.config?.pod_deadline_minutes || DEFAULT_POD_DEADLINE_MINUTES;

    // Fetch all active tracking records with driver and order details
    const { data: trackingData, error: trackingError } = await supabase
      .from('active_tracking')
      .select(`
        *,
        driver:drivers(id, name, phone, vehicle_type),
        order:lalamove_orders(
          id, 
          lalamove_id, 
          internal_order_id, 
          customer_name, 
          pickup_address, 
          delivery_address, 
          stalled_threshold_minutes, 
          route_deviation_threshold_minutes,
          requires_pod,
          pod_received,
          status,
          actual_delivery,
          auto_notify_supplier,
          supplier_contact
        )
      `);

    if (trackingError) {
      logger.error('Error fetching tracking data:', trackingError);
      throw trackingError;
    }

    logger.log(`Checking ${trackingData?.length || 0} active deliveries for alerts`);

    const alertsToCreate: Array<{
      type: string;
      severity: string;
      title: string;
      message: string;
      driver_id: string;
      order_id: string;
      metadata: Record<string, unknown>;
    }> = [];

    const now = new Date();

    for (const tracking of trackingData || []) {
      const driver = tracking.driver;
      const order = tracking.order;
      
      if (!driver || !order) continue;

      const driverName = driver.name || 'Motorista desconhecido';
      const orderIdDisplay = order.internal_order_id || order.lalamove_id || tracking.order_id;

      // 1. Check for long stops (Guardian stalled_threshold_minutes)
      if (STOPPED_ALERT_ENABLED && tracking.is_stopped && tracking.stopped_since) {
        const stoppedSince = new Date(tracking.stopped_since);
        const stoppedMinutes = Math.floor((now.getTime() - stoppedSince.getTime()) / (1000 * 60));
        
        // Use order-specific threshold if available, otherwise fallback to defaults
        const warningThreshold = order.stalled_threshold_minutes || DEFAULT_STOPPED_WARNING_MINUTES;
        const criticalThreshold = warningThreshold * 2;

        if (stoppedMinutes >= warningThreshold) {
          const { data: existingAlerts } = await supabase
            .from('alerts')
            .select('id, severity, metadata')
            .eq('driver_id', driver.id)
            .eq('order_id', order.id)
            .eq('type', 'DRIVER_STOPPED')
            .eq('is_dismissed', false)
            .limit(1);

          const existingAlert = existingAlerts?.[0];
          const shouldBeCritical = stoppedMinutes >= criticalThreshold;
          const newSeverity = shouldBeCritical ? 'CRITICAL' : 'WARNING';

          if (!existingAlert) {
            const alertData = {
              type: 'DRIVER_STOPPED',
              severity: newSeverity,
              title: `Motorista parado há ${stoppedMinutes} minutos`,
              message: `${driverName} está parado há ${stoppedMinutes} minutos durante a entrega ${orderIdDisplay}. Threshold: ${warningThreshold}min.`,
              driver_id: driver.id,
              order_id: order.id,
              metadata: { 
                stopped_minutes: stoppedMinutes, 
                threshold: warningThreshold,
                guardian_triggered: true,
                auto_resolved: false
              }
            };
            
            const { data: newAlert } = await supabase.from('alerts').insert(alertData).select().single();
            
            // Guardian: Auto-notify supplier if configured
            if (newAlert && order.auto_notify_supplier && order.supplier_contact) {
              logger.log(`[Guardian] Auto-notifying supplier ${order.supplier_contact} for order ${order.id}`);
              await supabase.functions.invoke('send-notification', {
                body: {
                  alert_id: newAlert.id,
                  type: 'SUPPLIER_DELAY_NOTICE',
                  severity: 'WARNING',
                  title: 'Aviso de Atraso Guardian',
                  message: `[Guardian] Olá, o motorista ${driverName} está parado há ${stoppedMinutes}min próximo à região de coleta/entrega. Pedido: ${orderIdDisplay}.`,
                  order_id: order.id,
                  metadata: { recipients: [{ role: 'supplier', channel: 'whatsapp', to: order.supplier_contact }] }
                }
              });
            }
          } else if (existingAlert.severity === 'WARNING' && shouldBeCritical) {
            await supabase.from('alerts').update({
              severity: 'CRITICAL',
              title: `ALERTA CRÍTICO: Motorista parado há ${stoppedMinutes} minutos`,
              message: `${driverName} atingiu o tempo CRÍTICO de parada na entrega ${orderIdDisplay}.`,
            }).eq('id', existingAlert.id);
          }
        }
      }

      // 2. Check for off-route (Guardian route_deviation_threshold_minutes)
      if (OFF_ROUTE_ALERT_ENABLED && tracking.is_on_route === false) {
        // Here we could also check duration if we had "off_route_since"
        // For now, any deviation triggers a warning
        const { data: existingAlerts } = await supabase
          .from('alerts')
          .select('id')
          .eq('driver_id', driver.id)
          .eq('order_id', order.id)
          .eq('type', 'ROUTE_DEVIATION')
          .eq('is_dismissed', false)
          .limit(1);

        if (!existingAlerts || existingAlerts.length === 0) {
          alertsToCreate.push({
            type: 'ROUTE_DEVIATION',
            severity: 'WARNING',
            title: `Desvio de Rota Detectado`,
            message: `${driverName} saiu da rota planejada para ${orderIdDisplay}.`,
            driver_id: driver.id,
            order_id: order.id,
            metadata: { location: { lat: tracking.current_latitude, lng: tracking.current_longitude } }
          });
        }
      }

      // 3. Check for Missing POD (Guardian requires_pod)
      // O aviso ao motorista (M9, motor do Bloco 7) nao depende de
      // `POD_ALERT_ENABLED`: quem decide e a rota MISSING_POD do painel de
      // mensageria. O alerta legado continua respeitando a configuracao.
      if (order.requires_pod && !order.pod_received) {
        // If order is COMPLETED but no POD received after deadline
        if (order.status === 'COMPLETED' && order.actual_delivery) {
          const deliveredAt = new Date(order.actual_delivery);
          const minutesSinceDelivery = Math.floor((now.getTime() - deliveredAt.getTime()) / (1000 * 60));

          if (minutesSinceDelivery >= POD_DEADLINE) {
            const { data: existingAlerts } = await supabase
              .from('alerts')
              .select('id')
              .eq('order_id', order.id)
              .eq('type', 'MISSING_POD')
              .eq('is_dismissed', false)
              .limit(1);

            if (!existingAlerts || existingAlerts.length === 0) {
              if (POD_ALERT_ENABLED) {
                alertsToCreate.push({
                  type: 'MISSING_POD',
                  severity: 'CRITICAL',
                  title: `Falta Prova de Entrega (POD)`,
                  message: `Pedido ${orderIdDisplay} finalizado há ${minutesSinceDelivery} min sem foto de comprovação.`,
                  driver_id: driver.id,
                  order_id: order.id,
                  metadata: { minutes_late: minutesSinceDelivery }
                });
              }
              // Lembrete do comprovante para o motorista, sem operador no meio.
              await avisarMotorista(supabase, 'MISSING_POD', driver.id, order.id);
            }
          }
        }
      }

      // 4. Auto-dismiss alerts when conditions are resolved
      if (!tracking.is_stopped) {
        await supabase.from('alerts').update({ is_dismissed: true }).eq('driver_id', driver.id).eq('order_id', order.id).eq('type', 'DRIVER_STOPPED').eq('is_dismissed', false);
      }
      if (tracking.is_on_route === true) {
        await supabase.from('alerts').update({ is_dismissed: true }).eq('driver_id', driver.id).eq('order_id', order.id).eq('type', 'ROUTE_DEVIATION').eq('is_dismissed', false);
      }
    }

    // M11 (etapa 111): lembrete do pedido agendado 30 min antes da coleta.
    // O cron roda a cada 2 min; o ledger de mensagens garante um por pedido.
    const reminders = await sendScheduledReminders(
      supabase,
      now,
      (event, driverId, orderId) => avisarMotorista(supabase, event, driverId, orderId),
    );
    if (reminders.sent > 0) {
      logger.log(`[Guardian] Lembretes agendados: ${reminders.sent} de ${reminders.checked}`);
    }

    // M2 (etapa 102): 2 min depois de avisar a atribuicao, pede confirmacao ao
    // motorista. Sem resposta, a cobranca de timeout fica com a etapa 102.
    const nudges = await sendConfirmationNudges(
      supabase,
      now,
      (event, driverId, orderId) => avisarMotorista(supabase, event, driverId, orderId),
    );
    if (nudges.checked > 0) {
      logger.log(`[Guardian] Confirmacao (M2): avisados ${nudges.sent} de ${nudges.checked} pedido(s) com aviso de atribuicao`);
    }

    // M2 (etapa 102): vencido o prazo de resposta da cobranca, a operacao recebe
    // o alerta interno. Rodar depois dos avisos mantem a ordem do fluxo.
    const escalations = await sendConfirmationEscalations(supabase, now);
    if (escalations.alerted > 0) {
      logger.log(`[Guardian] Confirmacao (M2): ${escalations.alerted} de ${escalations.checked} pedido(s) sem resposta viraram alerta interno`);
    }

    // Insert remaining new alerts (not handled individually above)
    if (alertsToCreate.length > 0) {
      await supabase.from('alerts').insert(alertsToCreate);
    }

    return new Response(JSON.stringify({ success: true, created: alertsToCreate.length, reminders: reminders.sent, confirmations: nudges.sent, noConfirmations: escalations.alerted }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    logger.error('Guardian check error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
