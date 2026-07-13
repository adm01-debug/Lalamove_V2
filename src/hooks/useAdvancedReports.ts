import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/utils/logger';
import { useRegionResolution, coordKey, type Coord } from '@/hooks/useRegionResolver';

/**
 * Filtros avançados aplicáveis ao histórico de entregas.
 * Campos vazios/`all` são tratados como "sem filtro".
 */
export interface AdvancedReportFilters {
  period: string;
  status: string;
  vehicleType: string;
  costCenter: string;
  department: string;
  driver: string;
  urgency: 'all' | 'urgent' | 'normal';
  search: string;
  /** Custo mínimo (string vazia = sem filtro). */
  costMin: string;
  /** Custo máximo (string vazia = sem filtro). */
  costMax: string;
}

export const DEFAULT_FILTERS: AdvancedReportFilters = {
  period: '30',
  status: 'all',
  vehicleType: 'all',
  costCenter: 'all',
  department: 'all',
  driver: 'all',
  urgency: 'all',
  search: '',
  costMin: '',
  costMax: '',
};

/** Linha normalizada de pedido usada internamente pelos agregadores. */
interface OrderRow {
  id: string;
  status: string;
  vehicle_type: string | null;
  total_cost: number | null;
  currency: string | null;
  cost_center: string | null;
  department: string | null;
  is_urgent: boolean | null;
  distance_meters: number | null;
  delay_minutes: number | null;
  duration_minutes: number | null;
  pod_received: boolean | null;
  requires_pod: boolean | null;
  delivery_address: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  pickup_address: string | null;
  customer_name: string | null;
  internal_order_id: string | null;
  lalamove_id: string | null;
  created_at: string;
  driver: { name: string | null } | null;
}

export interface CostSummary {
  totalCost: number;
  avgCost: number;
  costPerKm: number;
  currency: string;
  byGroup: { label: string; count: number; total: number; avg: number; percentage: number }[];
}

export interface PerformanceSummary {
  total: number;
  completed: number;
  cancelled: number;
  completionRate: number;
  cancellationRate: number;
  avgDuration: number;
  avgDelay: number;
  onTimeRate: number;
  podComplianceRate: number;
}

export interface GeoRow {
  region: string;
  count: number;
  totalCost: number;
  avgDistanceKm: number;
  avgDelay: number;
  onTimeRate: number;
}

/** Ponto de entrega com métricas para ponderar o heatmap geográfico. */
export interface WeightedGeoPoint extends Coord {
  /** Custo total da entrega (para peso "custo"). */
  cost: number;
  /** Atraso em minutos, nunca negativo (para peso "atraso"). */
  delay: number;
}

export interface DailyPoint {
  date: string;
  deliveries: number;
  cost: number;
  avgDelay: number;
}

/**
 * Ponto de série sobreposta: alinha o período atual e o anterior pelo
 * mesmo deslocamento relativo (Dia 1..N), permitindo comparação visual.
 */
export interface DailyComparisonPoint {
  /** Rótulo relativo do dia (ex.: "Dia 1"). */
  label: string;
  /** Entregas no período atual. */
  current: number;
  /** Entregas no período anterior (mesmo deslocamento). */
  previous: number;
  /** Custo no período atual. */
  currentCost: number;
  /** Custo no período anterior. */
  previousCost: number;
}


export interface ComparisonMetrics {
  deliveries: number;
  totalCost: number;
  onTimeRate: number;
  cancellationRate: number;
}

export interface ComparisonSummary {
  current: ComparisonMetrics;
  previous: ComparisonMetrics;
  /** Variação percentual (deliveries/totalCost) ou em pontos (rates). */
  deltas: ComparisonMetrics;
  hasPrevious: boolean;
}

const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/**
 * Extrai uma "região" legível do endereço de entrega.
 * Endereços brasileiros costumam ter partes separadas por vírgula; usamos
 * o penúltimo segmento (normalmente bairro/cidade) como aproximação estável.
 */
function extractRegion(address: string | null): string {
  if (!address) return 'Sem endereço';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return 'Sem endereço';
  // Remove CEP e país no final quando presentes.
  const cleaned = parts.filter((p) => !/^\d{5}-?\d{3}$/.test(p) && !/^brasil$/i.test(p));
  const source = cleaned.length ? cleaned : parts;
  return source[source.length - 1] || source[0] || 'Sem endereço';
}

const isCompleted = (s: string) => s === 'COMPLETED';
const isCancelled = (s: string) => s === 'CANCELLED' || s === 'REJECTED' || s === 'EXPIRED';

