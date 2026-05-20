import mapboxgl from 'mapbox-gl';
import { vehicleIcons, vehicleColors } from './types';
import type { TrackingData } from './hooks/useTrackingData';

export function createDriverMarkerElement(tracking: TrackingData, isSelected: boolean = false): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `live-map-driver-marker ${isSelected ? 'is-selected' : ''}`;
  const vehicleType = tracking.driver?.vehicle_type || 'MOTORCYCLE';
  const baseColor = vehicleColors[vehicleType] || '#00d9ff';
  
  let statusColor = baseColor;
  let pulseColor = baseColor;
  let animation = 'pulse-glow 2s infinite';
  
  if (tracking.is_stopped) {
    statusColor = '#f59e0b';
    pulseColor = '#f59e0b';
    animation = 'pulse-warning 3s infinite';
  } else if (!tracking.is_on_route) {
    statusColor = '#ef4444';
    pulseColor = '#ef4444';
    animation = 'pulse-critical 1.5s infinite';
  }

  const icon = vehicleIcons[vehicleType] || '🚗';

  el.innerHTML = `
    <div class="driver-marker-container" style="position:relative;cursor:pointer;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);z-index:${isSelected ? 100 : 1}">
      <div class="marker-pulse" style="position:absolute;inset:-8px;border-radius:50%;background:${pulseColor}30;animation:${animation};z-index:-1;"></div>
      <div class="marker-core" style="width:52px;height:52px;background:linear-gradient(135deg,${statusColor},${statusColor}dd);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px ${statusColor}60, 0 0 0 ${isSelected ? '4px' : '2px'} rgba(255,255,255,0.8);border:2px solid white;font-size:24px;transform:${isSelected ? 'scale(1.1)' : 'scale(1)'};transition:transform 0.3s ease;">
        ${icon}
      </div>
      <div class="marker-label" style="position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);color:white;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);opacity:${isSelected ? 1 : 0.9};">
        ${tracking.driver?.name?.split(' ')[0] || 'Motorista'}
      </div>
    </div>`;

  if (tracking.heading) {
    const core = el.querySelector('.marker-core') as HTMLElement;
    if (core) core.style.transform += ` rotate(${tracking.heading}deg)`;
  }
  
  return el;
}

export function createPickupMarkerElement(tracking: TrackingData): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'pickup-marker';
  const locationName = tracking.order?.pickup_address?.split(',')[0] || 'Coleta';
  el.innerHTML = `
    <div style="position:relative;cursor:pointer;">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(16,185,129,0.4);border:2px solid white;">
        <span style="transform:rotate(45deg);font-size:16px;">📦</span>
      </div>
      <div style="position:absolute;top:-28px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.2);">${locationName}</div>
    </div>`;
  return el;
}

export function createDeliveryMarkerElement(tracking: TrackingData): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'delivery-marker';
  const locationName = tracking.order?.delivery_address?.split(',')[0] || 'Entrega';
  el.innerHTML = `
    <div style="position:relative;cursor:pointer;">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,#f43f5e,#e11d48);border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(244,63,94,0.4);border:2px solid white;">
        <span style="transform:rotate(45deg);font-size:16px;">📍</span>
      </div>
      <div style="position:absolute;top:-28px;left:50%;transform:translateX(-50%);background:#f43f5e;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.2);">${locationName}</div>
    </div>`;
  return el;
}

export function createDriverPopup(tracking: TrackingData): mapboxgl.Popup {
  const driverName = tracking.driver?.name || 'Motorista';
  const vehicleType = tracking.driver?.vehicle_type || 'MOTORCYCLE';
  const orderId = tracking.order?.internal_order_id || tracking.order?.lalamove_id || tracking.order_id;
  const customerName = tracking.order?.customer_name || '-';
  const pickupAddress = tracking.order?.pickup_address || '-';
  const deliveryAddress = tracking.order?.delivery_address || '-';
  const speed = tracking.speed ? `${tracking.speed} km/h` : '-';
  const eta = tracking.eta_minutes ? `${tracking.eta_minutes} min` : '-';

  let statusText = 'Em trânsito';
  let statusColor = '#00d9ff';
  if (tracking.is_stopped) { statusText = 'Parado'; statusColor = '#f59e0b'; }
  else if (!tracking.is_on_route) { statusText = 'Fora da rota'; statusColor = '#ef4444'; }

  return new mapboxgl.Popup({ offset: 30, closeButton: true, className: 'custom-popup' }).setHTML(`
    <div style="background:linear-gradient(145deg,#1a1a2e,#16162a);color:white;padding:16px;border-radius:12px;min-width:280px;font-family:system-ui;box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="width:44px;height:44px;background:${vehicleColors[vehicleType] || '#00d9ff'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;">${vehicleIcons[vehicleType] || '🚗'}</div>
        <div>
          <div style="font-weight:700;font-size:16px;margin-bottom:2px;">${driverName}</div>
          <div style="font-size:11px;color:${statusColor};font-weight:600;">● ${statusText}</div>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:11px;color:#888;margin-bottom:4px;">PEDIDO</div>
        <div style="font-size:13px;font-weight:600;font-family:monospace;">${orderId}</div>
        <div style="font-size:12px;color:#aaa;margin-top:2px;">Cliente: ${customerName}</div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
          <span style="font-size:14px;">📦</span>
          <div><div style="font-size:10px;color:#10b981;font-weight:600;">COLETA</div><div style="font-size:12px;color:#ddd;">${pickupAddress}</div></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="font-size:14px;">📍</span>
          <div><div style="font-size:10px;color:#f43f5e;font-weight:600;">ENTREGA</div><div style="font-size:12px;color:#ddd;">${deliveryAddress}</div></div>
        </div>
      </div>
      <div style="display:flex;gap:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);">
        <div><div style="font-size:10px;color:#888;">VELOCIDADE</div><div style="font-size:14px;font-weight:700;">${speed}</div></div>
        <div><div style="font-size:10px;color:#888;">ETA</div><div style="font-size:14px;font-weight:700;color:#00d9ff;">${eta}</div></div>
      </div>
      <button onclick="window.dispatchEvent(new CustomEvent('show-driver-history',{detail:{driverId:'${tracking.driver_id}',orderId:'${tracking.order_id}',driverName:'${driverName}'}}))" style="width:100%;margin-top:12px;padding:8px 12px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border:none;border-radius:8px;color:white;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">📍 Ver Trajeto Percorrido</button>
    </div>
  `);
}
