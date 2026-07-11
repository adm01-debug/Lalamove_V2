import mapboxgl from 'mapbox-gl';
import { vehicleIcons, vehicleColors } from './types';
import { statusColor as statusHsl, statusGlyph, STATUS_A11Y_LABEL, type StatusLevel } from '@/lib/statusPalette';
import type { TrackingData } from './hooks/useTrackingData';

export type MarkerDensity = 'comfortable' | 'compact';

export interface ClusterInfo {
  count: number;
  critical: number;
  attention: number;
  operational: number;
  /** Contagem por tipo de veículo (ex.: { MOTORCYCLE: 4, CAR: 2 }). */
  byVehicle?: Record<string, number>;
}

/** Rótulos amigáveis (PT-BR) para os códigos de tipo de veículo da Lalamove. */
const VEHICLE_LABELS: Record<string, string> = {
  MOTORCYCLE: 'Moto',
  CAR: 'Carro',
  VAN: 'Van',
  TRUCK: 'Caminhão',
};

/** Escapa texto para interpolação segura em HTML (defesa contra dados imprevistos). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Cria o elemento visual de um cluster agregado (usado em zoom muito distante).
 * A cor dominante prioriza severidade (crítico > atenção > operacional) para
 * comunicar risco antes mesmo de o operador ampliar o mapa. O tamanho escala
 * suavemente com a contagem, mantendo legibilidade sem poluir o mapa.
 * Um rodapé com badges por tipo de veículo dá composição da frota no grupo,
 * e um tooltip detalhado no hover revela a decomposição completa por status
 * e por tipo de veículo, sem exigir zoom.
 */
