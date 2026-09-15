import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  RefreshCw, Check, Clock, Wifi, WifiOff, AlertTriangle, 
  Pause, Play, Settings, Zap, Timer, TrendingUp
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "./button";
import { useState, useEffect } from "react";
import { Badge } from "./badge";
import { Progress } from "./progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

// Re-export hook from dedicated file
export { useDataRefresh } from "@/hooks/useDataRefresh";

interface DataRefreshIndicatorProps {
  lastUpdated: Date | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  autoRefreshInterval?: number;
  className?: string;
  variant?: "compact" | "full" | "minimal" | "floating" | "inline";
  isOnline?: boolean;
  error?: string | null;
  showCountdown?: boolean;
  paused?: boolean;
  onPauseToggle?: () => void;
  refreshCount?: number;
  averageRefreshTime?: number;
  nextRefreshIn?: number;
  connectionQuality?: "excellent" | "good" | "fair" | "poor";
}

const connectionQualityConfig = {
  excellent: { color: "text-success", bg: "bg-success", label: "Excelente" },
  good: { color: "text-success", bg: "bg-success", label: "Boa" },
  fair: { color: "text-warning", bg: "bg-warning", label: "Regular" },
  poor: { color: "text-destructive", bg: "bg-destructive", label: "Fraca" },
};

export function DataRefreshIndicator({
  lastUpdated,
  isRefreshing = false,
  onRefresh,
  autoRefreshInterval,
  className,
  variant = "compact",
  isOnline = true,
  error = null,
  showCountdown = false,
  paused = false,
  onPauseToggle,
  refreshCount = 0,
  averageRefreshTime,
  nextRefreshIn,
  connectionQuality = "excellent",
}: DataRefreshIndicatorProps) {
  const [countdown, setCountdown] = useState(nextRefreshIn || autoRefreshInterval || 0);
  const timeAgo = lastUpdated
    ? formatDistanceToNow(lastUpdated, { addSuffix: true, locale: ptBR })
    : "Nunca";

  useEffect(() => {
    if (!showCountdown || !autoRefreshInterval || paused || isRefreshing) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountdown(nextRefreshIn || autoRefreshInterval);
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : autoRefreshInterval));
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, showCountdown, paused, isRefreshing, nextRefreshIn]);

  const qualityConfig = connectionQualityConfig[connectionQuality];

  if (variant === "minimal") return <MinimalVariant error={error} isRefreshing={isRefreshing} qualityConfig={qualityConfig} timeAgo={timeAgo} className={className} />;
  if (variant === "inline") return <InlineVariant error={error} isRefreshing={isRefreshing} onRefresh={onRefresh} timeAgo={timeAgo} autoRefreshInterval={autoRefreshInterval} className={className} />;
  if (variant === "compact") return <CompactVariant error={error} isRefreshing={isRefreshing} onRefresh={onRefresh} timeAgo={timeAgo} showCountdown={showCountdown} autoRefreshInterval={autoRefreshInterval} countdown={countdown} paused={paused} onPauseToggle={onPauseToggle} className={className} />;
  if (variant === "floating") return <FloatingVariant error={error} isRefreshing={isRefreshing} isOnline={isOnline} onRefresh={onRefresh} timeAgo={timeAgo} qualityConfig={qualityConfig} connectionQuality={connectionQuality} showCountdown={showCountdown} autoRefreshInterval={autoRefreshInterval} countdown={countdown} paused={paused} onPauseToggle={onPauseToggle} refreshCount={refreshCount} className={className} />;

  // Full variant
  return <FullVariant error={error} isRefreshing={isRefreshing} isOnline={isOnline} onRefresh={onRefresh} timeAgo={timeAgo} qualityConfig={qualityConfig} connectionQuality={connectionQuality} showCountdown={showCountdown} autoRefreshInterval={autoRefreshInterval} countdown={countdown} paused={paused} onPauseToggle={onPauseToggle} refreshCount={refreshCount} averageRefreshTime={averageRefreshTime} className={className} />;
}

// ---- Variant sub-components ----

function MinimalVariant({ error, isRefreshing, qualityConfig, timeAgo, className }: { error?: string | null; isRefreshing: boolean; qualityConfig: { bg: string }; timeAgo: string; className?: string }) {
  return (
    <motion.div className={cn("flex items-center gap-1.5", className)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <AnimatePresence mode="wait">
        {error ? <motion.div key="error" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><AlertTriangle className="w-3 h-3 text-destructive" /></motion.div>
          : isRefreshing ? <motion.div key="refreshing" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw className="w-3 h-3 text-primary" /></motion.div>
          : <motion.div key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} className={cn("w-2 h-2 rounded-full", qualityConfig.bg)} />}
      </AnimatePresence>
      <span className="text-xs text-muted-foreground">{error ? "Erro" : isRefreshing ? "Atualizando..." : timeAgo}</span>
    </motion.div>
  );
}

