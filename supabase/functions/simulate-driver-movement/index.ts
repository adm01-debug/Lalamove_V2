import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting driver movement simulation...');

    // Fetch all active tracking records with order details
    const { data: trackingData, error: trackingError } = await supabase
      .from('active_tracking')
      .select(`
        *,
        order:lalamove_orders(
          delivery_latitude,
          delivery_longitude,
          pickup_latitude,
          pickup_longitude
        )
      `);

    if (trackingError) {
      console.error('Error fetching tracking data:', trackingError);
      throw trackingError;
    }

    console.log(`Found ${trackingData?.length || 0} active deliveries to simulate`);

    const updates = [];

    for (const tracking of trackingData || []) {
      const order = tracking.order;
      if (!order?.delivery_latitude || !order?.delivery_longitude) {
        console.log(`Skipping tracking ${tracking.id} - no delivery coordinates`);
        continue;
      }

      const currentLat = Number(tracking.current_latitude);
      const currentLng = Number(tracking.current_longitude);
      const deliveryLat = Number(order.delivery_latitude);
      const deliveryLng = Number(order.delivery_longitude);

      // Calculate distance to delivery
      const latDiff = deliveryLat - currentLat;
      const lngDiff = deliveryLng - currentLng;
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

      // If very close to delivery, don't move
      if (distance < 0.0005) {
        console.log(`Driver ${tracking.driver_id} arrived at destination`);
        continue;
      }

      // Simulate movement - move 5-15% towards destination with some randomness
      const movePercent = 0.05 + Math.random() * 0.1;
      const randomOffset = () => (Math.random() - 0.5) * 0.0005; // Small random deviation

      let newLat = currentLat + (latDiff * movePercent) + randomOffset();
      let newLng = currentLng + (lngDiff * movePercent) + randomOffset();

      // Calculate heading (direction of movement in degrees)
      const heading = Math.atan2(lngDiff, latDiff) * (180 / Math.PI);
      const normalizedHeading = (heading + 360) % 360;

      // Simulate speed (km/h) based on vehicle type - faster vehicles move more
      const baseSpeed = tracking.is_stopped ? 0 : 20 + Math.random() * 40;

      // Calculate new ETA based on remaining distance
      const remainingDistance = Math.sqrt(
        Math.pow(deliveryLat - newLat, 2) + Math.pow(deliveryLng - newLng, 2)
      );
      // Rough estimate: 1 degree ≈ 111km, average speed 30km/h
      const etaMinutes = Math.round((remainingDistance * 111 * 60) / 30);

      // Randomly toggle stopped status (5% chance)
      const shouldStop = !tracking.is_stopped && Math.random() < 0.05;
      const shouldResume = tracking.is_stopped && Math.random() < 0.3;

      const isNowStopped = shouldStop || (tracking.is_stopped && !shouldResume);

      // If stopped, don't update position
      if (isNowStopped) {
        newLat = currentLat;
        newLng = currentLng;
      }

      // Randomly toggle off-route status (3% chance to go off, 20% to return)
      const shouldGoOffRoute = tracking.is_on_route && Math.random() < 0.03;
      const shouldReturnToRoute = !tracking.is_on_route && Math.random() < 0.2;
      const isOnRoute = !shouldGoOffRoute && (tracking.is_on_route || shouldReturnToRoute);

      updates.push({
        id: tracking.id,
        current_latitude: newLat,
        current_longitude: newLng,
        heading: normalizedHeading,
        speed: isNowStopped ? 0 : baseSpeed,
        eta_minutes: etaMinutes,
        is_stopped: isNowStopped,
        stopped_since: isNowStopped && !tracking.is_stopped ? new Date().toISOString() : 
                       (isNowStopped ? tracking.stopped_since : null),
        is_on_route: isOnRoute,
        last_updated: new Date().toISOString(),
      });

      console.log(`Updating driver ${tracking.driver_id}: ${currentLat.toFixed(5)},${currentLng.toFixed(5)} -> ${newLat.toFixed(5)},${newLng.toFixed(5)}`);
    }

    // Apply all updates
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('active_tracking')
        .update(update)
        .eq('id', update.id);

      if (updateError) {
        console.error(`Error updating tracking ${update.id}:`, updateError);
      }
    }

    // Also insert tracking events for history
    const trackingEvents = updates.map(u => ({
      driver_id: trackingData?.find(t => t.id === u.id)?.driver_id,
      order_id: trackingData?.find(t => t.id === u.id)?.order_id,
      latitude: u.current_latitude,
      longitude: u.current_longitude,
      speed: u.speed,
      heading: u.heading,
      event_type: u.is_stopped ? 'stopped' : (u.is_on_route ? 'moving' : 'off_route'),
    })).filter(e => e.driver_id && e.order_id);

    if (trackingEvents.length > 0) {
      const { error: eventsError } = await supabase
        .from('tracking_events')
        .insert(trackingEvents);

      if (eventsError) {
        console.error('Error inserting tracking events:', eventsError);
      }
    }

    console.log(`Successfully updated ${updates.length} driver positions`);

    // Call check-driver-alerts function to generate alerts
    try {
      const alertsResponse = await fetch(`${supabaseUrl}/functions/v1/check-driver-alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });
      const alertsResult = await alertsResponse.json();
      console.log('Alerts check result:', alertsResult);
    } catch (alertError) {
      console.error('Error checking alerts:', alertError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: updates.length,
        message: `Updated ${updates.length} driver positions`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Simulation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
