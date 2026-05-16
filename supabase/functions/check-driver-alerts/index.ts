import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";

const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Default configuration values
const DEFAULT_STOPPED_WARNING_MINUTES = 5;
const DEFAULT_STOPPED_CRITICAL_MINUTES = 10;

interface AlertConfig {
  alert_type: string;
  is_enabled: boolean;
  config: {
    warning_minutes?: number;
    critical_minutes?: number;
    threshold_minutes?: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Checking for driver alerts...');

    // Fetch alert configurations from database
    const { data: configsData, error: configError } = await supabase
      .from('alert_configurations')
      .select('alert_type, is_enabled, config');

    if (configError) {
      console.error('Error fetching alert configs:', configError);
    }

    // Parse configurations
    const configs: Record<string, AlertConfig> = {};
    (configsData || []).forEach((c: AlertConfig) => {
      configs[c.alert_type] = c;
    });

    // Get settings with defaults
    const stoppedConfig = configs['DRIVER_STOPPED'] || { is_enabled: true, config: {} };
    const routeConfig = configs['ROUTE_DEVIATION'] || { is_enabled: true, config: {} };
    
    const STOPPED_ALERT_ENABLED = stoppedConfig.is_enabled !== false;
    const STOPPED_WARNING_MINUTES = stoppedConfig.config?.warning_minutes || DEFAULT_STOPPED_WARNING_MINUTES;
    const STOPPED_CRITICAL_MINUTES = stoppedConfig.config?.critical_minutes || DEFAULT_STOPPED_CRITICAL_MINUTES;
    const OFF_ROUTE_ALERT_ENABLED = routeConfig.is_enabled !== false;

    console.log('Alert config:', { 
      STOPPED_ALERT_ENABLED, 
      STOPPED_WARNING_MINUTES, 
      STOPPED_CRITICAL_MINUTES,
      OFF_ROUTE_ALERT_ENABLED 
    });

    // Fetch all active tracking records with driver and order details
    const { data: trackingData, error: trackingError } = await supabase
      .from('active_tracking')
      .select(`
        *,
        driver:drivers(id, name, phone, vehicle_type),
        order:lalamove_orders(id, lalamove_id, internal_order_id, customer_name, pickup_address, delivery_address)
      `);

    if (trackingError) {
      console.error('Error fetching tracking data:', trackingError);
      throw trackingError;
    }

    console.log(`Checking ${trackingData?.length || 0} active deliveries for alerts`);

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
      const orderId = order.internal_order_id || order.lalamove_id || tracking.order_id;

      // Check for long stops (only if enabled)
      if (STOPPED_ALERT_ENABLED && tracking.is_stopped && tracking.stopped_since) {
        const stoppedSince = new Date(tracking.stopped_since);
        const stoppedMinutes = Math.floor((now.getTime() - stoppedSince.getTime()) / (1000 * 60));

        if (stoppedMinutes >= STOPPED_WARNING_MINUTES) {
          // Check if we already have an active (non-dismissed) alert for this condition
          const { data: existingAlerts } = await supabase
            .from('alerts')
            .select('id, severity')
            .eq('driver_id', driver.id)
            .eq('order_id', order.id)
            .eq('type', 'DRIVER_STOPPED')
            .eq('is_dismissed', false)
            .limit(1);

          const existingAlert = existingAlerts?.[0];
          const shouldBeCritical = stoppedMinutes >= STOPPED_CRITICAL_MINUTES;
          const newSeverity = shouldBeCritical ? 'CRITICAL' : 'WARNING';

          // Only create if no alert exists OR if severity needs to be escalated
          if (!existingAlert) {
            console.log(`Creating DRIVER_STOPPED alert for ${driverName} - stopped for ${stoppedMinutes} minutes (${newSeverity})`);
            
            alertsToCreate.push({
              type: 'DRIVER_STOPPED',
              severity: newSeverity,
              title: `Motorista parado há ${stoppedMinutes} minutos`,
              message: `${driverName} está parado há ${stoppedMinutes} minutos durante a entrega do pedido ${orderId}. Local: ${tracking.current_latitude.toFixed(5)}, ${tracking.current_longitude.toFixed(5)}`,
              driver_id: driver.id,
              order_id: order.id,
              metadata: {
                stopped_since: tracking.stopped_since,
                stopped_minutes: stoppedMinutes,
                location: {
                  latitude: tracking.current_latitude,
                  longitude: tracking.current_longitude
                },
                customer_name: order.customer_name,
                delivery_address: order.delivery_address
              }
            });
          } else if (existingAlert.severity === 'WARNING' && shouldBeCritical) {
            // Escalate to critical
            console.log(`Escalating DRIVER_STOPPED alert to CRITICAL for ${driverName}`);
            await supabase
              .from('alerts')
              .update({
                severity: 'CRITICAL',
                title: `Motorista parado há ${stoppedMinutes} minutos`,
                message: `${driverName} está parado há ${stoppedMinutes} minutos durante a entrega do pedido ${orderId}. ATENÇÃO: Tempo crítico atingido!`,
              })
              .eq('id', existingAlert.id);
          }
        }
      }

      // Check for off-route (only if enabled)
      if (OFF_ROUTE_ALERT_ENABLED && tracking.is_on_route === false) {
        // Check if we already have an active (non-dismissed) alert for this condition
        const { data: existingAlerts } = await supabase
          .from('alerts')
          .select('id')
          .eq('driver_id', driver.id)
          .eq('order_id', order.id)
          .eq('type', 'ROUTE_DEVIATION')
          .eq('is_dismissed', false)
          .limit(1);

        if (!existingAlerts || existingAlerts.length === 0) {
          console.log(`Creating ROUTE_DEVIATION alert for ${driverName}`);
          
          alertsToCreate.push({
            type: 'ROUTE_DEVIATION',
            severity: 'WARNING',
            title: `Motorista fora da rota`,
            message: `${driverName} saiu da rota planejada durante a entrega do pedido ${orderId}. Verifique se há algum problema.`,
            driver_id: driver.id,
            order_id: order.id,
            metadata: {
              current_location: {
                latitude: tracking.current_latitude,
                longitude: tracking.current_longitude
              },
              customer_name: order.customer_name,
              pickup_address: order.pickup_address,
              delivery_address: order.delivery_address,
              eta_minutes: tracking.eta_minutes
            }
          });
        }
      }

      // Auto-dismiss alerts when conditions are resolved
      // If driver was stopped but is now moving, dismiss DRIVER_STOPPED alerts
      if (!tracking.is_stopped) {
        const { error: dismissError } = await supabase
          .from('alerts')
          .update({ is_dismissed: true })
          .eq('driver_id', driver.id)
          .eq('order_id', order.id)
          .eq('type', 'DRIVER_STOPPED')
          .eq('is_dismissed', false);

        if (dismissError) {
          console.error('Error dismissing DRIVER_STOPPED alerts:', dismissError);
        }
      }

      // If driver was off-route but is now on route, dismiss ROUTE_DEVIATION alerts
      if (tracking.is_on_route === true) {
        const { error: dismissError } = await supabase
          .from('alerts')
          .update({ is_dismissed: true })
          .eq('driver_id', driver.id)
          .eq('order_id', order.id)
          .eq('type', 'ROUTE_DEVIATION')
          .eq('is_dismissed', false);

        if (dismissError) {
          console.error('Error dismissing ROUTE_DEVIATION alerts:', dismissError);
        }
      }
    }

    // Insert all new alerts
    if (alertsToCreate.length > 0) {
      const { data: insertedAlerts, error: insertError } = await supabase
        .from('alerts')
        .insert(alertsToCreate)
        .select();

      if (insertError) {
        console.error('Error inserting alerts:', insertError);
      } else {
        console.log(`Created ${insertedAlerts?.length || 0} new alerts`);
      }
    }

    // Get count of active alerts
    const { count: activeAlertsCount } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_dismissed', false);

    console.log(`Check complete. Active alerts: ${activeAlertsCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: alertsToCreate.length,
        active_alerts: activeAlertsCount,
        config: {
          stopped_enabled: STOPPED_ALERT_ENABLED,
          stopped_warning_minutes: STOPPED_WARNING_MINUTES,
          stopped_critical_minutes: STOPPED_CRITICAL_MINUTES,
          off_route_enabled: OFF_ROUTE_ALERT_ENABLED
        },
        message: `Created ${alertsToCreate.length} new alerts. Total active: ${activeAlertsCount}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Alert check error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error occurred during driver alerts check' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
