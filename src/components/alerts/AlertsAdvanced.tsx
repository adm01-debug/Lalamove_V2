import { useState, useMemo, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeCheck, CheckCheck, Eye, Trash2, ChevronDown, ListFilter, Layers, LayoutGrid, List, Archive, Volume2, VolumeX, RefreshCw, X, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from '@/lib/utils';
import { Alert } from '@/types';
import { alertIcons, severityConfig, alertTypeLabels, formatTimeAgo, type GroupBy, type SortBy, type ViewMode, type GroupedAlerts } from '@/hooks/useAlertGrouping';

// Re-export hooks
export { useAlertGrouping, useAlertSelection } from '@/hooks/useAlertGrouping';
export type { GroupBy, SortBy, ViewMode, GroupedAlerts } from '@/hooks/useAlertGrouping';

// ============ BulkActionsBar ============
interface BulkActionsBarProps {
  selectedCount: number; totalCount: number; onSelectAll: () => void; onDeselectAll: () => void;
  onMarkAsRead: () => void; onDismiss: () => void; onArchive: () => void; isAllSelected: boolean;
}

export function BulkActionsBar({ selectedCount, totalCount, onSelectAll, onDeselectAll, onMarkAsRead, onDismiss, onArchive, isAllSelected }: BulkActionsBarProps) {
  if (selectedCount === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <Card className="shadow-2xl border-primary/30 bg-card/95 backdrop-blur-xl">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-border">
            <Checkbox checked={isAllSelected} onCheckedChange={(checked) => checked ? onSelectAll() : onDeselectAll()} />
            <span className="text-sm font-medium whitespace-nowrap">{selectedCount} de {totalCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onMarkAsRead} className="h-8 px-3 text-xs"><CheckCheck className="w-3.5 h-3.5 mr-1.5" />Marcar lido</Button>
            <Button variant="ghost" size="sm" onClick={onArchive} className="h-8 px-3 text-xs"><Archive className="w-3.5 h-3.5 mr-1.5" />Arquivar</Button>
            <Button variant="ghost" size="sm" onClick={onDismiss} className="h-8 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 mr-1.5" />Dispensar</Button>
          </div>
          <Button variant="ghost" size="icon" aria-label="Limpar seleção" onClick={onDeselectAll} className="h-8 w-8 ml-2"><X className="w-4 h-4" /></Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============ AlertGroupHeader ============
interface AlertGroupHeaderProps {
  group: GroupedAlerts; isOpen: boolean; onToggle: () => void; selectedCount: number; onSelectAll: () => void;
}

export function AlertGroupHeader({ group, isOpen, onToggle, selectedCount }: AlertGroupHeaderProps) {
  const Icon = group.icon;
  const hasUnread = group.alerts.some(a => !a.isRead);
  return (
    <CollapsibleTrigger asChild>
      <motion.button whileTap={{ scale: 0.99 }} onClick={onToggle} className={cn("w-full flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-secondary/30", group.bgColor, hasUnread ? 'border-l-4' : '', group.key === 'CRITICAL' ? 'border-l-destructive' : group.key === 'WARNING' ? 'border-l-warning' : 'border-l-info')}>
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", group.bgColor)}><Icon className={cn("w-4 h-4", group.color)} /></div>
          <div className="text-left">
            <span className="font-semibold text-sm">{group.label}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] h-4">{group.count} alerta{group.count !== 1 ? 's' : ''}</Badge>
              {hasUnread && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && <Badge variant="outline" className="text-[10px]">{selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}</Badge>}
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown className="w-4 h-4 text-muted-foreground" /></motion.div>
        </div>
      </motion.button>
    </CollapsibleTrigger>
  );
}

// ============ AlertListItem ============
interface AlertListItemProps {
  alert: Alert; isSelected: boolean; onSelect: (id: string) => void; onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void; onViewDetails: (alert: Alert) => void; onAcknowledge: (id: string) => void; viewMode: ViewMode;
}

export const AlertListItem = forwardRef<HTMLDivElement, AlertListItemProps>(function AlertListItem({ alert, isSelected, onSelect, onMarkAsRead, onDismiss, onViewDetails, onAcknowledge, viewMode }, ref) {
  const Icon = alertIcons[alert.type] || AlertCircle;
  const severity = severityConfig[alert.severity];

  if (viewMode === 'compact') {
    return (
      <motion.div ref={ref} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} className={cn("flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer hover:bg-secondary/30 active:bg-secondary/50", isSelected && "bg-primary/10 ring-1 ring-primary/30", !alert.isRead && "bg-gradient-to-r from-primary/5 to-transparent")} onClick={() => onViewDetails(alert)}>
        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(alert.id)} onClick={(e) => e.stopPropagation()} className="h-4 w-4" />
        <div className={cn("p-1.5 rounded-md", severity.bgColor)}><Icon className={cn("w-3 h-3", severity.color)} /></div>
        <div className="flex-1 min-w-0"><p className={cn("text-xs font-medium truncate", !alert.isRead ? "text-foreground" : "text-muted-foreground")}>{alert.title}</p></div>
        <span className="text-[10px] text-muted-foreground shrink-0">{formatTimeAgo(alert.createdAt)}</span>
        {alert.acknowledgedAt && <BadgeCheck className="w-3 h-3 text-success shrink-0" aria-label="Reconhecido" />}
        {!alert.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
      </motion.div>
    );
  }

  return (
    <motion.div ref={ref} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} className={cn("group flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-secondary/20", isSelected && "bg-primary/10 ring-1 ring-primary/30 border-primary/30", !alert.isRead && "border-l-2", !alert.isRead && alert.severity === 'CRITICAL' && "border-l-destructive", !alert.isRead && alert.severity === 'WARNING' && "border-l-warning", !alert.isRead && alert.severity === 'INFO' && "border-l-info", alert.isRead && "border-border/30 opacity-70")} onClick={() => onMarkAsRead(alert.id)}>
      <Checkbox checked={isSelected} onCheckedChange={() => onSelect(alert.id)} onClick={(e) => e.stopPropagation()} className="mt-1" />
      <div className={cn("p-2 rounded-lg shrink-0", severity.bgColor, severity.borderColor, "border")}><Icon className={cn("w-4 h-4", severity.color)} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={cn("font-semibold text-sm truncate", !alert.isRead ? "text-foreground" : "text-muted-foreground")}>{alert.title}</h4>
          {!alert.isRead && <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />}
          {alert.acknowledgedAt && <Badge variant="success" className="text-[10px] gap-1"><BadgeCheck className="w-3 h-3" />Reconhecido</Badge>}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{alert.message}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={severity.color.includes('destructive') ? 'destructive' : severity.color.includes('warning') ? 'warning' : 'info'} className="text-[10px]">{alertTypeLabels[alert.type]}</Badge>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimeAgo(alert.createdAt)}</span>
          {alert.orderId && <span className="text-[10px] font-mono bg-secondary/50 px-1.5 py-0.5 rounded">{alert.orderId}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!alert.acknowledgedAt && (
          <Button variant="ghost" size="icon" aria-label="Reconhecer alerta" title="Reconhecer (cancela o escalonamento)" className="h-7 w-7 text-success hover:bg-success/10" onClick={(e) => { e.stopPropagation(); onAcknowledge(alert.id); }}><BadgeCheck className="w-3.5 h-3.5" /></Button>
        )}
        <Button variant="ghost" size="icon" aria-label="Ver detalhes do alerta" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onViewDetails(alert); }}><Eye className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" aria-label="Dispensar alerta" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </motion.div>
  );
});

