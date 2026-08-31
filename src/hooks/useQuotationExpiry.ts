import { useEffect, useState } from 'react';

/**
 * Lalamove v3 quotations expire (typically ~5 minutes).
 * Attempting to create an order with an expired quotation returns 4xx from the API.
 * This hook exposes a live countdown to guard the "Confirmar Pedido" action.
 */
export interface QuotationExpiryState {
  /** Seconds remaining. 0 when expired or when no valid `expiresAt`. */
  secondsLeft: number;
  /** True when the quotation is past its expiration. */
  isExpired: boolean;
  /** True when < 60s remain (UI should warn). */
  isCritical: boolean;
  /** Human-readable `mm:ss` for the badge. */
  formatted: string;
}

const formatMMSS = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export function useQuotationExpiry(expiresAt: string | null | undefined): QuotationExpiryState {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const parsed = Date.parse(expiresAt);
    if (Number.isNaN(parsed)) return;

    // Tick every second while the quotation is still relevant.
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) {
    return { secondsLeft: 0, isExpired: false, isCritical: false, formatted: '--:--' };
  }

  const target = Date.parse(expiresAt);
  if (Number.isNaN(target)) {
    return { secondsLeft: 0, isExpired: false, isCritical: false, formatted: '--:--' };
  }

  const secondsLeft = Math.max(0, Math.floor((target - now) / 1000));
  const isExpired = secondsLeft <= 0;
  const isCritical = !isExpired && secondsLeft < 60;

  return {
    secondsLeft,
    isExpired,
    isCritical,
    formatted: formatMMSS(secondsLeft),
  };
}
