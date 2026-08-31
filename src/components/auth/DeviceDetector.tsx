import { forwardRef } from 'react';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';

export const DeviceDetector = forwardRef<HTMLDivElement>(function DeviceDetector(_props, _ref) {
  // This hook runs device detection on mount when user is authenticated
  useDeviceDetection();
  return null;
});
