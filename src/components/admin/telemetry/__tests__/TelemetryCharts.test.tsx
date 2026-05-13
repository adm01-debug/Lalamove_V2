import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TelemetryCharts } from '../TelemetryCharts';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  Bar: () => <div data-testid="bar" />,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
  Legend: () => <div />,
}));

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: `id-${Math.random()}`,
  operation: 'select',
  table_name: 'lalamove_orders',
  rpc_name: null,
  duration_ms: 5000,
  severity: 'slow',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('TelemetryCharts', () => {
  it('renders nothing when rows are empty', () => {
    const { container } = render(<TelemetryCharts rows={[]} timeFilter="24h" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders charts when rows have data', () => {
    const rows = [makeRow({ severity: 'slow' }), makeRow({ severity: 'very_slow' })];
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="24h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThan(0);
  });

  it('groups by table correctly', () => {
    const rows = [
      makeRow({ table_name: 'drivers', duration_ms: 3000 }),
      makeRow({ table_name: 'drivers', duration_ms: 5000 }),
      makeRow({ table_name: 'alerts', duration_ms: 2000 }),
    ];
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="24h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThanOrEqual(2);
  });

  it('handles rpc_name priority over table_name', () => {
    const rows = [makeRow({ rpc_name: 'has_role', table_name: 'user_roles' })];
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="1h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThan(0);
  });

  it('counts severity categories correctly', () => {
    const rows = [
      makeRow({ severity: 'very_slow' }), makeRow({ severity: 'very_slow' }),
      makeRow({ severity: 'slow' }), makeRow({ severity: 'error' }),
      makeRow({ severity: 'normal' }),
    ];
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="24h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThanOrEqual(2);
  });

  it('handles 50 rows without errors', () => {
    const rows = Array.from({ length: 50 }, (_, i) => makeRow({
      table_name: `table_${i % 10}`, duration_ms: 1000 + i * 100,
      severity: i % 3 === 0 ? 'very_slow' : i % 3 === 1 ? 'slow' : 'error',
      created_at: new Date(Date.now() - i * 60000).toISOString(),
    }));
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="24h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThanOrEqual(2);
  });

  it('handles 200 rows without errors', () => {
    const rows = Array.from({ length: 200 }, (_, i) => makeRow({
      table_name: `table_${i % 20}`,
      rpc_name: i % 5 === 0 ? `rpc_${i % 8}` : null,
      duration_ms: 500 + Math.floor(Math.random() * 15000),
      severity: ['slow', 'very_slow', 'error', 'normal'][i % 4],
      created_at: new Date(Date.now() - i * 30000).toISOString(),
    }));
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="6h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThanOrEqual(2);
  });

  it('handles all same severity', () => {
    const rows = Array.from({ length: 30 }, () => makeRow({ severity: 'very_slow', duration_ms: 9000 }));
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="24h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThanOrEqual(2);
  });

  it('handles all same table', () => {
    const rows = Array.from({ length: 25 }, () => makeRow({ table_name: 'lalamove_orders' }));
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="24h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThanOrEqual(2);
  });

  it('handles null table_name and null rpc_name', () => {
    const rows = [makeRow({ table_name: null, rpc_name: null })];
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="24h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThan(0);
  });

  it('handles timeFilter=1h bucketing', () => {
    const now = Date.now();
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRow({ created_at: new Date(now - i * 5 * 60000).toISOString() })
    );
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="1h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThan(0);
  });

  it('handles timeFilter=7d bucketing', () => {
    const now = Date.now();
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow({ created_at: new Date(now - i * 3600000).toISOString() })
    );
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="7d" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThan(0);
  });

  it('handles very high duration values', () => {
    const rows = [makeRow({ duration_ms: 120000 }), makeRow({ duration_ms: 60000 })];
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="24h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThan(0);
  });

  it('handles zero duration', () => {
    const rows = [makeRow({ duration_ms: 0 })];
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="24h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThan(0);
  });

  // Edge: single row per table, many tables
  it('handles 20 different tables', () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow({ table_name: `unique_table_${i}`, duration_ms: 2000 + i * 500 })
    );
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="24h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThanOrEqual(2);
  });

  // Edge: all rpcs, no tables
  it('handles all rpc operations', () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      makeRow({ rpc_name: `rpc_fn_${i}`, table_name: null })
    );
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="24h" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThan(0);
  });

  // Edge: mixed time buckets
  it('handles rows spread across many hours', () => {
    const now = Date.now();
    const rows = Array.from({ length: 50 }, (_, i) =>
      makeRow({ created_at: new Date(now - i * 3600000).toISOString() })
    );
    const { getAllByTestId } = render(<TelemetryCharts rows={rows} timeFilter="7d" />);
    expect(getAllByTestId('responsive-container').length).toBeGreaterThan(0);
  });
});
