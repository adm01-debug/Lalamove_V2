/**
 * Escala semântica única de status — fonte de verdade para mapa e alertas.
 *
 * Reduz a diversidade de cores garantindo que TODO indicador de status use
 * exatamente um dos quatro níveis abaixo, sempre via tokens semânticos
 * (nunca hex hard-coded), respeitando dark mode automaticamente.
 */
export type StatusLevel = 'operational' | 'attention' | 'critical' | 'info';

interface StatusToken {
  /** Token de cor semântico base (sem o prefixo de utilitário). */
  readonly token: 'success' | 'warning' | 'destructive' | 'info';
  /** Rótulo padrão em PT-BR. */
  readonly label: string;
  /** Classe de cor de texto. */
  readonly text: string;
  /** Classe de fundo suave. */
  readonly bg: string;
  /** Classe de borda. */
  readonly border: string;
  /** Classe utilitária de glow (definida em index.css). */
  readonly glow: string;
}

export const STATUS_PALETTE: Record<StatusLevel, StatusToken> = {
  operational: {
    token: 'success',
    label: 'Operacional',
    text: 'text-success',
    bg: 'bg-success/15',
    border: 'border-success/40',
    glow: 'glow-success',
  },
  attention: {
    token: 'warning',
    label: 'Parado',
    text: 'text-warning',
    bg: 'bg-warning/15',
    border: 'border-warning/40',
    glow: 'glow-warning',
  },
  critical: {
    token: 'destructive',
    label: 'Fora de Rota',
    text: 'text-destructive',
    bg: 'bg-destructive/15',
    border: 'border-destructive/40',
    glow: 'glow-destructive',
  },
  info: {
    token: 'info',
    label: 'Informativo',
    text: 'text-info',
    bg: 'bg-info/15',
    border: 'border-info/40',
    glow: 'glow-info',
  },
} as const;

/**
 * Retorna uma cor de status como `hsl(var(--token) / alpha)`, utilizável tanto
 * em classes quanto em estilos inline (ex.: marcadores Mapbox renderizados via
 * innerHTML). Mantém a escala semântica como fonte única, respeitando dark mode.
 */
export function statusColor(level: StatusLevel, alpha = 1): string {
  const token = STATUS_PALETTE[level].token;
  return alpha >= 1
    ? `hsl(var(--${token}))`
    : `hsl(var(--${token}) / ${alpha})`;
}