export function createClusterMarkerElement(info: ClusterInfo): HTMLDivElement {
  const { count, critical, attention, operational, byVehicle } = info;
  const level: StatusLevel = critical > 0 ? 'critical' : attention > 0 ? 'attention' : 'operational';
  const color = statusHsl(level);
  const glyph = statusGlyph(level);
  const a11y = `${count} entregas agrupadas — ${STATUS_A11Y_LABEL[level]}`;

  // Escala logarítmica limitada para evitar bolhas gigantes com muitos itens.
  const size = Math.round(Math.min(72, 40 + Math.log2(count + 1) * 8));
  const fontSize = count > 99 ? 15 : 18;

  // Badges por tipo de veículo: ordenados por volume, limitados a 3 para não poluir.
  const allVehicleEntries = Object.entries(byVehicle ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const vehicleEntries = allVehicleEntries.slice(0, 3);
  const vehicleA11y = vehicleEntries.length
    ? ' — ' + vehicleEntries.map(([type, n]) => `${n} ${(VEHICLE_LABELS[type] || type).toLowerCase()}`).join(', ')
    : '';

  const badgesHtml = vehicleEntries.length
    ? `<div aria-hidden="true" style="display:flex;gap:3px;margin-top:5px;flex-wrap:wrap;justify-content:center;max-width:96px;">
        ${vehicleEntries.map(([type, n]) => `
          <span style="display:inline-flex;align-items:center;gap:2px;background:rgba(15,23,42,0.92);color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:9px;border:1px solid rgba(255,255,255,0.18);line-height:1.4;box-shadow:0 2px 6px rgba(0,0,0,0.3);">
            <span style="font-size:10px;">${vehicleIcons[type] || '🚗'}</span>${n}
          </span>`).join('')}
      </div>`
    : '';

  // Linhas de status para o tooltip — só exibe as que têm ocorrências.
  const statusRows = ([
    ['critical', critical],
    ['attention', attention],
    ['operational', operational],
  ] as const)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([lvl, n]) => `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${statusHsl(lvl as StatusLevel)};flex:0 0 auto;"></span>
        <span style="flex:1 1 auto;">${escapeHtml(STATUS_A11Y_LABEL[lvl as StatusLevel])}</span>
        <span style="font-weight:800;">${n}</span>
      </div>`)
    .join('');

  // Lista completa de veículos no tooltip (sem limite de 3).
  const vehicleRows = allVehicleEntries
    .map(([type, n]) => `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:12px;flex:0 0 auto;">${vehicleIcons[type] || '🚗'}</span>
        <span style="flex:1 1 auto;">${escapeHtml(VEHICLE_LABELS[type] || type)}</span>
        <span style="font-weight:800;">${n}</span>
      </div>`)
    .join('');

  const tooltipHtml = `
    <div class="live-map-cluster-tooltip" aria-hidden="true" style="position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%) translateY(4px);min-width:150px;max-width:220px;background:rgba(15,23,42,0.97);color:#fff;border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:10px 12px;font-family:system-ui;font-size:11px;line-height:1.5;box-shadow:0 12px 32px rgba(0,0,0,0.45);opacity:0;visibility:hidden;pointer-events:none;transition:opacity 0.16s ease,transform 0.16s ease,visibility 0.16s;z-index:200;">
      <div style="font-weight:900;font-size:12px;margin-bottom:6px;">${count} entregas agrupadas</div>
      ${statusRows ? `<div style="display:flex;flex-direction:column;gap:3px;">${statusRows}</div>` : ''}
      ${vehicleRows ? `<div style="height:1px;background:rgba(255,255,255,0.12);margin:8px 0;"></div><div style="display:flex;flex-direction:column;gap:3px;">${vehicleRows}</div>` : ''}
      <div style="position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:rgba(15,23,42,0.97);"></div>
    </div>`;

  const el = document.createElement('div');
  el.className = 'live-map-cluster-marker';
  el.innerHTML = `
    <div role="img" aria-label="${a11y}${vehicleA11y}" title="${a11y}${vehicleA11y}" style="position:relative;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      ${tooltipHtml}
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:-8px;border-radius:50%;background:${statusHsl(level, 0.22)};animation:pulse-glow 2.5s infinite;z-index:-1;"></div>
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${color},${statusHsl(level, 0.85)});display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-weight:900;border:3px solid rgba(255,255,255,0.95);box-shadow:0 8px 28px ${statusHsl(level, 0.5)};font-family:system-ui;line-height:1;">
          <span style="font-size:${fontSize}px;letter-spacing:-0.5px;">${count}</span>
          ${critical > 0 || attention > 0 ? `<span aria-hidden="true" style="font-size:10px;opacity:0.9;margin-top:1px;">${glyph}</span>` : ''}
        </div>
      </div>
      ${badgesHtml}
    </div>`;

  // Toggle do tooltip no hover — anima via opacity/visibility.
  const tooltip = el.querySelector<HTMLDivElement>('.live-map-cluster-tooltip');
  if (tooltip) {
    const show = () => {
      tooltip.style.opacity = '1';
      tooltip.style.visibility = 'visible';
      tooltip.style.transform = 'translateX(-50%) translateY(0)';
    };
    const hide = () => {
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'hidden';
      tooltip.style.transform = 'translateX(-50%) translateY(4px)';
    };
    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);
  }

  return el;
}



