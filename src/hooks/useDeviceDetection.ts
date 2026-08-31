import { logger } from '@/utils/logger';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Simple device fingerprint generator
function generateFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
  }
  
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    canvas.toDataURL(),
  ];
  
  // Simple hash function
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Parse user agent for browser and OS info
function parseUserAgent(ua: string) {
  let browser = 'Unknown';
  let os = 'Unknown';

  // Browser detection
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Opera')) browser = 'Opera';

  // OS detection
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, os };
}

export function useDeviceDetection() {
  const { user } = useAuth();

  const checkDevice = useCallback(async () => {
    if (!user?.id || !user?.email) return;

    try {
      const fingerprint = generateFingerprint();
      const userAgent = navigator.userAgent;
      const { browser, os } = parseUserAgent(userAgent);

      // Get IP and location info (using a free service)
      let ipAddress = '0.0.0.0';
      let locationCity = '';
      let locationCountry = '';

      try {
        // Skip external IP geolocation APIs - they're unreliable and blocked by CORS
        // Just send device info to the edge function
      } catch {
        // silently continue
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke('new-device-alert', {
        body: {
          userId: user.id,
          userEmail: user.email,
          deviceFingerprint: fingerprint,
          ipAddress,
          userAgent,
          browser,
          os,
          locationCity,
          locationCountry,
        },
      });

      if (error) {
        logger.error('Device check error:', error);
        return;
      }

      // New device detected and registered - no action needed
      void data;
    } catch (error) {
      logger.error('Error in device detection:', error);
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    // Check device on mount (after login)
    const timer = setTimeout(() => {
      checkDevice();
    }, 2000); // Small delay to ensure auth is complete

    return () => clearTimeout(timer);
  }, [checkDevice]);

  return { checkDevice };
}
