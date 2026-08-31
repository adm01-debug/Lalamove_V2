import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getElapsedTime, formatElapsedTimeDetailed } from '@/utils/timeUtils';

interface WaitingTimeCounterProps {
  requestedAt: Date;
  className?: string;
}

export function WaitingTimeCounter({ requestedAt, className }: WaitingTimeCounterProps) {
  const [elapsed, setElapsed] = useState(() => getElapsedTime(requestedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsedTime(requestedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [requestedAt]);

  const urgencyClass = getUrgencyClass(elapsed.totalMinutes);

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
      urgencyClass,
      className
    )}>
      <Clock className="w-4 h-4" />
      <span>Aguardando há {formatElapsedTimeDetailed(elapsed)}</span>
    </div>
  );
}

function getUrgencyClass(totalMinutes: number): string {
  // Less than 5 minutes - normal
  if (totalMinutes < 5) {
    return 'bg-muted text-muted-foreground';
  }
  // 5-15 minutes - attention
  if (totalMinutes < 15) {
    return 'bg-warning/20 text-warning';
  }
  // 15-30 minutes - urgent
  if (totalMinutes < 30) {
    return 'bg-warning/20 text-warning';
  }
  // 30+ minutes - critical (pulsing)
  return 'bg-destructive/20 text-destructive animate-pulse';
}