export function createDriverMarkerElement(tracking: TrackingData, isSelected: boolean = false, density: MarkerDensity = 'comfortable'): HTMLDivElement {
  const isCompact = density === 'compact';
  const coreSize = isCompact ? 38 : 52;
  const iconFont = isCompact ? 18 : 24;
  const el = document.createElement('div');
  el.className = `live-map-driver-marker group ${isSelected ? 'is-selected' : ''}`;
  const vehicleType = tracking.driver?.vehicle_type || 'MOTORCYCLE';
  const baseColor = vehicleColors[vehicleType] || '#00d9ff';
  
  let statusColor = baseColor;
  let pulseColor = baseColor;
  let animation = 'pulse-glow 2s infinite';
  let statusLevel: StatusLevel = 'operational';

  if (tracking.is_stopped) {
    statusColor = statusHsl('attention');
    pulseColor = statusHsl('attention');
    animation = 'pulse-warning 3s infinite';
    statusLevel = 'attention';
  } else if (tracking.is_on_route === false) {
    statusColor = statusHsl('critical');
    pulseColor = statusHsl('critical');
    animation = 'pulse-critical 1.5s infinite';
    statusLevel = 'critical';
  }

  // Reforço color-blind-safe: forma/símbolo distinto além da cor.
  const glyph = statusGlyph(statusLevel);
  const statusA11y = STATUS_A11Y_LABEL[statusLevel];

  // Aplica alpha de forma segura tanto em cores hex (#rrggbb) quanto hsl(...).
  const fade = (color: string, alpha: number): string => {
    if (color.startsWith('hsl')) {
      return color.replace(/^hsl\(/, 'hsla(').replace(/\)$/, ` / ${alpha})`);
    }
    const hex = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
      .toString(16)
      .padStart(2, '0');
    return `${color}${hex}`;
  };

  const icon = vehicleIcons[vehicleType] || '🚗';
  const speed = tracking.speed || 0;
  const heading = tracking.heading || 0;

  // Predictive Arrow Length based on speed
  const arrowLength = Math.min(speed * 0.8, 60);

  el.innerHTML = `
    <div class="driver-marker-container" style="position:relative;cursor:pointer;transition:all 0.5s cubic-bezier(0.23, 1, 0.32, 1);z-index:${isSelected ? 100 : 1}">
      <!-- Predictive Path Arrow -->
      ${speed > 5 ? `
      <div class="predictive-arrow" style="position:absolute;top:50%;left:50%;width:2px;height:${arrowLength}px;background:linear-gradient(to top, transparent, ${statusColor});transform-origin:top;transform:translateX(-50%) rotate(${heading + 180}deg);opacity:0.6;filter:blur(1px);"></div>
      ` : ''}
      
      <!-- Ghost Pulse -->
      <div class="marker-pulse" style="position:absolute;inset:-10px;border-radius:50%;background:${fade(pulseColor, 0.19)};animation:${animation};z-index:-1;"></div>
      
      <!-- Main Marker Stage 7: Backdrop filter and dynamic shadows -->
      <div class="marker-core-wrapper" style="position:relative;display:flex;flex-direction:column;align-items:center;" role="img" aria-label="${statusA11y}" title="${statusA11y}">
        <div class="marker-core" style="width:${coreSize}px;height:${coreSize}px;background:linear-gradient(135deg,${statusColor},${fade(statusColor, 0.87)});border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 32px ${fade(statusColor, 0.5)}, 0 0 0 ${isSelected ? '6px' : '3px'} rgba(255,255,255,0.95);border:2.5px solid white;font-size:${iconFont}px;transform:${isSelected ? 'scale(1.2)' : 'scale(1)'};transition:all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);overflow:hidden;backdrop-filter:blur(4px);">
          <div style="transform: rotate(${heading}deg); transition: transform 0.4s ease;">${icon}</div>
          ${statusLevel !== 'operational' ? `
          <!-- Reforço color-blind-safe: símbolo de status (não depende de cor) -->
          <div aria-hidden="true" style="position:absolute;top:-2px;right:-2px;width:18px;height:18px;background:${statusColor};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;line-height:1;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);z-index:2;">${glyph}</div>
          ` : ''}
          
          <!-- Speed Overlay (Stage 5: High Precision HUD) -->
          ${isCompact ? '' : `<div style="position:absolute;bottom:0;width:100%;background:rgba(0,0,0,0.8);font-size:9px;color:white;text-align:center;font-weight:900;letter-spacing:-0.5px;padding-bottom:2px;font-family:monospace;border-top:1px solid rgba(255,255,255,0.2);">
            ${speed}<span style="font-size:7px;opacity:0.7;margin-left:1px;">KM/H</span>
          </div>`}
        </div>

        <!-- Label with Status Indicator -->
        ${isCompact ? '' : `<div class="marker-label-container" style="margin-top:8px;display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div class="marker-label" style="background:rgba(15,23,42,0.9);backdrop-filter:blur(8px);color:white;padding:2px 12px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);transition:all 0.3s ease;">
            ${tracking.driver?.name?.split(' ')[0].toUpperCase() || 'DRIVER'}
          </div>
          ${tracking.is_stopped ? `
            <div style="font-size:9px;color:${statusHsl('attention')};font-weight:900;background:${statusHsl('attention',0.1)};padding:1px 6px;border-radius:4px;border:1px solid ${statusHsl('attention',0.2)};"><span aria-hidden="true">${statusGlyph('attention')}</span> PARADO</div>
          ` : ''}
          ${tracking.is_on_route === false ? `
            <div style="font-size:9px;color:${statusHsl('critical')};font-weight:900;background:${statusHsl('critical',0.1)};padding:1px 6px;border-radius:4px;border:1px solid ${statusHsl('critical',0.2)};"><span aria-hidden="true">${statusGlyph('critical')}</span> FORA DE ROTA</div>
          ` : ''}
        </div>`}
      </div>
    </div>`;
  
  return el;
}

