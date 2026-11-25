// Parser e sanitizador dos relatorios de CSP (Content-Security-Policy).
//
// O navegador envia dois formatos:
//  - legado (header `report-uri`): { "csp-report": { "document-uri": ..., "violated-directive": ... } }
//  - Reporting API (`report-to`):  [ { "type": "csp-violation", "body": { ... } } ]
//
// Só os campos que interessam ao operador são mantidos. Documento vira apenas o
// caminho (query string pode conter dado sensível) e URI bloqueada vira host.

export const MAX_BODY_BYTES = 8192;
export const MAX_REPORTS = 5;

export interface CspSummary {
  directive: string;
  disposition: string;
  blocked: string;
  document: string;
}

const truncate = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

/** Host da URI bloqueada; esquemas sem host (`inline`, `data:`, `blob:`) ficam como estão. */
export function blockedOrigin(uri: unknown): string {
  const raw = truncate(uri, 200);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.host || url.protocol;
  } catch {
    return raw.slice(0, 60);
  }
}

/** Somente o caminho do documento — nunca query string nem origin completo. */
export function documentPath(uri: unknown): string {
  const raw = truncate(uri, 300);
  if (!raw) return "";
  try {
    return new URL(raw).pathname.slice(0, 120);
  } catch {
    return "";
  }
}

function normalize(body: Record<string, unknown>): CspSummary | null {
  const directive = truncate(
    body["effective-directive"] ?? body.effectiveDirective ??
      body["violated-directive"] ?? body.violatedDirective,
    80,
  );
  const blocked = blockedOrigin(body["blocked-uri"] ?? body.blockedURL ?? body.blockedURI);
  if (!directive && !blocked) return null;
  return {
    directive: directive || "desconhecida",
    disposition: truncate(body.disposition, 20) || "report",
    blocked: blocked || "n/a",
    document: documentPath(body["document-uri"] ?? body.documentURL ?? body.documentUrl),
  };
}

/** Extrai no máximo `limit` violações de um corpo de relatório (string JSON). */
export function summarize(body: string, limit = MAX_REPORTS): CspSummary[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }

  const out: CspSummary[] = [];
  const push = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const summary = normalize(raw as Record<string, unknown>);
    if (summary) out.push(summary);
  };

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (out.length >= limit) break;
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      if (record.type !== undefined && record.type !== "csp-violation") continue;
      push(record.body);
    }
  } else if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    push(record["csp-report"] ?? record.body ?? record);
  }

  return out.slice(0, limit);
}

/**
 * Limite por IP em memória do isolate. Não é um contador global (cada isolate tem
 * o seu), mas é suficiente para um endpoint de telemetria: o pior caso é receber
 * mais logs, nunca crescer armazenamento.
 */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (ip: string, now = Date.now()): boolean => {
    if (hits.size > 5000) hits.clear();
    const entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}