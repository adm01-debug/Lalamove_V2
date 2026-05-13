import { useState, useEffect, useMemo } from "react";
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInputWithHelp } from '@/components/ui/search-help-tooltip';
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KeyRound, Check, X, Clock, Mail, Shield, AlertTriangle, Globe, Monitor, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePasswordResetActions, type PasswordResetRequest } from "@/hooks/usePasswordResetActions";

export function PasswordResetApprovalsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  const { approveMutation, rejectMutation } = usePasswordResetActions();

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["password-reset-requests", statusFilter],
    queryFn: async () => {
      let query = supabase.from("password_reset_requests").select("*").order("requested_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as PasswordResetRequest[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("password-reset-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "password_reset_requests" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const requestSearchKeys = useMemo(() => ['user_email', 'ip_address'], []);
  const requestSearchResults = useFuseSearchWithMatches(requests, requestSearchKeys, searchTerm);
  const filteredRequests = searchTerm.trim() ? requestSearchResults.map(r => ({ ...r.item, _matches: r.matches })) : requests;

  const stats = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { icon: typeof Clock; color: string; label: string }> = {
      pending: { icon: Clock, color: 'text-warning border-warning', label: 'Pendente' },
      approved: { icon: Check, color: 'text-success border-success', label: 'Aprovado' },
      rejected: { icon: X, color: 'text-destructive border-destructive', label: 'Rejeitado' },
    };
    const cfg = map[status];
    if (!cfg) return <Badge variant="outline">{status}</Badge>;
    return <Badge variant="outline" className={cfg.color}><cfg.icon className="h-3 w-3 mr-1" />{cfg.label}</Badge>;
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  const handleReject = () => {
    if (!selectedRequest) return;
    rejectMutation.mutate(
      { id: selectedRequest.id, reason: rejectionReason },
      {
        onSuccess: () => {
          setIsRejectDialogOpen(false);
          setRejectionReason("");
          setSelectedRequest(null);
        },
      }
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><KeyRound className="h-8 w-8 text-primary" />Aprovações de Reset de Senha</h1>
          <p className="text-muted-foreground mt-1">Gerencie solicitações de redefinição de senha</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {([
          { key: 'pending', label: 'Pendentes', icon: Clock, color: 'text-warning', ring: 'ring-warning', sub: 'Aguardando aprovação' },
          { key: 'approved', label: 'Aprovadas', icon: Check, color: 'text-success', ring: 'ring-success', sub: 'Email enviado' },
          { key: 'rejected', label: 'Rejeitadas', icon: X, color: 'text-destructive', ring: 'ring-destructive', sub: 'Negadas' },
        ] as const).map(s => (
          <Card key={s.key} className={`cursor-pointer transition-all ${statusFilter === s.key ? `ring-2 ${s.ring}` : ''}`} onClick={() => setStatusFilter(s.key)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${s.color}`}>{stats[s.key]}</div>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-4 pt-6">
          <div className="rounded-full bg-primary/10 p-3"><Shield className="h-6 w-6 text-primary" /></div>
          <div>
            <h3 className="font-semibold">Fluxo de Aprovação Ativo</h3>
            <p className="text-sm text-muted-foreground mt-1">Todas as solicitações de reset de senha precisam ser aprovadas por um administrador antes do email ser enviado.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div><CardTitle>Solicitações</CardTitle><CardDescription>{statusFilter === "all" ? "Todas" : `${statusFilter === "pending" ? "Pendentes" : statusFilter === "approved" ? "Aprovadas" : "Rejeitadas"}`}</CardDescription></div>
            <div className="flex gap-2">
              <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>Todas</Button>
              <div className="w-64"><SearchInputWithHelp value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por email ou IP..." /></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12"><KeyRound className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><h3 className="font-semibold text-lg">Nenhuma solicitação</h3></div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Email</TableHead><TableHead>Solicitado</TableHead><TableHead>IP / Dispositivo</TableHead>
                  <TableHead>Status</TableHead><TableHead>Expira</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{request.user_email}</span></div></TableCell>
                      <TableCell>
                        <div className="text-sm">{format(new Date(request.requested_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
                        <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(request.requested_at), { addSuffix: true, locale: ptBR })}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {request.ip_address && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Globe className="h-3 w-3" />{request.ip_address}</div>}
                          {request.user_agent && <div className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[200px]"><Monitor className="h-3 w-3" />{request.user_agent.substring(0, 40)}...</div>}
                        </div>
                      </TableCell>
                      <TableCell><div className="flex flex-col gap-1">{getStatusBadge(request.status)}{request.rejection_reason && <span className="text-xs text-destructive">{request.rejection_reason}</span>}</div></TableCell>
                      <TableCell>
                        {isExpired(request.expires_at) ? (
                          <Badge variant="outline" className="text-destructive border-destructive"><AlertTriangle className="h-3 w-3 mr-1" />Expirado</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(request.expires_at), { addSuffix: true, locale: ptBR })}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {request.status === "pending" && !isExpired(request.expires_at) && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="text-success hover:text-success" onClick={() => approveMutation.mutate(request)} disabled={approveMutation.isPending}><Check className="h-4 w-4 mr-1" />Aprovar</Button>
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setSelectedRequest(request); setIsRejectDialogOpen(true); }}><X className="h-4 w-4 mr-1" />Rejeitar</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar Solicitação</DialogTitle><DialogDescription>Informe o motivo da rejeição para {selectedRequest?.user_email}</DialogDescription></DialogHeader>
          <div className="py-4"><Textarea placeholder="Motivo da rejeição (opcional)" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>{rejectMutation.isPending ? "Rejeitando..." : "Rejeitar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PasswordResetApprovalsPage;
