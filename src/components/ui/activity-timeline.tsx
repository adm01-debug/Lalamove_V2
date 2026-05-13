import { useState } from 'react';
import { ChevronDown, Filter, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isToday, isYesterday, isThisWeek, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Button } from './button';
import { Badge } from './badge';
import { TimelineItem, eventStyles, formatEventTime, type TimelineEvent } from './timeline-item';

export type { TimelineEvent } from './timeline-item';
export { eventStyles, formatEventTime } from './timeline-item';

interface ActivityTimelineProps {
  events: TimelineEvent[];
  maxItems?: number;
  className?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  filter?: TimelineEvent['type'] | 'all';
  onFilterChange?: (filter: TimelineEvent['type'] | 'all') => void;
  showFilters?: boolean;
  groupByDate?: boolean;
  animated?: boolean;
  compact?: boolean;
  virtualized?: boolean;
}

function getDateGroup(time: Date | string): string {
  const date = typeof time === 'string' ? new Date(time) : time;
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  if (isThisWeek(date)) return format(date, "EEEE", { locale: ptBR });
  return format(date, "dd 'de' MMMM", { locale: ptBR });
}

export function ActivityTimeline({ events, maxItems = 10, className, onLoadMore, hasMore = false, loading = false, filter = 'all', onFilterChange, showFilters = false, groupByDate = false, animated = true, compact = false }: ActivityTimelineProps) {
  const filteredEvents = filter === 'all' ? events : events.filter(e => e.type === filter);
  const displayEvents = filteredEvents.slice(0, maxItems);

  const groupedEvents = groupByDate
    ? displayEvents.reduce((acc, event) => { const group = getDateGroup(event.time); if (!acc[group]) acc[group] = []; acc[group].push(event); return acc; }, {} as Record<string, TimelineEvent[]>)
    : null;

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3"><Clock className="w-6 h-6 text-muted-foreground" /></div>
        <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade recente</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Novas atividades aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {showFilters && onFilterChange && (
        <div className="flex items-center gap-2 pb-3 border-b overflow-x-auto">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {(['all', 'delivery', 'alert', 'approval', 'incident', 'info'] as const).map((type) => (
            <Button key={type} variant={filter === type ? "secondary" : "ghost"} size="sm" className="h-7 text-xs whitespace-nowrap" onClick={() => onFilterChange(type)}>
              {type === 'all' ? 'Todos' : type === 'delivery' ? '🚚 Entregas' : type === 'alert' ? '🔔 Alertas' : type === 'approval' ? '✋ Aprovações' : type === 'incident' ? '⚠️ Incidentes' : 'ℹ️ Info'}
              {type !== 'all' && <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">{events.filter(e => e.type === type).length}</Badge>}
            </Button>
          ))}
        </div>
      )}

      {groupByDate && groupedEvents ? (
        Object.entries(groupedEvents).map(([date, dateEvents]) => (
          <div key={date} className="space-y-0">
            <div className="sticky top-0 z-10 py-2"><Badge variant="outline" className="text-xs font-medium bg-background">{date}</Badge></div>
            {dateEvents.map((event, index) => <TimelineItem key={event.id} event={event} isLast={index === dateEvents.length - 1} index={index} animated={animated} compact={compact} />)}
          </div>
        ))
      ) : (
        displayEvents.map((event, index) => <TimelineItem key={event.id} event={event} isLast={index === displayEvents.length - 1} index={index} animated={animated} compact={compact} />)
      )}

      {(hasMore || filteredEvents.length > maxItems) && (
        <div className="text-center pt-4 border-t">
          <Button variant="ghost" size="sm" className="text-xs" onClick={onLoadMore} disabled={loading}>
            {loading ? <motion.div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full mr-2" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} /> : <ChevronDown className="w-4 h-4 mr-1" />}
            {loading ? 'Carregando...' : `Ver mais ${filteredEvents.length - maxItems} eventos`}
          </Button>
        </div>
      )}
    </div>
  );
}

// Compact variant
export function CompactTimeline({ events, className, animated = true }: { events: Array<{ id: string; time: Date | string; text: string; type: TimelineEvent['type'] }>; className?: string; animated?: boolean }) {
  return (
    <div className={cn("space-y-2", className)}>
      {events.map((event, index) => {
        const style = eventStyles[event.type] || eventStyles.info;
        const content = (
          <div className="flex items-start gap-2 group">
            <div className={cn("mt-1.5 w-2 h-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-125", style.dot)} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-relaxed">{event.text}</p>
              <time className="text-[10px] text-muted-foreground">{formatEventTime(event.time)}</time>
            </div>
          </div>
        );
        if (!animated) return <div key={event.id}>{content}</div>;
        return <motion.div key={event.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>{content}</motion.div>;
      })}
    </div>
  );
}

// Horizontal variant
export function HorizontalTimeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2" />
      <div className="flex items-center justify-between gap-4 overflow-x-auto pb-4">
        {events.map((event, index) => {
          const style = eventStyles[event.type] || eventStyles.info;
          const Icon = event.icon || style.icon;
          return (
            <motion.div key={event.id} className="flex flex-col items-center gap-2 flex-shrink-0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <time className="text-[10px] text-muted-foreground whitespace-nowrap">{formatEventTime(event.time)}</time>
              <div className={cn("relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2", style.border, style.iconBg, "bg-background shadow-sm")}><Icon className={cn("w-5 h-5", style.iconColor)} /></div>
              <div className="text-center max-w-[100px]"><p className="text-xs font-medium text-foreground line-clamp-2">{event.title}</p></div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
