export type VehicleFilter = 'ALL' | 'MOTORCYCLE' | 'CAR' | 'VAN' | 'TRUCK';
export type StatusFilter = 'ALL' | 'IN_TRANSIT' | 'STOPPED' | 'OFF_ROUTE';

export const vehicleIcons: Record<string, string> = {
  MOTORCYCLE: '🏍️',
  CAR: '🚗',
  VAN: '🚐',
  TRUCK: '🚛',
};

export const vehicleColors: Record<string, string> = {
  MOTORCYCLE: '#8b5cf6',
  CAR: '#3b82f6',
  VAN: '#f59e0b',
  TRUCK: '#ef4444',
};
