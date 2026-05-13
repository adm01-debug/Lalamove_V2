import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Unlink, RefreshCw, CheckCircle2, XCircle, Clock, Settings, History, ArrowRightLeft, Play, Zap, Package } from "lucide-react";
import { useBitrix24 } from "@/hooks/useBitrix24";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StageMappingRow, LinkOrderRow } from "./bitrix24/Bitrix24SubComponents";

export default function Bitrix24Page() {
  const [domain, setDomain] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { connection, isLoadingConnection, stageMappings, syncHistory, unlinkedOrders, isLoadingUnlinkedOrders, isConnecting, connect, disconnect, updateStageMapping, linkOrder, isLinking } = useBitrix24();

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    try { const { data, error } = await supabase.functions.invoke("bitrix24-process-queue"); if (error) throw error; toast.success("Fila processada", { description: `${data.processed} sincronizações processadas, ${data.errors || 0} erros` }); }
    catch (error: unknown) { toast.error("Erro ao processar fila", { description: error instanceof Error ? error.message : "Erro desconhecido" }); }
    finally { setIsProcessing(false); }
  };

  const handleConnect = () => { if (!domain) return; connect(domain.replace("https://", "").replace("http://", "").replace("/", "")); };
  const formatDate = (date: string) => format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Integração Bitrix24</h1><p className="text-muted-foreground">Sincronize pedidos Lalamove com deals do Bitrix24</p></div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Status da Conexão</CardTitle></CardHeader>
        <CardContent>
          {isLoadingConnection ? <div className="flex items-center gap-2 text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Verificando conexão...</div>
          : connection?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><Badge variant="default" className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Conectado</Badge><span className="text-muted-foreground">{connection.domain}</span></div>
              {connection.expires_at && <p className="text-sm text-muted-foreground">Token expira em: {formatDate(connection.expires_at)}</p>}
              <Button variant="destructive" size="sm" onClick={() => disconnect()}><Unlink className="h-4 w-4 mr-2" />Desconectar</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Desconectado</Badge></div>
              <div className="flex gap-2 max-w-md"><div className="flex-1"><Label htmlFor="domain" className="sr-only">Domínio Bitrix24</Label><Input id="domain" placeholder="seudominio.bitrix24.com.br" value={domain} onChange={(e) => setDomain(e.target.value)} /></div><Button onClick={handleConnect} disabled={isConnecting || !domain}>{isConnecting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Conectando...</> : <><Link2 className="h-4 w-4 mr-2" />Conectar</>}</Button></div>
              <p className="text-xs text-muted-foreground">Configure BITRIX24_CLIENT_ID e BITRIX24_CLIENT_SECRET nos secrets do projeto.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="link" className="space-y-4">
        <TabsList>
          <TabsTrigger value="link" className="flex items-center gap-2"><Package className="h-4 w-4" />Vincular Pedidos</TabsTrigger>
          <TabsTrigger value="mappings" className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" />Mapeamento de Estágios</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2"><History className="h-4 w-4" />Histórico de Sincronização</TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2"><Settings className="h-4 w-4" />Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="link">
          <Card><CardHeader><CardTitle>Vincular Pedidos a Deals</CardTitle><CardDescription>Vincule pedidos Lalamove existentes a deals do Bitrix24 para sincronização</CardDescription></CardHeader>
            <CardContent>{isLoadingUnlinkedOrders ? <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div> : <Table><TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead><TableHead>Deal ID</TableHead><TableHead className="w-[100px]">Ação</TableHead></TableRow></TableHeader><TableBody>{unlinkedOrders?.map((order) => <LinkOrderRow key={order.id} order={order} onLink={linkOrder} isLinking={isLinking} isConnected={connection?.connected || false} />)}{!unlinkedOrders?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Todos os pedidos já estão vinculados ou não há pedidos</TableCell></TableRow>}</TableBody></Table>}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings">
          <Card><CardHeader><CardTitle>Mapeamento Status → Estágio</CardTitle><CardDescription>Configure qual estágio do Bitrix24 corresponde a cada status do Lalamove</CardDescription></CardHeader>
            <CardContent><Table><TableHeader><TableRow><TableHead>Status Lalamove</TableHead><TableHead>ID Estágio Bitrix</TableHead><TableHead>Nome do Estágio</TableHead><TableHead className="w-[100px]">Ações</TableHead></TableRow></TableHeader><TableBody>{stageMappings?.map((mapping) => <StageMappingRow key={mapping.id} mapping={mapping} onUpdate={updateStageMapping} />)}</TableBody></Table></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card><CardHeader><CardTitle>Histórico de Sincronização</CardTitle><CardDescription>Últimas 50 sincronizações realizadas</CardDescription></CardHeader>
            <CardContent><Table><TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Deal ID</TableHead><TableHead>Status</TableHead><TableHead>Última Sync</TableHead><TableHead>Erro</TableHead></TableRow></TableHeader><TableBody>{syncHistory?.map((sync) => <TableRow key={sync.id}><TableCell><div><p className="font-medium">{sync.lalamove_orders?.lalamove_id}</p><p className="text-xs text-muted-foreground">{sync.lalamove_orders?.customer_name}</p></div></TableCell><TableCell>{sync.deal_id}</TableCell><TableCell><Badge variant={sync.sync_status === "success" ? "default" : "destructive"}>{sync.sync_status === "success" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}{sync.sync_status}</Badge></TableCell><TableCell className="text-sm text-muted-foreground"><Clock className="h-3 w-3 inline mr-1" />{formatDate(sync.last_synced_at)}</TableCell><TableCell className="text-sm text-destructive max-w-[200px] truncate">{sync.last_error || "-"}</TableCell></TableRow>)}{!syncHistory?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma sincronização realizada ainda</TableCell></TableRow>}</TableBody></Table></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card><CardHeader><CardTitle>Configurações de Sincronização</CardTitle><CardDescription>Configure o comportamento da sincronização automática</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg"><h4 className="font-medium mb-2">Campos Sincronizados</h4><ul className="text-sm text-muted-foreground space-y-1"><li>• ID do Pedido Lalamove</li><li>• Endereços de coleta e entrega</li><li>• Tipo de veículo</li><li>• Custo total e moeda</li><li>• Status do pedido</li><li>• Nome e telefone do motorista</li><li>• Datas (agendamento, previsão, entrega real)</li><li>• Distância e link de rastreamento</li></ul></div>
              <div className="p-4 bg-muted/50 rounded-lg"><h4 className="font-medium mb-2">Ações Automáticas</h4><ul className="text-sm text-muted-foreground space-y-1"><li className="flex items-center gap-2"><Zap className="h-3 w-3 text-primary" />Sincronização automática quando status do pedido muda</li><li>• Atualização do estágio do deal conforme mapeamento</li><li>• Criação de atividade para cada mudança de status</li></ul></div>
              <div className="p-4 bg-muted/50 rounded-lg"><h4 className="font-medium mb-2">Processar Fila Manualmente</h4><p className="text-sm text-muted-foreground mb-3">Processa sincronizações pendentes imediatamente</p><Button onClick={handleProcessQueue} disabled={isProcessing || !connection?.connected} size="sm">{isProcessing ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Processando...</> : <><Play className="h-4 w-4 mr-2" />Processar Fila</>}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