const ORDER_SELECT =
  'id,status,vehicle_type,total_cost,currency,cost_center,department,is_urgent,distance_meters,delay_minutes,duration_minutes,pod_received,requires_pod,delivery_address,delivery_latitude,delivery_longitude,pickup_address,customer_name,internal_order_id,lalamove_id,created_at,driver:drivers(name)';

export function useAdvancedReports(filters: AdvancedReportFilters) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [prevRows, setPrevRows] = useState<OrderRow[]>([]);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    const days = parseInt(filters.period, 10) || 30;
    const now = new Date();
    const startDate = startOfDay(subDays(now, days));
    const endDate = endOfDay(now);
    // Janela anterior de mesmo tamanho, imediatamente antes do período atual.
    const prevStart = startOfDay(subDays(now, days * 2));
    const prevEnd = endOfDay(subDays(now, days + 1));

    try {
      const [current, previous] = await Promise.all([
        supabase
          .from('lalamove_orders')
          .select(ORDER_SELECT)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('lalamove_orders')
          .select(ORDER_SELECT)
          .gte('created_at', prevStart.toISOString())
          .lte('created_at', prevEnd.toISOString()),
      ]);
      if (current.error) throw current.error;
      setRows((current.data as unknown as OrderRow[]) ?? []);
      // Falha na janela anterior não deve quebrar o relatório principal.
      setPrevRows(previous.error ? [] : ((previous.data as unknown as OrderRow[]) ?? []));
    } catch (err) {
      logger.error('Erro ao carregar relatórios avançados:', err);
      setRows([]);
      setPrevRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters.period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Opções de filtro derivadas do universo do período (antes dos filtros locais).
  const filterOptions = useMemo(() => {
    const costCenters = new Set<string>();
    const departments = new Set<string>();
    const statuses = new Set<string>();
    const vehicles = new Set<string>();
    const drivers = new Set<string>();
    rows.forEach((r) => {
      if (r.cost_center) costCenters.add(r.cost_center);
      if (r.department) departments.add(r.department);
      if (r.status) statuses.add(r.status);
      if (r.vehicle_type) vehicles.add(r.vehicle_type);
      if (r.driver?.name) drivers.add(r.driver.name);
    });
    return {
      costCenters: Array.from(costCenters).sort(),
      departments: Array.from(departments).sort(),
      statuses: Array.from(statuses).sort(),
      vehicles: Array.from(vehicles).sort(),
      drivers: Array.from(drivers).sort(),
    };
  }, [rows]);

  // Predicado de filtros avançados reutilizável (período atual e anterior).
  const predicate = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    const costMin = filters.costMin.trim() === '' ? null : Number(filters.costMin);
    const costMax = filters.costMax.trim() === '' ? null : Number(filters.costMax);
    const hasMin = costMin != null && Number.isFinite(costMin);
    const hasMax = costMax != null && Number.isFinite(costMax);
    return (r: OrderRow): boolean => {
      if (filters.status !== 'all' && r.status !== filters.status) return false;
      if (filters.vehicleType !== 'all' && r.vehicle_type !== filters.vehicleType) return false;
      if (filters.costCenter !== 'all' && r.cost_center !== filters.costCenter) return false;
      if (filters.department !== 'all' && r.department !== filters.department) return false;
      if (filters.driver !== 'all' && (r.driver?.name || '') !== filters.driver) return false;
      if (filters.urgency === 'urgent' && !r.is_urgent) return false;
      if (filters.urgency === 'normal' && r.is_urgent) return false;
      if (hasMin || hasMax) {
        const c = r.total_cost;
        if (c == null) return false;
        if (hasMin && c < (costMin as number)) return false;
        if (hasMax && c > (costMax as number)) return false;
      }
      if (term) {
        const hay = [
          r.customer_name,
          r.internal_order_id,
          r.lalamove_id,
          r.delivery_address,
          r.department,
          r.cost_center,
          r.driver?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    };
  }, [filters]);

  const filtered = useMemo(() => rows.filter(predicate), [rows, predicate]);
  const prevFiltered = useMemo(() => prevRows.filter(predicate), [prevRows, predicate]);

  const cost = useMemo<CostSummary>(() => {
    const withCost = filtered.filter((r) => typeof r.total_cost === 'number' && r.total_cost! > 0);
    const totalCost = withCost.reduce((acc, r) => acc + (r.total_cost || 0), 0);
    const totalKm = filtered.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000;
    const currency = withCost.find((r) => r.currency)?.currency || 'BRL';

    const groups = new Map<string, { count: number; total: number }>();
    filtered.forEach((r) => {
      const key = r.department || r.cost_center || 'Sem centro de custo';
      const g = groups.get(key) || { count: 0, total: 0 };
      g.count += 1;
      g.total += r.total_cost || 0;
      groups.set(key, g);
    });

    const byGroup = Array.from(groups.entries())
      .map(([label, g]) => ({
        label,
        count: g.count,
        total: round(g.total, 2),
        avg: g.count ? round(g.total / g.count, 2) : 0,
        percentage: totalCost ? round((g.total / totalCost) * 100, 1) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      totalCost: round(totalCost, 2),
      avgCost: withCost.length ? round(totalCost / withCost.length, 2) : 0,
      costPerKm: totalKm > 0 ? round(totalCost / totalKm, 2) : 0,
      currency,
      byGroup,
    };
  }, [filtered]);

  const performance = useMemo<PerformanceSummary>(() => {
    const total = filtered.length;
    const completed = filtered.filter((r) => isCompleted(r.status)).length;
    const cancelled = filtered.filter((r) => isCancelled(r.status)).length;

    const durations = filtered.filter((r) => (r.duration_minutes || 0) > 0);
    const avgDuration = durations.length
      ? round(durations.reduce((a, r) => a + (r.duration_minutes || 0), 0) / durations.length)
      : 0;

    const delays = filtered.filter((r) => r.delay_minutes != null);
    const avgDelay = delays.length
      ? round(delays.reduce((a, r) => a + (r.delay_minutes || 0), 0) / delays.length)
      : 0;

    const completedRows = filtered.filter((r) => isCompleted(r.status));
    const onTime = completedRows.filter((r) => (r.delay_minutes || 0) <= 0).length;

    const podRequired = filtered.filter((r) => r.requires_pod);
    const podDone = podRequired.filter((r) => r.pod_received).length;

    return {
      total,
      completed,
      cancelled,
      completionRate: total ? round((completed / total) * 100, 1) : 0,
      cancellationRate: total ? round((cancelled / total) * 100, 1) : 0,
      avgDuration,
      avgDelay,
      onTimeRate: completedRows.length ? round((onTime / completedRows.length) * 100, 1) : 0,
      podComplianceRate: podRequired.length ? round((podDone / podRequired.length) * 100, 1) : 0,
    };
  }, [filtered]);

  // Coordenadas de entrega para reverse geocoding (regiões precisas).
  const geoCoords = useMemo<Coord[]>(
    () =>
      filtered
        .filter((r) => r.delivery_latitude != null && r.delivery_longitude != null)
        .map((r) => ({ lat: Number(r.delivery_latitude), lng: Number(r.delivery_longitude) })),
    [filtered],
  );

  // Pontos enriquecidos com métricas para ponderar o heatmap (volume/custo/atraso).
  const geoPoints = useMemo<WeightedGeoPoint[]>(
    () =>
      filtered
        .filter((r) => r.delivery_latitude != null && r.delivery_longitude != null)
        .map((r) => ({
          lat: Number(r.delivery_latitude),
          lng: Number(r.delivery_longitude),
          cost: Number(r.total_cost) || 0,
          delay: Math.max(0, Number(r.delay_minutes) || 0),
        })),
    [filtered],
  );
  const regionResolution = useRegionResolution(geoCoords);
  const resolvedRegions = regionResolution.regions;

  const geography = useMemo<GeoRow[]>(() => {
    const map = new Map<
      string,
      { count: number; cost: number; distance: number; distCount: number; delay: number; delayCount: number; onTime: number; completed: number }
    >();
    filtered.forEach((r) => {
      const geocoded =
        r.delivery_latitude != null && r.delivery_longitude != null
          ? resolvedRegions[coordKey(Number(r.delivery_latitude), Number(r.delivery_longitude))]
          : undefined;
      const region = geocoded || extractRegion(r.delivery_address);
      const g =
        map.get(region) ||
        { count: 0, cost: 0, distance: 0, distCount: 0, delay: 0, delayCount: 0, onTime: 0, completed: 0 };
      g.count += 1;
      g.cost += r.total_cost || 0;
      if (r.distance_meters) {
        g.distance += r.distance_meters;
        g.distCount += 1;
      }
      if (r.delay_minutes != null) {
        g.delay += r.delay_minutes;
        g.delayCount += 1;
      }
      if (isCompleted(r.status)) {
        g.completed += 1;
        if ((r.delay_minutes || 0) <= 0) g.onTime += 1;
      }
      map.set(region, g);
    });

    return Array.from(map.entries())
      .map(([region, g]) => ({
        region,
        count: g.count,
        totalCost: round(g.cost, 2),
        avgDistanceKm: g.distCount ? round(g.distance / g.distCount / 1000, 1) : 0,
        avgDelay: g.delayCount ? round(g.delay / g.delayCount) : 0,
        onTimeRate: g.completed ? round((g.onTime / g.completed) * 100, 1) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [filtered, resolvedRegions]);

  const daily = useMemo<DailyPoint[]>(() => {
    const days = parseInt(filters.period, 10) || 30;
    const map = new Map<string, DailyPoint & { delaySum: number; delayCount: number }>();
    for (let i = 0; i <= days; i++) {
      const key = format(subDays(new Date(), i), 'yyyy-MM-dd');
      map.set(key, {
        date: format(subDays(new Date(), i), 'dd/MM', { locale: ptBR }),
        deliveries: 0,
        cost: 0,
        avgDelay: 0,
        delaySum: 0,
        delayCount: 0,
      });
    }
    filtered.forEach((r) => {
      const key = format(new Date(r.created_at), 'yyyy-MM-dd');
      const point = map.get(key);
      if (!point) return;
      point.deliveries += 1;
      point.cost += r.total_cost || 0;
      if (r.delay_minutes != null) {
        point.delaySum += r.delay_minutes;
        point.delayCount += 1;
      }
    });
    return Array.from(map.values())
      .map((p) => ({
        date: p.date,
        deliveries: p.deliveries,
        cost: round(p.cost, 2),
        avgDelay: p.delayCount ? round(p.delaySum / p.delayCount) : 0,
      }))
      .reverse();
  }, [filtered, filters.period]);

  // Comparação período atual vs. período anterior (mesmos filtros/tamanho).
  const comparison = useMemo<ComparisonSummary>(() => {
    const metricsFor = (set: OrderRow[]) => {
      const total = set.length;
      const completed = set.filter((r) => isCompleted(r.status));
      const cancelled = set.filter((r) => isCancelled(r.status)).length;
      const totalCost = set.reduce((a, r) => a + (r.total_cost || 0), 0);
      const onTime = completed.filter((r) => (r.delay_minutes || 0) <= 0).length;
      return {
        deliveries: total,
        totalCost: round(totalCost, 2),
        onTimeRate: completed.length ? round((onTime / completed.length) * 100, 1) : 0,
        cancellationRate: total ? round((cancelled / total) * 100, 1) : 0,
      };
    };
    const cur = metricsFor(filtered);
    const prev = metricsFor(prevFiltered);
    const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : round(((a - b) / b) * 100, 1));
    return {
      current: cur,
      previous: prev,
      deltas: {
        deliveries: delta(cur.deliveries, prev.deliveries),
        totalCost: delta(cur.totalCost, prev.totalCost),
        onTimeRate: round(cur.onTimeRate - prev.onTimeRate, 1),
        cancellationRate: round(cur.cancellationRate - prev.cancellationRate, 1),
      },
      hasPrevious: prevFiltered.length > 0,
    };
  }, [filtered, prevFiltered]);

  // Série diária sobreposta: período atual vs. anterior alinhados por deslocamento.
  const dailyComparison = useMemo<DailyComparisonPoint[]>(() => {
    const days = parseInt(filters.period, 10) || 30;
    const now = new Date();
    // Início da janela atual (dia mais antigo do período atual).
    const currentStart = startOfDay(subDays(now, days - 1));
    const previousStart = startOfDay(subDays(now, days * 2 - 1));

    const bucket = (set: OrderRow[], windowStart: Date) => {
      const counts = new Array<number>(days).fill(0);
      const costs = new Array<number>(days).fill(0);
      const startMs = windowStart.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      set.forEach((r) => {
        const idx = Math.floor((new Date(r.created_at).getTime() - startMs) / dayMs);
        if (idx >= 0 && idx < days) {
          counts[idx] += 1;
          costs[idx] += r.total_cost || 0;
        }
      });
      return { counts, costs };
    };

    const cur = bucket(filtered, currentStart);
    const prev = bucket(prevFiltered, previousStart);

    return Array.from({ length: days }, (_, i) => ({
      label: `Dia ${i + 1}`,
      current: cur.counts[i],
      previous: prev.counts[i],
      currentCost: round(cur.costs[i], 2),
      previousCost: round(prev.costs[i], 2),
    }));
  }, [filtered, prevFiltered, filters.period]);


  return {
    loading,
    refreshing,
    fetchData,
    filterOptions,
    filteredRows: filtered,
    cost,
    performance,
    geography,
    daily,
    dailyComparison,
    comparison,
    geoResolution: regionResolution,
    geoPoints: geoCoords,
  };
}