// ============ AlertsToolbar ============
interface AlertsToolbarProps {
  groupBy: GroupBy; setGroupBy: (v: GroupBy) => void; sortBy: SortBy; setSortBy: (v: SortBy) => void;
  viewMode: ViewMode; setViewMode: (v: ViewMode) => void; soundEnabled: boolean; setSoundEnabled: (v: boolean) => void;
  onRefresh: () => void; isRefreshing: boolean;
}

export function AlertsToolbar({ groupBy, setGroupBy, sortBy, setSortBy, viewMode, setViewMode, soundEnabled, setSoundEnabled, onRefresh, isRefreshing }: AlertsToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 text-xs"><Layers className="w-3.5 h-3.5 mr-1.5" />Agrupar<ChevronDown className="w-3 h-3 ml-1" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuCheckboxItem checked={groupBy === 'none'} onCheckedChange={() => setGroupBy('none')}>Sem agrupamento</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={groupBy === 'severity'} onCheckedChange={() => setGroupBy('severity')}>Por severidade</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={groupBy === 'type'} onCheckedChange={() => setGroupBy('type')}>Por tipo</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={groupBy === 'time'} onCheckedChange={() => setGroupBy('time')}>Por período</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 text-xs"><ListFilter className="w-3.5 h-3.5 mr-1.5" />Ordenar<ChevronDown className="w-3 h-3 ml-1" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuCheckboxItem checked={sortBy === 'newest'} onCheckedChange={() => setSortBy('newest')}>Mais recentes</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={sortBy === 'oldest'} onCheckedChange={() => setSortBy('oldest')}>Mais antigos</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={sortBy === 'severity'} onCheckedChange={() => setSortBy('severity')}>Por prioridade</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-1">
        <div className="flex items-center border rounded-lg p-0.5">
          <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" aria-label="Visualização em lista" className="h-7 w-7" onClick={() => setViewMode('list')}><List className="w-3.5 h-3.5" /></Button>
          <Button variant={viewMode === 'compact' ? 'secondary' : 'ghost'} size="icon" aria-label="Visualização compacta" className="h-7 w-7" onClick={() => setViewMode('compact')}><LayoutGrid className="w-3.5 h-3.5" /></Button>
        </div>
        <Button variant="ghost" size="icon" aria-label={soundEnabled ? "Desativar som" : "Ativar som"} className="h-8 w-8" onClick={() => setSoundEnabled(!soundEnabled)}>{soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}</Button>
        <Button variant="ghost" size="icon" aria-label="Atualizar alertas" className="h-8 w-8" onClick={onRefresh} disabled={isRefreshing}><RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} /></Button>
      </div>
    </div>
  );
}
