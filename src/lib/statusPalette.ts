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

/** Triplets HSL de fallback (tema escuro) quando a variável CSS não está legível. */
const FALLBACK_TRIPLET: Record<StatusToken['token'], string> = {
  success: '142 71% 45%',
  warning: '38 92% 50%',
  destructive: '0 72% 51%',
  info: '199 89% 48%',
};

function readTokenTriplet(token: StatusToken['token']): string | null {
  if (typeof document === 'undefined') return null;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  return value.length > 0 ? value : null;
}

/**
 * Cor de status em formato aceito pelo Mapbox GL (`paint` properties).
 *
 * `statusColor()` devolve `hsl(var(--token))`, que apenas o CSS resolve; passar
 * essa string para `addLayer`/`setPaintProperty` faz o Mapbox rejeitar a camada
 * inteira ("Could not parse color from value"), deixando rota, rastro e geofence
 * invisíveis. Aqui lemos a variável computada no `:root` e montamos um `hsl()`
 * literal, preservando a paleta como fonte única de verdade.
 */
export function statusColorCss(level: StatusLevel, alpha = 1): string {
  const token = STATUS_PALETTE[level].token;
  const triplet = readTokenTriplet(token) ?? FALLBACK_TRIPLET[token];
  // O parser de cor do Mapbox (csscolorparser) só aceita a sintaxe legada, com
  // vírgulas: `hsl(142, 71%, 31%)`. A sintaxe moderna com espaços é rejeitada.
  const [h = '0', s = '0%', l = '0%'] = triplet.split(/\s+/);
  return alpha >= 1
    ? `hsl(${h}, ${s}, ${l})`
    : `hsla(${h}, ${s}, ${l}, ${alpha})`;
}

/**
 * Símbolo/forma distinta por nível de status — reforço color-blind-safe.
 *
 * Garante que a informação de status NÃO dependa apenas da cor: cada nível
 * possui uma forma inequívoca (círculo, pausa, triângulo de alerta, losango),
 * reconhecível por usuários com daltonismo (protanopia/deuteranopia/tritanopia).
 */
export const STATUS_GLYPH: Record<StatusLevel, string> = {
  operational: '●',
  attention: '‖',
  critical: '▲',
  info: '◆',
} as const;

/** Rótulo acessível curto por nível (para aria-label / title). */
export const STATUS_A11Y_LABEL: Record<StatusLevel, string> = {
  operational: 'Operacional (em rota)',
  attention: 'Atenção (parado)',
  critical: 'Crítico (fora de rota)',
  info: 'Informativo',
} as const;

export function statusGlyph(level: StatusLevel): string {
  return STATUS_GLYPH[level];
}
