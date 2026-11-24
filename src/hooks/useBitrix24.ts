import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BITRIX24_CONNECTED, isTrustedBitrix24Origin } from "@/lib/postMessage";
import { parseEdgeError, formatEdgeError } from "@/lib/edge-error";

interface ConnectionStatus {
  connected: boolean;
  domain?: string;
  expires_at?: string;
}

interface StageMappingRow {
  id: string;
  lalamove_status: string;
  bitrix_stage_id: string;
  bitrix_stage_name: string | null;
  created_at: string;
}

interface SyncHistoryRow {
  id: string;
  order_id: string | null;
  deal_id: number;
  sync_status: string;
  last_synced_at: string;
  last_error: string | null;
  lalamove_orders: {
    lalamove_id: string;
    customer_name: string;
    status: string;
  } | null;
}

export function useBitrix24() {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  const connectionQuery = useQuery({
    queryKey: ["bitrix24-connection"],
    queryFn: async (): Promise<ConnectionStatus> => {
      const { data, error } = await supabase.functions.invoke("bitrix24-sync", {
        body: { action: "get_connection_status" },
      });
      if (error) throw error;
      return data;
    },
  });

  const stageMappingsQuery = useQuery({
    queryKey: ["bitrix24-stage-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bitrix24_stage_mappings")
        .select("*")
        .order("lalamove_status");
      if (error) throw error;
      return data as StageMappingRow[];
    },
  });

  const syncHistoryQuery = useQuery({
    queryKey: ["bitrix24-sync-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bitrix24_sync")
        .select("*, lalamove_orders(lalamove_id, customer_name, status)")
        .order("last_synced_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as SyncHistoryRow[];
    },
  });

  const unlinkedOrdersQuery = useQuery({
    queryKey: ["bitrix24-unlinked-orders"],
    queryFn: async () => {
      // Get orders that don't have a bitrix24_sync record and no bitrix24_deal_id
      const { data: linkedOrderIds } = await supabase
        .from("bitrix24_sync")
        .select("order_id");
      
      const linkedIds = linkedOrderIds?.map(r => r.order_id).filter(Boolean) || [];
      
      let query = supabase
        .from("lalamove_orders")
        .select("id, lalamove_id, customer_name, status, created_at, bitrix24_deal_id")
        .is("bitrix24_deal_id", null)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (linkedIds.length > 0) {
        query = query.not("id", "in", `(${linkedIds.join(",")})`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const connect = async (domain: string) => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bitrix24-sync", {
        body: { action: "get_auth_url", domain },
      });
      
      if (error) throw error;
      
      const popup = window.open(data.auth_url, "bitrix24_auth", "width=600,height=700");

      if (!popup) {
        setIsConnecting(false);
        toast.error("Não foi possível abrir a janela de autenticação. Permita pop-ups para continuar.");
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.data !== BITRIX24_CONNECTED) return;
        if (!isTrustedBitrix24Origin(event.origin, window.location.origin, import.meta.env.VITE_SUPABASE_URL)) return;
        queryClient.invalidateQueries({ queryKey: ["bitrix24-connection"] });
        toast.success("Bitrix24 conectado com sucesso!");
        window.removeEventListener("message", handleMessage);
        clearTimeout(timeoutId);
        setIsConnecting(false);
      };
      
      window.addEventListener("message", handleMessage);
      
      // Fallback timeout
      const timeoutId = setTimeout(() => {
        window.removeEventListener("message", handleMessage);
        setIsConnecting(false);
      }, 120000);
    } catch (error) {
      const edge = await parseEdgeError(error);
      toast.error("Erro ao conectar", {
        description: edge ? formatEdgeError(edge) : error instanceof Error ? error.message : 'Erro desconhecido',
      });
      setIsConnecting(false);
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("bitrix24-sync", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bitrix24-connection"] });
      toast.success("Bitrix24 desconectado");
    },
  });

  const syncOrderMutation = useMutation({
    mutationFn: async ({ orderId, dealId }: { orderId: string; dealId: number }) => {
      const { data, error } = await supabase.functions.invoke("bitrix24-sync", {
        body: { action: "sync_order", orderId, dealId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bitrix24-sync-history"] });
      toast.success("Pedido sincronizado com sucesso!");
    },
    onError: async (error: unknown) => {
      const edge = await parseEdgeError(error);
      const errorMessage = edge ? formatEdgeError(edge) : error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao sincronizar", {
        description: errorMessage,
      });
    },
  });

  const linkOrderMutation = useMutation({
    mutationFn: async ({ orderId, dealId }: { orderId: string; dealId: number }) => {
      // Update the order with the deal ID
      const { error: orderError } = await supabase
        .from("lalamove_orders")
        .update({ bitrix24_deal_id: dealId })
        .eq("id", orderId);
      
      if (orderError) throw orderError;

      // Create a sync record
      const { error: syncError } = await supabase
        .from("bitrix24_sync")
        .insert({
          order_id: orderId,
          deal_id: dealId,
          sync_status: "pending",
        });
      
      if (syncError) throw syncError;

      return { orderId, dealId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bitrix24-unlinked-orders"] });
      queryClient.invalidateQueries({ queryKey: ["bitrix24-sync-history"] });
      toast.success("Pedido vinculado com sucesso!");
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao vincular", { 
        description: errorMessage
      });
    },
  });

  const updateStageMappingMutation = useMutation({
    mutationFn: async ({ 
      lalamoveStatus, 
      bitrixStageId, 
      bitrixStageName 
    }: { 
      lalamoveStatus: string; 
      bitrixStageId: string; 
      bitrixStageName?: string;
    }) => {
      const { error } = await supabase
        .from("bitrix24_stage_mappings")
        .update({ 
          bitrix_stage_id: bitrixStageId, 
          bitrix_stage_name: bitrixStageName 
        })
        .eq("lalamove_status", lalamoveStatus);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bitrix24-stage-mappings"] });
      toast.success("Mapeamento atualizado");
    },
  });

  return {
    connection: connectionQuery.data,
    isLoadingConnection: connectionQuery.isLoading,
    connectionError: (connectionQuery.error as Error | null) ?? null,
    refetchConnection: connectionQuery.refetch,
    unlinkedOrdersError: (unlinkedOrdersQuery.error as Error | null) ?? null,
    stageMappings: stageMappingsQuery.data,
    syncHistory: syncHistoryQuery.data,
    unlinkedOrders: unlinkedOrdersQuery.data,
    isLoadingUnlinkedOrders: unlinkedOrdersQuery.isLoading,
    isConnecting,
    connect,
    disconnect: disconnectMutation.mutate,
    syncOrder: syncOrderMutation.mutate,
    isSyncing: syncOrderMutation.isPending,
    linkOrder: linkOrderMutation.mutate,
    isLinking: linkOrderMutation.isPending,
    updateStageMapping: updateStageMappingMutation.mutate,
    refetchUnlinkedOrders: unlinkedOrdersQuery.refetch,
  };
}
