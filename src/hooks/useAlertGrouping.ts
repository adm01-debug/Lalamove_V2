import { useState, useMemo, useCallback } from 'react';
import { Bell, Clock, AlertCircle, AlertTriangle, Info, Shield, MapPin, X } from 'lucide-react';
import { Alert, AlertType } from '@/types';

export type GroupBy = 'none' | 'severity' | 'type' | 'time';
export type SortBy = 'newest' | 'oldest' | 'severity';
export type ViewMode = 'list' | 'compact';

export interface GroupedAlerts {
  key: string;
  label: string;
  icon: typeof AlertCircle;
  color: string;
  bgColor: string;
  alerts: Alert[];
  count: number;
}

export const alertIcons: Record<AlertType, typeof AlertTriangle> = {
  DRIVER_BLOCKED: Shield, ROUTE_DEVIATION: MapPin, DRIVER_STOPPED: Clock,
  LATE_DELIVERY: AlertCircle, APPROVAL_REQUIRED: AlertTriangle, ORDER_CANCELLED: X,
};

export const severityConfig = {
  CRITICAL: { label: 'Crítico', icon: AlertCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', borderColor: 'border-destructive/30', order: 0 },
  WARNING: { label: 'Aviso', icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/30', order: 1 },
  INFO: { label: 'Informativo', icon: Info, color: 'text-info', bgColor: 'bg-info/10', borderColor: 'border-info/30', order: 2 },
};

export const alertTypeLabels: Record<AlertType, string> = {
  DRIVER_BLOCKED: 'Motorista Bloqueado', ROUTE_DEVIATION: 'Desvio de Rota', DRIVER_STOPPED: 'Motorista Parado',
  LATE_DELIVERY: 'Atraso na Entrega', APPROVAL_REQUIRED: 'Aprovação Necessária', ORDER_CANCELLED: 'Pedido Cancelado',
};

export function formatTimeAgo(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function getTimeGroup(date: Date): string {
  const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (diffHours < 1) return 'Última hora';
  if (diffHours < 24) return 'Hoje';
  if (diffHours < 48) return 'Ontem';
  if (diffHours < 168) return 'Esta semana';
  return 'Anteriores';
}

export function useAlertGrouping(alerts: Alert[], groupBy: GroupBy, sortBy: SortBy): GroupedAlerts[] {
  return useMemo(() => {
    const sortedAlerts = [...alerts].sort((a, b) => {
      if (sortBy === 'newest') return b.createdAt.getTime() - a.createdAt.getTime();
      if (sortBy === 'oldest') return a.createdAt.getTime() - b.createdAt.getTime();
      const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      return order[a.severity] - order[b.severity];
    });

    if (groupBy === 'none') return [{ key: 'all', label: 'Todos os Alertas', icon: Bell, color: 'text-foreground', bgColor: 'bg-secondary/50', alerts: sortedAlerts, count: sortedAlerts.length }];

    if (groupBy === 'severity') {
      const groups: Record<string, Alert[]> = { CRITICAL: [], WARNING: [], INFO: [] };
      sortedAlerts.forEach(a => groups[a.severity].push(a));
      return Object.entries(groups).filter(([, a]) => a.length > 0).map(([severity, alerts]) => {
        const config = severityConfig[severity as keyof typeof severityConfig];
        return { key: severity, label: config.label, icon: config.icon, color: config.color, bgColor: config.bgColor, alerts, count: alerts.length };
      }).sort((a, b) => severityConfig[a.key as keyof typeof severityConfig].order - severityConfig[b.key as keyof typeof severityConfig].order);
    }

    if (groupBy === 'type') {
      const groups: Record<string, Alert[]> = {};
      sortedAlerts.forEach(a => { if (!groups[a.type]) groups[a.type] = []; groups[a.type].push(a); });
      return Object.entries(groups).map(([type, alerts]) => ({ key: type, label: alertTypeLabels[type as AlertType], icon: alertIcons[type as AlertType], color: 'text-foreground', bgColor: 'bg-secondary/50', alerts, count: alerts.length }));
    }

    // time
    const groups: Record<string, Alert[]> = {};
    sortedAlerts.forEach(a => { const g = getTimeGroup(a.createdAt); if (!groups[g]) groups[g] = []; groups[g].push(a); });
    const order = ['Última hora', 'Hoje', 'Ontem', 'Esta semana', 'Anteriores'];
    return Object.entries(groups).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([time, alerts]) => ({ key: time, label: time, icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-secondary/30', alerts, count: alerts.length }));
  }, [alerts, groupBy, sortBy]);
}

export function useAlertSelection(alerts: Alert[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelection = useCallback((id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }, []);
  const selectAll = useCallback(() => { setSelectedIds(new Set(alerts.map(a => a.id))); }, [alerts]);
  const deselectAll = useCallback(() => { setSelectedIds(new Set()); }, []);
  const isAllSelected = alerts.length > 0 && selectedIds.size === alerts.length;
  return { selectedIds, toggleSelection, selectAll, deselectAll, isAllSelected, selectedCount: selectedIds.size };
}
