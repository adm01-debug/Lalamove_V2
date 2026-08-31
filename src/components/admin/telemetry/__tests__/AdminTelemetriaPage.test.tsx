import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AdminTelemetriaPage from '@/pages/AdminTelemetriaPage';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock TelemetryCharts
vi.mock('@/components/admin/telemetry/TelemetryCharts', () => ({
  TelemetryCharts: ({ rows, timeFilter }: { rows: unknown[]; timeFilter: string }) =>
    createElement('div', { 'data-testid': 'telemetry-charts' }, `${rows.length} rows, filter: ${timeFilter}`),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Set env vars for URL construction
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-anon-key');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient },
      createElement(BrowserRouter, null, children)
    );
}

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: `id-${Math.random()}`,
  operation: 'select',
  table_name: 'lalamove_orders',
  rpc_name: null,
  duration_ms: 5000,
  record_count: 50,
  query_limit: 100,
  query_offset: 0,
  count_mode: null,
  severity: 'slow',
  error_message: null,
  user_id: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('AdminTelemetriaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
  });

  it('renders page header', () => {
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    expect(getByText('Telemetria de Queries')).toBeTruthy();
    expect(getByText(/Monitoramento de performance/)).toBeTruthy();
  });

  it('renders stat cards', () => {
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    expect(getByText(/Muito Lentas/)).toBeTruthy();
    expect(getByText(/Erros/)).toBeTruthy();
    expect(getByText(/Média de duração/)).toBeTruthy();
  });

  it('renders filter controls', () => {
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    expect(getByText('Atualizar')).toBeTruthy();
    expect(getByText('Limpar +7d')).toBeTruthy();
  });

  it('shows empty state when no data', async () => {
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => {
      expect(getByText(/Nenhuma query lenta registrada/)).toBeTruthy();
    });
  });

  it('handles fetch error gracefully', () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    expect(getByText('Telemetria de Queries')).toBeTruthy();
  });

  it('calls cleanup endpoint on button click', async () => {
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await act(async () => { getByText('Limpar +7d').click(); });
    await vi.waitFor(() => {
      const deleteCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => typeof call[1] === 'object' && (call[1] as Record<string, string>).method === 'DELETE'
      );
      expect(deleteCalls.length).toBe(1);
    });
  });

  it('shows success toast on successful cleanup', async () => {
    const { toast } = await import('sonner');
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await act(async () => { getByText('Limpar +7d').click(); });
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Dados com mais de 7 dias removidos');
    });
  });

  it('shows error toast on failed cleanup', async () => {
    const { toast } = await import('sonner');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await act(async () => { getByText('Limpar +7d').click(); });
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro ao limpar dados antigos');
    });
  });

  // Severity badges
  const severities = [
    { severity: 'very_slow', label: '🔴 Muito Lenta' },
    { severity: 'slow', label: '🟡 Lenta' },
    { severity: 'error', label: '❌ Erro' },
  ];
  severities.forEach(({ severity, label }) => {
    it(`renders ${severity} badge`, async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([makeRow({ severity })]) });
      const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
      await vi.waitFor(() => { expect(getByText(label)).toBeTruthy(); });
    });
  });

  it('shows top offenders card', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeRow({ table_name: `t_${i % 3}`, duration_ms: 5000 + i * 1000 }));
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(rows) });
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => { expect(getByText('Tabelas Mais Problemáticas')).toBeTruthy(); });
  });

  // Stress: 100 rows
  it('handles 100 rows', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => makeRow({
      table_name: `table_${i % 15}`, duration_ms: 1000 + i * 50,
      severity: ['slow', 'very_slow', 'error'][i % 3],
    }));
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(rows) });
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => { expect(getByText('100 registros · auto-refresh 30s')).toBeTruthy(); });
  });

  // Stress: 200 rows
  it('handles 200 rows', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => makeRow({
      table_name: `table_${i % 20}`, duration_ms: Math.floor(Math.random() * 20000),
      severity: ['slow', 'very_slow', 'error', 'normal'][i % 4],
    }));
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(rows) });
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => { expect(getByText('200 registros · auto-refresh 30s')).toBeTruthy(); });
  });

  // Edge cases
  it('handles row with all null optional fields', async () => {
    const rows = [makeRow({ table_name: null, rpc_name: null, record_count: null, query_limit: null, query_offset: null, count_mode: null })];
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(rows) });
    const { getAllByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => { expect(getAllByText('-').length).toBeGreaterThanOrEqual(3); });
  });

  it('handles zero duration_ms', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([makeRow({ duration_ms: 0 })]) });
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => { expect(getByText('0ms')).toBeTruthy(); });
  });

  it('calculates average duration correctly', async () => {
    const rows = [makeRow({ duration_ms: 2000 }), makeRow({ duration_ms: 4000 })];
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(rows) });
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => { expect(getByText('3.0s')).toBeTruthy(); });
  });

  it('displays record_count when present', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([makeRow({ record_count: 999 })]) });
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => { expect(getByText('999')).toBeTruthy(); });
  });

  // Operations
  ['select', 'insert', 'update', 'delete', 'rpc'].forEach((op) => {
    it(`displays ${op} operation`, async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([makeRow({ operation: op })]) });
      const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
      await vi.waitFor(() => { expect(getByText(op)).toBeTruthy(); });
    });
  });

  // Color coding

  it('calculates max duration per table', async () => {
    const rows = [
      makeRow({ table_name: 'drivers', duration_ms: 3000 }),
      makeRow({ table_name: 'drivers', duration_ms: 8000 }),
      makeRow({ table_name: 'drivers', duration_ms: 5000 }),
    ];
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(rows) });
    const { getByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => { expect(getByText('max 8.0s')).toBeTruthy(); });
  });

  it('passes rows and timeFilter to TelemetryCharts', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([makeRow()]) });
    const { getByTestId } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => {
      expect(getByTestId('telemetry-charts')).toBeTruthy();
      expect(getByTestId('telemetry-charts').textContent).toContain('1 rows, filter: 24h');
    });
  });

  it('constructs correct fetch URL', async () => {
    render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('query_telemetry');
      expect(url).toContain('order=created_at.desc');
      expect(url).toContain('limit=');
    });
  });

  it('includes authorization header', async () => {
    render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => {
      const headers = mockFetch.mock.calls[0][1]?.headers;
      expect(headers?.Authorization).toContain('Bearer');
    });
  });

  // Multiple severity counts
  it('counts 2 very_slow correctly', async () => {
    const rows = [makeRow({ severity: 'very_slow' }), makeRow({ severity: 'very_slow' }), makeRow({ severity: 'slow' })];
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(rows) });
    const { getAllByText } = render(createElement(AdminTelemetriaPage), { wrapper: createWrapper() });
    await vi.waitFor(() => {
      expect(getAllByText('2').length).toBeGreaterThan(0);
    });
  });
});