function InlineVariant({ error, isRefreshing, onRefresh, timeAgo, autoRefreshInterval, className }: { error?: string | null; isRefreshing: boolean; onRefresh?: () => void; timeAgo: string; autoRefreshInterval?: number; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors", error && "text-destructive", className)} onClick={onRefresh} disabled={isRefreshing} whileTap={{ scale: 0.95 }}>
          <AnimatePresence mode="wait">
            {isRefreshing ? <motion.div key="spin" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw className="w-3 h-3" /></motion.div>
              : <motion.div key="static" initial={{ rotate: -180, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}>{error ? <AlertTriangle className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}</motion.div>}
          </AnimatePresence>
          <span>{isRefreshing ? "..." : timeAgo}</span>
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{error || `Última atualização: ${timeAgo}`}</p>
        {autoRefreshInterval && <p className="text-muted-foreground">Auto-refresh: {autoRefreshInterval}s</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function CompactVariant({ error, isRefreshing, onRefresh, timeAgo, showCountdown, autoRefreshInterval, countdown, paused, onPauseToggle, className }: { error?: string | null; isRefreshing: boolean; onRefresh?: () => void; timeAgo: string; showCountdown?: boolean; autoRefreshInterval?: number; countdown: number; paused?: boolean; onPauseToggle?: () => void; className?: string }) {
  return (
    <motion.div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 backdrop-blur-sm", error && "border-destructive/50 bg-destructive/10", className)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
      <AnimatePresence mode="wait">
        {error ? <motion.div key="error" initial={{ scale: 0 }} animate={{ scale: 1 }}><AlertTriangle className="w-3.5 h-3.5 text-destructive" /></motion.div>
          : isRefreshing ? <motion.div key="refreshing" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw className="w-3.5 h-3.5 text-primary" /></motion.div>
          : <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-3.5 h-3.5 text-emerald-500" /></motion.div>}
      </AnimatePresence>
      <span className="text-xs text-muted-foreground">{error ? "Erro na sincronização" : isRefreshing ? "Atualizando..." : `Atualizado ${timeAgo}`}</span>
      {showCountdown && autoRefreshInterval && !isRefreshing && !paused && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{countdown}s</Badge>}
      {onPauseToggle && <button onClick={onPauseToggle} className="p-1 -mr-1 rounded-full hover:bg-muted transition-colors" aria-label={paused ? "Retomar" : "Pausar"}>{paused ? <Play className="w-3 h-3 text-muted-foreground" /> : <Pause className="w-3 h-3 text-muted-foreground" />}</button>}
      {onRefresh && !isRefreshing && <button onClick={onRefresh} className="p-1 -mr-1 rounded-full hover:bg-muted transition-colors" aria-label="Atualizar dados"><RefreshCw className="w-3 h-3 text-muted-foreground hover:text-foreground" /></button>}
    </motion.div>
  );
}

function FloatingVariant({ error, isRefreshing, isOnline, onRefresh, timeAgo, qualityConfig, connectionQuality, showCountdown, autoRefreshInterval, countdown, paused, onPauseToggle, refreshCount, className }: { error?: string | null; isRefreshing: boolean; isOnline: boolean; onRefresh?: () => void; timeAgo: string; qualityConfig: { color: string; bg: string }; connectionQuality: string; showCountdown?: boolean; autoRefreshInterval?: number; countdown: number; paused?: boolean; onPauseToggle?: () => void; refreshCount: number; className?: string }) {
  return (
    <motion.div className={cn("fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/95 border border-border/50 backdrop-blur-md shadow-xl", error && "border-destructive/50", className)} initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
      <div className="flex flex-col items-center gap-1">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isOnline ? "bg-muted/50" : "bg-destructive/10")}>
          {isOnline ? <Wifi className={cn("w-5 h-5", qualityConfig.color)} /> : <WifiOff className="w-5 h-5 text-destructive" />}
        </div>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4].map((level) => <div key={level} className={cn("w-1 rounded-full transition-all", level <= (connectionQuality === "excellent" ? 4 : connectionQuality === "good" ? 3 : connectionQuality === "fair" ? 2 : 1) ? qualityConfig.bg : "bg-muted")} style={{ height: `${level * 3 + 2}px` }} />)}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{error ? "Erro de conexão" : isOnline ? "Sincronizado" : "Offline"}</span>
          {isRefreshing && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw className="w-3 h-3 text-primary" /></motion.div>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" /><span>{timeAgo}</span>
          {refreshCount > 0 && <><span>•</span><span>{refreshCount} atualizações</span></>}
        </div>
        {showCountdown && autoRefreshInterval && !paused && <div className="mt-2"><Progress value={((autoRefreshInterval - countdown) / autoRefreshInterval) * 100} className="h-1" /></div>}
      </div>
      <div className="flex items-center gap-1">
        {onPauseToggle && <Button variant="ghost" size="icon" aria-label={paused ? "Retomar atualização" : "Pausar atualização"} onClick={onPauseToggle} className="h-8 w-8">{paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}</Button>}
        {onRefresh && <Button variant="ghost" size="icon" aria-label="Atualizar agora" onClick={onRefresh} disabled={isRefreshing} className="h-8 w-8"><RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} /></Button>}
      </div>
    </motion.div>
  );
}

function FullVariant({ error, isRefreshing, isOnline, onRefresh, timeAgo, qualityConfig, connectionQuality, showCountdown, autoRefreshInterval, countdown, paused, onPauseToggle, refreshCount, averageRefreshTime, className }: { error?: string | null; isRefreshing: boolean; isOnline: boolean; onRefresh?: () => void; timeAgo: string; qualityConfig: { color: string; bg: string; label: string }; connectionQuality: string; showCountdown?: boolean; autoRefreshInterval?: number; countdown: number; paused?: boolean; onPauseToggle?: () => void; refreshCount: number; averageRefreshTime?: number; className?: string }) {
  return (
    <motion.div className={cn("flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm", error && "border-destructive/30 bg-destructive/5", className)} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className={cn("flex items-center justify-center w-12 h-12 rounded-xl", error ? "bg-destructive/10" : isOnline ? "bg-muted" : "bg-destructive/10")}>
            {error ? <AlertTriangle className="w-6 h-6 text-destructive" /> : isOnline ? <Wifi className={cn("w-6 h-6", qualityConfig.color)} /> : <WifiOff className="w-6 h-6 text-destructive" />}
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
            {[1, 2, 3].map((level) => <div key={level} className={cn("w-1.5 h-1.5 rounded-full", level <= (connectionQuality === "excellent" ? 3 : connectionQuality === "good" ? 2 : 1) ? qualityConfig.bg : "bg-muted")} />)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{error ? "Falha na sincronização" : isOnline ? "Conectado" : "Modo offline"}</span>
            {paused && <Badge variant="secondary" className="text-[10px]"><Pause className="w-2.5 h-2.5 mr-1" />Pausado</Badge>}
            {isRefreshing && <motion.div className="flex items-center gap-1 text-xs text-primary" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw className="w-3 h-3" /></motion.div>Sincronizando...</motion.div>}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span>Atualizado {timeAgo}</span></div>
            {autoRefreshInterval && <div className="flex items-center gap-1"><Timer className="w-3 h-3" /><span>A cada {autoRefreshInterval}s</span></div>}
            {averageRefreshTime && <div className="flex items-center gap-1"><Zap className="w-3 h-3" /><span>~{averageRefreshTime}ms</span></div>}
            {refreshCount > 0 && <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /><span>{refreshCount} syncs</span></div>}
          </div>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          {showCountdown && autoRefreshInterval && !paused && !isRefreshing && (
            <div className="flex items-center gap-2 mt-2">
              <Progress value={((autoRefreshInterval - countdown) / autoRefreshInterval) * 100} className="h-1.5 flex-1 max-w-32" />
              <span className="text-[10px] text-muted-foreground tabular-nums">{countdown}s</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onPauseToggle && <Button variant="ghost" size="sm" onClick={onPauseToggle} className="gap-1.5">{paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}{paused ? "Retomar" : "Pausar"}</Button>}
        {onRefresh && <Button variant={error ? "destructive" : "outline"} size="sm" onClick={onRefresh} disabled={isRefreshing} className="gap-2"><RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />{isRefreshing ? "Atualizando..." : error ? "Tentar novamente" : "Atualizar"}</Button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Configurações de atualização" className="h-8 w-8"><Settings className="w-4 h-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Configurações de sync</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem><Timer className="w-4 h-4 mr-2" />Intervalo: {autoRefreshInterval || 30}s</DropdownMenuItem>
            <DropdownMenuItem><Wifi className="w-4 h-4 mr-2" />Qualidade: {qualityConfig.label}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

// Live indicator pulsante
export function LiveIndicator({ className, variant = "default", label = "Ao vivo", showLabel = true }: { className?: string; variant?: "default" | "recording" | "streaming"; label?: string; showLabel?: boolean }) {
  const variantStyles = { default: "bg-success", recording: "bg-destructive", streaming: "bg-info" };
  const variantTextStyles = { default: "text-success", recording: "text-destructive", streaming: "text-info" };
  return (
    <motion.div className={cn("flex items-center gap-2", className)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <span className="relative flex h-3 w-3">
        <motion.span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", variantStyles[variant])} animate={{ scale: [1, 1.5, 1], opacity: [0.75, 0, 0.75] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
        <span className={cn("relative inline-flex rounded-full h-3 w-3", variantStyles[variant])} />
      </span>
      {showLabel && <span className={cn("text-xs font-medium", variantTextStyles[variant])}>{label}</span>}
    </motion.div>
  );
}

// Sync status badge
export function SyncStatusBadge({ status, className }: { status: "synced" | "syncing" | "error" | "offline"; className?: string }) {
  const config = {
    synced: { icon: Check, label: "Sincronizado", color: "text-success bg-success/10" },
    syncing: { icon: RefreshCw, label: "Sincronizando", color: "text-info bg-info/10" },
    error: { icon: AlertTriangle, label: "Erro", color: "text-destructive bg-destructive/10" },
    offline: { icon: WifiOff, label: "Offline", color: "text-muted-foreground bg-muted" },
  };
  const { icon: Icon, label, color } = config[status];
  return (
    <motion.div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", color, className)} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      <Icon className={cn("w-3 h-3", status === "syncing" && "animate-spin")} />{label}
    </motion.div>
  );
}
