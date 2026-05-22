import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMapSettings } from './useMapSettings';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      upsert: vi.fn(),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
    })),
  },
}));

describe('useMapSettings Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapSettings.getState().resetToDefaults();
  });

  it('should load default values initially', () => {
    const state = useMapSettings.getState();
    expect(state.offRouteThreshold).toBe(500);
    expect(state.stoppedThreshold).toBe(15);
    expect(state.geofenceRadius).toBe(300);
  });

  it('should update state when setters are called', () => {
    const state = useMapSettings.getState();
    state.setOffRouteThreshold(1000);
    state.setStoppedThreshold(30);
    state.setGeofenceRadius(500);

    const updatedState = useMapSettings.getState();
    expect(updatedState.offRouteThreshold).toBe(1000);
    expect(updatedState.stoppedThreshold).toBe(30);
    expect(updatedState.geofenceRadius).toBe(500);
  });

  it('should load settings from supabase for a specific context', async () => {
    const mockData = {
      off_route_threshold: 800,
      stopped_threshold: 20,
      geofence_radius: 400,
    };

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    });

    await useMapSettings.getState().loadContextSettings('test-context');

    const state = useMapSettings.getState();
    expect(state.offRouteThreshold).toBe(800);
    expect(state.stoppedThreshold).toBe(20);
    expect(state.geofenceRadius).toBe(400);
  });

  it('should persist settings to supabase', async () => {
    const mockUser = { id: 'user-123' };
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: mockUser }, error: null });
    
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({
      upsert: upsertMock,
    });

    const state = useMapSettings.getState();
    state.setOffRouteThreshold(750);
    
    await state.saveContextSettings('new-context');

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context_key: 'new-context',
        off_route_threshold: 750,
        user_id: 'user-123',
      }),
      { onConflict: 'user_id,context_key' }
    );
  });

  it('should reset to defaults when resetToDefaults is called', () => {
    const state = useMapSettings.getState();
    state.setOffRouteThreshold(2000);
    state.resetToDefaults();
    
    const resetState = useMapSettings.getState();
    expect(resetState.offRouteThreshold).toBe(500);
  });
});
