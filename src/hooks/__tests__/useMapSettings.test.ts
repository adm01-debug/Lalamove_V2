import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMapSettings } from '../useMapSettings';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client. Typed access is recovered via `vi.mocked` in each test,
// avoiding `any` casts while keeping the mock shape flexible per scenario.
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

const mockedFrom = vi.mocked(supabase.from);
const mockedGetUser = vi.mocked(supabase.auth.getUser);

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

  it('should load settings from supabase for a specific context (driver/delivery)', async () => {
    const contextKey = 'driver-123-delivery-456';
    const mockData = {
      off_route_threshold: 800,
      stopped_threshold: 20,
      geofence_radius: 400,
      context_key: contextKey,
    };

    mockedFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    } as unknown as ReturnType<typeof supabase.from>);

    await useMapSettings.getState().loadContextSettings(contextKey);

    const state = useMapSettings.getState();
    expect(state.offRouteThreshold).toBe(800);
    expect(state.stoppedThreshold).toBe(20);
    expect(state.geofenceRadius).toBe(400);
  });

  it('should persist settings to supabase with context key', async () => {
    const contextKey = 'driver-789';
    mockedGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockedFrom.mockReturnValue({
      upsert: upsertMock,
    } as unknown as ReturnType<typeof supabase.from>);

    const state = useMapSettings.getState();
    state.setOffRouteThreshold(750);
    state.setStoppedThreshold(25);

    await state.saveContextSettings(contextKey);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context_key: contextKey,
        off_route_threshold: 750,
        stopped_threshold: 25,
        user_id: 'user-123',
      }),
      { onConflict: 'user_id,context_key' }
    );

    expect(useMapSettings.getState().contextSettings[contextKey]).toEqual({
      offRouteThreshold: 750,
      stoppedThreshold: 25,
      geofenceRadius: 300,
    });
  });

  it('should handle missing data by falling back to defaults during load', async () => {
    mockedFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as ReturnType<typeof supabase.from>);

    useMapSettings.getState().setOffRouteThreshold(1000);

    await useMapSettings.getState().loadContextSettings('empty-context');

    expect(useMapSettings.getState().offRouteThreshold).toBe(500);
  });

  it('should reset to defaults when resetToDefaults is called', () => {
    const state = useMapSettings.getState();
    state.setOffRouteThreshold(2000);
    state.resetToDefaults();

    expect(useMapSettings.getState().offRouteThreshold).toBe(500);
  });

  it('should handle supabase errors during save', async () => {
    mockedGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    mockedFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: new Error('DB Error') }),
    } as unknown as ReturnType<typeof supabase.from>);

    await expect(
      useMapSettings.getState().saveContextSettings('error-context')
    ).rejects.toThrow('DB Error');
  });

  it('should fallback to defaults and throw when supabase fails to load', async () => {
    mockedFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('Read Error') }),
    } as unknown as ReturnType<typeof supabase.from>);

    useMapSettings.getState().setOffRouteThreshold(1200);

    await expect(
      useMapSettings.getState().loadContextSettings('error-context')
    ).rejects.toThrow('Read Error');

    expect(useMapSettings.getState().offRouteThreshold).toBe(500);
  });
});
