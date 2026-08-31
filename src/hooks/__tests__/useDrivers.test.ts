import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// Mock supabase
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useDrivers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve buscar e mapear motoristas corretamente', async () => {
    const mockDrivers = [
      {
        id: '1',
        lalamove_id: 'LLM001',
        name: 'Carlos Silva',
        phone: '11999999999',
        photo_url: null,
        vehicle_type: 'MOTORCYCLE',
        vehicle_plate: 'ABC1234',
        risk_score: 3.5,
        risk_level: 'MEDIUM',
        status: 'APPROVED',
        total_deliveries: 50,
        completed_deliveries: 45,
        rating: 4.8,
        whitelisted: false,
        blacklisted: false,
        blacklist_reason: null,
        notes: null,
        last_active_at: '2026-03-15T10:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2026-03-15T10:00:00Z',
      },
    ];

    const mockIncidents = [{ driver_id: '1' }, { driver_id: '1' }];

    mockSelect.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: mockDrivers, error: null }),
    });
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ data: mockIncidents, error: null }),
    });

    const { useDrivers } = await import('@/hooks/useDrivers');
    const { result } = renderHook(() => useDrivers(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Carlos Silva');
    expect(result.current.data![0].incidentCount).toBe(2);
    expect(result.current.data![0].riskScore).toBe(3.5);
  });

  it('deve lidar com erro do supabase', async () => {
    mockSelect.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    });

    const { useDrivers } = await import('@/hooks/useDrivers');
    const { result } = renderHook(() => useDrivers(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
  });
});
