/**
 * Tradução das ações do gateway para as edges que realmente existem.
 *
 * Histórico: o gateway nasceu como encaminhador para um proxy externo
 * (`LALAMOVE_UNIFIED_PROXY_URL` / `LALAMOVE_UAPI_PROXY_URL`). Esses 4 secrets
 * nunca foram configurados na produção (13 secrets no projeto, nenhum
 * `LALAMOVE_*_PROXY_*`), então toda chamada morria em
 * `Configuração ausente para o destino` com HTTP 500 e as telas de
 * Configurações/status/carteira ficavam quebradas.
 *
 * Em vez de depender de um proxy que não existe, cada ação passa a ser
 * atendida pelas edges `lalamove-api` (REST v3, HMAC) e `lalamove-uapi`
 * (sessão logada do portal), que estão em produção e verificadas.
 *
 * Este módulo é puro de propósito: a tabela é testável sem rede.
 */

export type GatewayTarget = 'unified' | 'uapi';

export interface RoutedCall {
  /** edge de destino, como em supabase/functions/<fn> */
  fn: 'lalamove-api' | 'lalamove-uapi';
  /** action que a edge de destino entende */
  action: string;
  /** query string extra exigida pela edge de destino */
  query?: Record<string, string>;
  /** quando true, o corpo do chamador é repassado como está */
  passBody?: boolean;
}

/** Ação conhecida mas que não pode ser atendida sem o proxy externo. */
export interface UnsupportedCall {
  unsupported: true;
  reason: string;
}

export type RouteResult = RoutedCall | UnsupportedCall | null;

export function isUnsupported(r: RouteResult): r is UnsupportedCall {
  return !!r && (r as UnsupportedCall).unsupported === true;
}

/**
 * `params` do chamador vira query da edge de destino. Alguns nomes mudam
 * (`order_id` → `orderId`), porque as edges usam camelCase.
 */
const PARAM_ALIASES: Record<string, string> = {
  order_id: 'orderId',
  driver_id: 'driverId',
  quotation_id: 'quotationId',
  http_method: 'httpMethod',
};

export function translateParams(params: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v !== 'string') continue;
    out[PARAM_ALIASES[k] ?? k] = v;
  }
  return out;
}

/**
 * Resolve a ação do gateway. Devolve `null` quando a ação é desconhecida.
 */
export function routeAction(target: GatewayTarget, action: string): RouteResult {
  // As ações de UAPI são aceitas em qualquer target: o cliente do front
  // (src/lib/lalamove-api.ts) manda tudo como "unified".
  switch (action) {
    // ── saúde ────────────────────────────────────────────────────────────
    case 'status':
    case 'test':
      return { fn: 'lalamove-api', action: 'cities' };

    // ── REST v3 ──────────────────────────────────────────────────────────
    case 'cities':
      return { fn: 'lalamove-api', action: 'cities' };
    case 'quote':
      return { fn: 'lalamove-api', action: 'quotation', passBody: true };
    case 'order_create':
      return { fn: 'lalamove-api', action: 'order', passBody: true };
    case 'order_get':
      return { fn: 'lalamove-api', action: 'get-order' };
    case 'order_cancel':
      return { fn: 'lalamove-api', action: 'cancel', passBody: true };
    case 'order_priority':
      return { fn: 'lalamove-api', action: 'priority-fee', passBody: true };
    case 'driver_location':
      return { fn: 'lalamove-api', action: 'get-driver' };

    // ── UAPI (sessão logada do portal) ───────────────────────────────────
    case 'user':
      return { fn: 'lalamove-uapi', action: 'user-info' };
    case 'wallet':
      return { fn: 'lalamove-uapi', action: 'wallet-balance' };
    case 'wallet_flow_list':
      return { fn: 'lalamove-uapi', action: 'wallet-transactions' };
    case 'vehicles':
    case 'service_areas':
      // o portal devolve veículos e áreas de serviço na mesma resposta
      return { fn: 'lalamove-uapi', action: 'city-info' };
    case 'refresh_token':
      return { fn: 'lalamove-uapi', action: 'refresh-token' };
    case 'orders':
      // uapi-proxy.ts (getOrders) manda page/size por querystring, GET sem
      // corpo. A edge lalamove-uapi só lê paginação de `body` (list-orders
      // usa cursor `last_id`, não número de página) e GET chega com corpo
      // vazio — a 1ª página funciona, "carregar mais" ainda não avança.
      // Preferível a 400 total por ação não mapeada (painel ficava inoperante).
      return { fn: 'lalamove-uapi', action: 'list-orders', passBody: true };

    // ── passagem genérica: só o proxy externo sabia fazer ────────────────
    case 'v3':
      return {
        unsupported: true,
        reason:
          'Passagem genérica para a API v3 não está disponível sem o proxy externo. ' +
          'Use uma ação nomeada (cities, quote, order_create, order_get, order_cancel, ' +
          'order_priority, driver_location) ou chame a edge lalamove-api direto.',
      };
    case 'uapi':
    case 'call':
      return {
        unsupported: true,
        reason:
          'Passagem genérica para a UAPI não está disponível sem o proxy externo. ' +
          'Use uma ação nomeada (user, wallet, wallet_flow_list, vehicles, service_areas, orders) ' +
          'ou chame a edge lalamove-uapi direto.',
      };

    // ── escrita de credencial: nunca pelo gateway ───────────────────────
    case 'update_uapi_token':
    case 'update_token':
    case 'update_v3_keys':
      return {
        unsupported: true,
        reason:
          'Credenciais não são gravadas por requisição. Defina os secrets no projeto ' +
          '(supabase secrets set) ou no painel do Supabase.',
      };

    default:
      return null;
  }
}
