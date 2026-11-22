// Renderizador dos templates de alerta (etapa 67 do plano Google).
//
// `alert_configurations.message_template` guarda textos PT-BR com variáveis
// `{{nome}}` editáveis pelo operador na UI de configurações. Sem este módulo o
// texto do template era ignorado: o trigger `geo_evaluate_tracking` montava a
// mensagem com `format()` e o operador editava um campo sem efeito nenhum.
//
// Contrato: variável desconhecida é preservada como está (nunca vira "undefined"
// nem string vazia) para o operador enxergar o erro na mensagem recebida em vez
// de perder o aviso silenciosamente.

/** Placeholders documentados na etapa 67. */
export const TEMPLATE_VARS = [
  "pickup_contact_name",
  "delivery_contact_name",
  "driver_name",
  "driver_plate",
  "eta_min",
  "distance_m",
  "share_link",
  "order_ref",
  "pickup_address",
  "delivery_address",
  "static_map_url",
] as const;

export type TemplateVar = (typeof TEMPLATE_VARS)[number];

export type TemplateVars = Partial<Record<TemplateVar, string | number | null | undefined>>;

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  // Math.round em vez de toFixed: 1450/1000 = 1.45 e toFixed(1) devolve "1.4"
  // por representacao binaria — o operador recebia uma distancia otimista.
  const km = Math.round(distanceM / 100) / 10;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

/**
 * Substitui `{{var}}` pelos valores de `vars`.
 *
 * - valor ausente, `null`, `undefined` ou string vazia → placeholder preservado
 * - `distance_m` numérico é formatado em pt-BR (metros ou km)
 * - `eta_min` numérico sai arredondado
 * - sem espaços internos extras: `{{ driver_name }}` casa igual a `{{driver_name}}`
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  if (!template) return "";
  return template.replace(PLACEHOLDER, (match, rawName: string) => {
    const value = vars[rawName as TemplateVar];
    if (value === null || value === undefined || value === "") return match;
    if (rawName === "distance_m" && typeof value === "number") return formatDistance(value);
    if (rawName === "eta_min" && typeof value === "number") return String(Math.max(1, Math.round(value)));
    return String(value);
  });
}

/** Variáveis do template que ficaram sem valor — usado no log de envio. */
export function missingTemplateVars(template: string, vars: TemplateVars): string[] {
  const missing = new Set<string>();
  for (const m of template.matchAll(PLACEHOLDER)) {
    const name = m[1];
    const value = vars[name as TemplateVar];
    if (value === null || value === undefined || value === "") missing.add(name);
  }
  return [...missing];
}