export function createPickupMarkerElement(tracking: TrackingData): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'pickup-marker';
  const locationName = tracking.order?.pickup_address?.split(',')[0] || 'Coleta';
  el.innerHTML = `
    <div style="position:relative;cursor:pointer;">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,${statusHsl('operational')},${statusHsl('operational',0.85)});border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px ${statusHsl('operational',0.4)};border:2px solid white;">
        <span style="transform:rotate(45deg);font-size:16px;">📦</span>
      </div>
      <div style="position:absolute;top:-28px;left:50%;transform:translateX(-50%);background:${statusHsl('operational')};color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.2);">${locationName}</div>
    </div>`;
  return el;
}

export function createDeliveryMarkerElement(tracking: TrackingData): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'delivery-marker';
  const locationName = tracking.order?.delivery_address?.split(',')[0] || 'Entrega';
  el.innerHTML = `
    <div style="position:relative;cursor:pointer;">
      <!-- Delivery Geofence Visual (Stage 13) -->
      <div class="delivery-geofence-pulse" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:120px;height:120px;background:${statusHsl('critical',0.1)};border:2px dashed ${statusHsl('critical',0.3)};border-radius:50%;z-index:-1;animation:geofence-pulse 4s infinite;"></div>
      
      <div style="width:36px;height:36px;background:linear-gradient(135deg,${statusHsl('critical')},${statusHsl('critical',0.85)});border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px ${statusHsl('critical',0.4)};border:2px solid white;">
        <span style="transform:rotate(45deg);font-size:16px;">📍</span>
      </div>
      <div style="position:absolute;top:-28px;left:50%;transform:translateX(-50%);background:${statusHsl('critical')};color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.2);">${locationName}</div>
    </div>`;
  return el;
}

export function createStoppedMarkerElement(tracking: TrackingData, durationMin: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'stopped-warning-marker';
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="width:40px;height:40px;background:${statusHsl('critical')};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px ${statusHsl('critical',0.6)};border:3px solid white;animation:marker-bounce 1s infinite alternate;">
        <span style="font-size:20px;">🛑</span>
      </div>
      <div style="background:${statusHsl('critical')};color:white;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:900;margin-top:4px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
        PARADO +${durationMin}M
      </div>
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
  let statusColor = statusHsl('operational');
  if (tracking.is_stopped) { statusText = 'Parado'; statusColor = statusHsl('attention'); }
  else if (!tracking.is_on_route) { statusText = 'Fora da rota'; statusColor = statusHsl('critical'); }

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
          <div><div style="font-size:10px;color:${statusHsl('operational')};font-weight:600;">COLETA</div><div style="font-size:12px;color:#ddd;">${pickupAddress}</div></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="font-size:14px;">📍</span>
          <div><div style="font-size:10px;color:${statusHsl('critical')};font-weight:600;">ENTREGA</div><div style="font-size:12px;color:#ddd;">${deliveryAddress}</div></div>
        </div>
      </div>
      <div style="display:flex;gap:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);">
        <div><div style="font-size:10px;color:#888;">VELOCIDADE</div><div style="font-size:14px;font-weight:700;">${speed}</div></div>
        <div><div style="font-size:10px;color:#888;">ETA</div><div style="font-size:14px;font-weight:700;color:${statusHsl('info')};">${eta}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button onclick="window.dispatchEvent(new CustomEvent('show-driver-history',{detail:{driverId:'${tracking.driver_id}',orderId:'${tracking.order_id}',driverName:'${driverName}'}}))" style="flex:1;padding:8px 12px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border:none;border-radius:8px;color:white;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">📍 Trajeto</button>
        <button onclick="window.open('https://www.google.com/maps/search/?api=1&query=${tracking.current_latitude},${tracking.current_longitude}', '_blank')" style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:white;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">🌐 Google</button>
      </div>

    </div>
  `);
}
