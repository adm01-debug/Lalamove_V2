import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMapSettings } from '../useMapSettings';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      upsert: vi.fn(),
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    })),
  },
}));

describe('useMapSettings Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear storage if needed or reset state manually if possible
    // Since useMapSettings is a singleton (create from zustand), we reset it
    const state = useMapSettings.getState();
    state.resetToDefaults();
  });

  it('should have default values', () => {
    const state = useMapSettings.getState();
    expect(state.offRouteThreshold).toBe(500);
    expect(state.stoppedThreshold).toBe(15);
    expect(state.geofenceRadius).toBe(300);
  });

  it('should update thresholds locally', () => {
    const state = useMapSettings.getState();
    state.setOffRouteThreshold(1000);
    state.setStoppedThreshold(30);
    state.setGeofenceRadius(500);

    const updatedState = useMapSettings.getState();
    expect(updatedState.offRouteThreshold).toBe(1000);
    expect(updatedState.stoppedThreshold).toBe(30);
    expect(updatedState.geofenceRadius).toBe(500);
  });

  it('should save settings to supabase', async () => {
    const mockUser = { id: 'user-123' };
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: mockUser }, error: null });
    
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({
      upsert: mockUpsert,
    });

    const state = useMapSettings.getState();
    await state.saveContextSettings('driver:test');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        context_key: 'driver:test',
        off_route_threshold: 500,
      }),
      expect.anything()
    );
  });

  it('should load settings from supabase', async () => {
    const mockData = {
      off_route_threshold: 800,
      stopped_threshold: 20,
      geofence_radius: 400,
    };
    
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    
    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    });

    const state = useMapSettings.getState();
    await state.loadContextSettings('driver:test');

    const updatedState = useMapSettings.getState();
    expect(updatedState.offRouteThreshold).toBe(800);
    expect(updatedState.stoppedThreshold).toBe(20);
    expect(updatedState.geofenceRadius).toBe(400);
  });

  it('should fallback to defaults on supabase error during load', async () => {
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
    });

    const state = useMapSettings.getState();
    state.setOffRouteThreshold(1000); // Set to non-default first
    
    try {
      await state.loadContextSettings('driver:test');
    } catch (e) {
      // expected
    }

    const updatedState = useMapSettings.getState();
    expect(updatedState.offRouteThreshold).toBe(500); // Should have reset to default
  });

  it('should handle rapid context switching by keeping state consistent', async () => {
    // This is more about checking that loadContextSettings resets correctly if data is not found
    const mockMaybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { off_route_threshold: 1000 }, error: null }) // First call
      .mockResolvedValueOnce({ data: null, error: null }); // Second call (no settings for this context)

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    });

    const state = useMapSettings.getState();
    
    await state.loadContextSettings('context-1');
    expect(useMapSettings.getState().offRouteThreshold).toBe(1000);

    await state.loadContextSettings('context-2');
    expect(useMapSettings.getState().offRouteThreshold).toBe(500); // Back to default
  });
});
