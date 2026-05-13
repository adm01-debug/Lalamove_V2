import { ReactNode, useState, useRef } from 'react';
import { LucideIcon, ChevronDown, ChevronUp, MoreHorizontal, Copy, Check, Clock, AlertCircle, CheckCircle, Truck, Bell, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Button } from './button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';
import { Badge } from './badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

export interface TimelineEvent {
  id: string;
  time: Date | string;
  type: 'delivery' | 'alert' | 'approval' | 'incident' | 'info' | 'success' | 'warning' | 'system';
  icon?: LucideIcon;
  title: string;
  description?: string;
  metadata?: Record<string, string>;
  onClick?: () => void;
  user?: { name: string; avatar?: string };
  status?: 'pending' | 'completed' | 'failed' | 'in_progress';
  actions?: Array<{ label: string; icon?: LucideIcon; onClick: () => void; variant?: 'default' | 'destructive' }>;
  expandedContent?: ReactNode;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  relatedId?: string;
}

export const eventStyles = {
  delivery: { iconBg: 'bg-success/10', iconColor: 'text-success', dot: 'bg-success', border: 'border-success/30', gradient: 'from-success/20 to-transparent', icon: Truck },
  alert: { iconBg: 'bg-destructive/10', iconColor: 'text-destructive', dot: 'bg-destructive', border: 'border-destructive/30', gradient: 'from-destructive/20 to-transparent', icon: AlertCircle },
  approval: { iconBg: 'bg-warning/10', iconColor: 'text-warning', dot: 'bg-warning', border: 'border-warning/30', gradient: 'from-warning/20 to-transparent', icon: Clock },
  incident: { iconBg: 'bg-destructive/10', iconColor: 'text-destructive', dot: 'bg-destructive', border: 'border-destructive/30', gradient: 'from-destructive/20 to-transparent', icon: AlertCircle },
  info: { iconBg: 'bg-info/10', iconColor: 'text-info', dot: 'bg-info', border: 'border-info/30', gradient: 'from-info/20 to-transparent', icon: Info },
  success: { iconBg: 'bg-success/10', iconColor: 'text-success', dot: 'bg-success', border: 'border-success/30', gradient: 'from-success/20 to-transparent', icon: CheckCircle },
  warning: { iconBg: 'bg-warning/10', iconColor: 'text-warning', dot: 'bg-warning', border: 'border-warning/30', gradient: 'from-warning/20 to-transparent', icon: Bell },
  system: { iconBg: 'bg-slate-500/10', iconColor: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-500', border: 'border-slate-500/30', gradient: 'from-slate-500/20 to-transparent', icon: Info },
};

export const priorityStyles = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 animate-pulse',
};

export function formatEventTime(time: Date | string): string {
  const date = typeof time === 'string' ? new Date(time) : time;
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

export function TimelineItem({ event, isLast, index, animated, compact }: {
  event: TimelineEvent; isLast: boolean; index: number; animated: boolean; compact: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const style = eventStyles[event.type];
  const Icon = event.icon || style.icon;

  const handleCopyId = () => {
    if (event.relatedId) { navigator.clipboard.writeText(event.relatedId); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const content = (
    <div ref={ref} className={cn("relative pl-10 pb-6", event.onClick && "cursor-pointer", !compact && "hover:bg-muted/30 rounded-xl p-3 -ml-3 transition-all duration-200", isLast && "pb-0")} onClick={event.onClick}>
      {!isLast && <div className={cn("absolute left-[15px] top-10 bottom-0 w-[2px] bg-gradient-to-b", style.gradient, "from-border via-border/50 to-transparent")} />}
      <div className="absolute left-0 top-1.5">
        <div className={cn("relative flex h-8 w-8 items-center justify-center rounded-full border-2", style.border, style.iconBg, "shadow-sm", event.priority === 'critical' && "ring-2 ring-red-500/50 ring-offset-2 ring-offset-background")}>
          <Icon className={cn("w-4 h-4", style.iconColor)} />
          {event.priority === 'critical' && <motion.div className="absolute inset-0 rounded-full bg-red-500/30" animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground leading-tight">{event.title}</p>
              {event.priority && event.priority !== 'low' && <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", priorityStyles[event.priority])}>{event.priority === 'critical' ? '🔴 Crítico' : event.priority === 'high' ? '🟠 Alto' : '🟡 Médio'}</Badge>}
              {event.status && <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", event.status === 'completed' && "border-emerald-500 text-emerald-600", event.status === 'failed' && "border-red-500 text-red-600", event.status === 'in_progress' && "border-blue-500 text-blue-600", event.status === 'pending' && "border-amber-500 text-amber-600")}>{event.status === 'completed' ? '✓ Concluído' : event.status === 'failed' ? '✗ Falhou' : event.status === 'in_progress' ? '⋯ Em andamento' : '○ Pendente'}</Badge>}
            </div>
            {event.user && <div className="flex items-center gap-1.5 mt-1">{event.user.avatar ? <img src={event.user.avatar} alt={event.user.name} className="w-4 h-4 rounded-full" /> : <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">{event.user.name.charAt(0).toUpperCase()}</div>}<span className="text-xs text-muted-foreground">{event.user.name}</span></div>}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip><TooltipTrigger asChild><time className="text-xs text-muted-foreground whitespace-nowrap cursor-help">{formatEventTime(event.time)}</time></TooltipTrigger><TooltipContent>{format(typeof event.time === 'string' ? new Date(event.time) : event.time, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</TooltipContent></Tooltip>
            {(event.actions || event.relatedId) && (
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="w-3 h-3" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {event.relatedId && <DropdownMenuItem onClick={handleCopyId}>{copied ? <Check className="w-3 h-3 mr-2" /> : <Copy className="w-3 h-3 mr-2" />}{copied ? 'Copiado!' : `Copiar ID: ${event.relatedId.slice(0, 8)}...`}</DropdownMenuItem>}
                  {event.actions?.map((action, i) => <DropdownMenuItem key={i} onClick={(e) => { e.stopPropagation(); action.onClick(); }} className={action.variant === 'destructive' ? 'text-destructive' : ''}>{action.icon && <action.icon className="w-3 h-3 mr-2" />}{action.label}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {event.description && <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>}
        {event.tags && event.tags.length > 0 && <div className="flex flex-wrap gap-1">{event.tags.map((tag, i) => <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">#{tag}</Badge>)}</div>}
        {event.metadata && Object.keys(event.metadata).length > 0 && <div className="flex flex-wrap gap-2 mt-2">{Object.entries(event.metadata).map(([key, value]) => <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/50 text-xs"><span className="text-muted-foreground">{key}:</span><span className="font-medium">{value}</span></span>)}</div>}
        {event.expandedContent && (
          <>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>{isExpanded ? <><ChevronUp className="w-3 h-3 mr-1" />Menos detalhes</> : <><ChevronDown className="w-3 h-3 mr-1" />Mais detalhes</>}</Button>
            <AnimatePresence>{isExpanded && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden"><div className="pt-2 border-t mt-2">{event.expandedContent}</div></motion.div>}</AnimatePresence>
          </>
        )}
      </div>
    </div>
  );

  if (!animated) return content;
  return <motion.div initial={{ opacity: 0, x: -20 }} animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }} transition={{ duration: 0.4, delay: index * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}>{content}</motion.div>;
}
