import { renderHook, act } from '@testing-library/react';
import { useMapSettings } from './useMapSettings';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } } })),
    },
    from: vi.fn(() => ({
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ 
            data: { 
              off_route_threshold: 1000, 
              stopped_threshold: 30, 
              geofence_radius: 500 
            }, 
            error: null 
          })),
        })),
      })),
    })),
  },
}));

describe('useMapSettings Persistence', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useMapSettings());
    act(() => {
      result.current.setOffRouteThreshold(500);
      result.current.setStoppedThreshold(15);
      result.current.setGeofenceRadius(300);
    });
  });

  it('should persist settings by context', async () => {
    const { result } = renderHook(() => useMapSettings());
    
    act(() => {
      result.current.setOffRouteThreshold(800);
    });

    await act(async () => {
      await result.current.saveContextSettings('driver:123');
    });

    expect(result.current.offRouteThreshold).toBe(800);
  });

  it('should load settings from context', async () => {
    const { result } = renderHook(() => useMapSettings());
    
    await act(async () => {
      await result.current.loadContextSettings('region:south');
    });

    expect(result.current.offRouteThreshold).toBe(1000);
    expect(result.current.stoppedThreshold).toBe(30);
    expect(result.current.geofenceRadius).toBe(500);
  });
});
