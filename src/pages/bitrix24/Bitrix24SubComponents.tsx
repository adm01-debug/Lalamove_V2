import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Link2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StageMapping {
  id: string;
  lalamove_status: string;
  bitrix_stage_id: string;
  bitrix_stage_name: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  PENDING: "Pendente", MATCHED: "Motorista Atribuído", ON_GOING: "Em Andamento",
  PICKED_UP: "Coletado", COMPLETED: "Concluído", CANCELLED: "Cancelado",
  REJECTED: "Rejeitado", EXPIRED: "Expirado",
};

export function StageMappingRow({ mapping, onUpdate }: {
  mapping: StageMapping;
  onUpdate: (params: { lalamoveStatus: string; bitrixStageId: string; bitrixStageName?: string }) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [stageId, setStageId] = useState(mapping.bitrix_stage_id);
  const [stageName, setStageName] = useState(mapping.bitrix_stage_name || "");

  const handleSave = () => { onUpdate({ lalamoveStatus: mapping.lalamove_status, bitrixStageId: stageId, bitrixStageName: stageName }); setIsEditing(false); };

  if (isEditing) {
    return (
      <TableRow>
        <TableCell><Badge variant="outline">{mapping.lalamove_status}</Badge><span className="ml-2 text-sm text-muted-foreground">{statusLabels[mapping.lalamove_status]}</span></TableCell>
        <TableCell><Input value={stageId} onChange={(e) => setStageId(e.target.value)} className="w-32" /></TableCell>
        <TableCell><Input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Nome do estágio" /></TableCell>
        <TableCell><div className="flex gap-1"><Button size="sm" onClick={handleSave}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button></div></TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell><Badge variant="outline">{mapping.lalamove_status}</Badge><span className="ml-2 text-sm text-muted-foreground">{statusLabels[mapping.lalamove_status]}</span></TableCell>
      <TableCell className="font-mono text-sm">{mapping.bitrix_stage_id}</TableCell>
      <TableCell>{mapping.bitrix_stage_name || "-"}</TableCell>
      <TableCell><Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>Editar</Button></TableCell>
    </TableRow>
  );
}

export function LinkOrderRow({ order, onLink, isLinking, isConnected }: {
  order: { id: string; lalamove_id: string; customer_name: string; status: string; created_at: string };
  onLink: (params: { orderId: string; dealId: number }) => void;
  isLinking: boolean;
  isConnected: boolean;
}) {
  const [dealId, setDealId] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleLink = () => { const id = parseInt(dealId, 10); if (!id || isNaN(id)) return; onLink({ orderId: order.id, dealId: id }); setIsEditing(false); setDealId(""); };
  const formatDate = (date: string) => format(new Date(date), "dd/MM/yyyy", { locale: ptBR });

  return (
    <TableRow>
      <TableCell className="font-medium">{order.lalamove_id}</TableCell>
      <TableCell>{order.customer_name}</TableCell>
      <TableCell><Badge variant="outline">{statusLabels[order.status] || order.status}</Badge></TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDate(order.created_at)}</TableCell>
      <TableCell>{isEditing ? <Input type="number" value={dealId} onChange={(e) => setDealId(e.target.value)} placeholder="ID do Deal" className="w-28" /> : <span className="text-muted-foreground">-</span>}</TableCell>
      <TableCell>
        {isEditing ? (
          <div className="flex gap-1"><Button size="sm" onClick={handleLink} disabled={!dealId || isLinking}>{isLinking ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Vincular"}</Button><Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>✕</Button></div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} disabled={!isConnected}><Link2 className="h-3 w-3 mr-1" />Vincular</Button>
        )}
      </TableCell>
    </TableRow>
  );
}
