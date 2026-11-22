import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

export interface TrailPoint {
  latitude: number;
  longitude: number;
  created_at: string;
}

/** Pontos por pedido: acima disso a trilha deixa de ser legivel no mapa. */
const POINTS_PER_ORDER = 60;
const REFRESH_MS = 15_000;
/** Referencia estavel: devolver `{}` novo a cada render causaria loop no efeito. */
const EMPTY_TRAILS: Record<string, TrailPoint[]> = {};

/**
 * Etapa 77: trilha recente de cada motorista, lida de `tracking_events`.
 *
 * Consulta unica com `in(order_id, ...)` + corte por pedido no cliente, em vez de
 * um request por pedido: com 20 pedidos ao vivo a versao N+1 derrubaria o mapa.
 * Erro aqui nunca bloqueia o mapa — sem trilha, so a Polyline da rota aparece.
 */
export function useTrackingTrails(orderIds: string[]): Record<string, TrailPoint[]> {
  const [trails, setTrails] = useState<Record<string, TrailPoint[]>>({});
  // `join` evita refetch a cada render quando o array e recriado com o mesmo conteudo.
  const key = orderIds.join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    // Sem pedido no mapa nao ha o que buscar; o retorno abaixo ja devolve vazio.
    if (ids.length === 0) return;
    let cancelled = false;

    const fetchTrails = async () => {
      const { data, error } = await supabase
        .from('tracking_events')
        .select('order_id, latitude, longitude, created_at')
        .in('order_id', ids)
        .order('created_at', { ascending: false })
        .limit(ids.length * POINTS_PER_ORDER);

      if (cancelled) return;
      if (error) {
        logger.error('Error fetching tracking trails:', error);
        return;
      }

      const grouped: Record<string, TrailPoint[]> = {};
      for (const row of data ?? []) {
        const orderId = row.order_id;
        if (!orderId) continue;
        const point: TrailPoint = {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          created_at: row.created_at,
        };
        if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) continue;
        const list = grouped[orderId] ?? (grouped[orderId] = []);
        if (list.length < POINTS_PER_ORDER) list.push(point);
      }
      setTrails(grouped);
    };

    fetchTrails();
    const interval = setInterval(fetchTrails, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [key]);

  return key ? trails : EMPTY_TRAILS;
}
