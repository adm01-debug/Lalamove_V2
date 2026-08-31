// =============================================
// TIME UTILITIES - Funções compartilhadas para cálculo de tempo
// =============================================

export interface ElapsedTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMinutes: number;
  totalHours: number;
  totalDays: number;
}

/**
 * Calcula o tempo decorrido desde uma data específica
 */
export function getElapsedTime(requestedAt: Date): ElapsedTime {
  const now = new Date();
  const diff = now.getTime() - new Date(requestedAt).getTime();
  
  const totalSeconds = Math.floor(diff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  return {
    days: totalDays,
    hours: totalHours % 24,
    minutes: totalMinutes % 60,
    seconds: totalSeconds % 60,
    totalMinutes,
    totalHours,
    totalDays
  };
}

/**
 * Formata o tempo decorrido de forma compacta (para badges)
 */
export function formatElapsedTimeCompact(elapsed: ElapsedTime): string {
  if (elapsed.totalDays > 0) {
    return `${elapsed.days}d ${elapsed.hours}h`;
  }
  if (elapsed.totalHours > 0) {
    return `${elapsed.hours}h ${elapsed.minutes}m`;
  }
  if (elapsed.minutes > 0) {
    return `${elapsed.minutes}m ${elapsed.seconds}s`;
  }
  return `${elapsed.seconds}s`;
}

/**
 * Formata o tempo decorrido de forma detalhada (para contadores)
 */
export function formatElapsedTimeDetailed(elapsed: ElapsedTime): string {
  if (elapsed.totalDays > 0) {
    return `${elapsed.days}d ${elapsed.hours}h ${elapsed.minutes}m`;
  }
  if (elapsed.totalHours > 0) {
    return `${elapsed.hours}h ${elapsed.minutes}m ${elapsed.seconds}s`;
  }
  if (elapsed.minutes > 0) {
    return `${elapsed.minutes}m ${elapsed.seconds}s`;
  }
  return `${elapsed.seconds}s`;
}
