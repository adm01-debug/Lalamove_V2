import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DriverApproval } from '@/types';
import { toast } from 'sonner';
import { showUndoToast } from './useGlobalUndo';
import { logger } from '@/utils/logger';

export function useApprovalActions() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    queryClient.invalidateQueries({ queryKey: ['approval-history'] });
    queryClient.invalidateQueries({ queryKey: ['approval-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['drivers'] });
  };

  const optimisticRemove = async (approvalId: string) => {
    await queryClient.cancelQueries({ queryKey: ['pending-approvals'] });
    const previousApprovals = queryClient.getQueryData<DriverApproval[]>(['pending-approvals']);
    queryClient.setQueryData<DriverApproval[]>(['pending-approvals'], (old = []) => old.filter(a => a.id !== approvalId));
    return { previousApprovals };
  };

  const rollback = (context: { previousApprovals?: DriverApproval[] } | undefined) => {
    if (context?.previousApprovals) {
      queryClient.setQueryData(['pending-approvals'], context.previousApprovals);
    }
  };

  const approveMutation = useMutation({
    mutationFn: async ({ approvalId, driverId, notes }: { approvalId: string; driverId: string; notes?: string }) => {
      const { error: approvalError } = await supabase.from('driver_approval_queue')
        .update({ status: 'APPROVED', reviewed_at: new Date().toISOString(), decision_notes: notes || 'Aprovado manualmente' })
        .eq('id', approvalId);
      if (approvalError) throw approvalError;
      const { error: driverError } = await supabase.from('drivers').update({ status: 'APPROVED' }).eq('id', driverId);
      if (driverError) throw driverError;
      return { approvalId, driverId };
    },
    onMutate: ({ approvalId }) => optimisticRemove(approvalId),
    onSuccess: (data) => {
      invalidateAll();
      showUndoToast(`approve-${data.approvalId}`, 'Motorista aprovado com sucesso', async () => {
        await supabase.from('driver_approval_queue').update({ status: 'PENDING', reviewed_at: null, decision_notes: null }).eq('id', data.approvalId);
        await supabase.from('drivers').update({ status: 'PENDING_APPROVAL' }).eq('id', data.driverId);
        queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      });
    },
    onError: (error, _, context) => { rollback(context); logger.error('Error approving:', error); },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ approvalId, driverId, notes }: { approvalId: string; driverId: string; notes?: string }) => {
      const { error: approvalError } = await supabase.from('driver_approval_queue')
        .update({ status: 'REJECTED', reviewed_at: new Date().toISOString(), decision_notes: notes || 'Rejeitado manualmente' })
        .eq('id', approvalId);
      if (approvalError) throw approvalError;
      const { error: driverError } = await supabase.from('drivers').update({ status: 'BLOCKED' }).eq('id', driverId);
      if (driverError) throw driverError;
      return { approvalId, driverId };
    },
    onMutate: ({ approvalId }) => optimisticRemove(approvalId),
    onSuccess: (data) => {
      invalidateAll();
      showUndoToast(`reject-${data.approvalId}`, 'Motorista rejeitado', async () => {
        await supabase.from('driver_approval_queue').update({ status: 'PENDING', reviewed_at: null, decision_notes: null }).eq('id', data.approvalId);
        await supabase.from('drivers').update({ status: 'PENDING_APPROVAL' }).eq('id', data.driverId);
        queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      });
    },
    onError: (error, _, context) => { rollback(context); logger.error('Error rejecting:', error); },
  });

  const whitelistMutation = useMutation({
    mutationFn: async ({ approvalId, driverId }: { approvalId: string; driverId: string }) => {
      const { error: approvalError } = await supabase.from('driver_approval_queue')
        .update({ status: 'APPROVED', reviewed_at: new Date().toISOString(), decision_notes: 'Adicionado à whitelist' })
        .eq('id', approvalId);
      if (approvalError) throw approvalError;
      const { error: driverError } = await supabase.from('drivers')
        .update({ status: 'WHITELIST', whitelisted: true, blacklisted: false, risk_level: 'LOW', risk_score: 0 })
        .eq('id', driverId);
      if (driverError) throw driverError;
    },
    onSuccess: () => { invalidateAll(); toast.success('Motorista na Whitelist', { description: 'Aprovado automaticamente em pedidos futuros.' }); },
    onError: (error) => { logger.error('Error whitelisting:', error); toast.error('Falha ao adicionar à whitelist.'); },
  });

  const blacklistMutation = useMutation({
    mutationFn: async ({ approvalId, driverId, reason }: { approvalId: string; driverId: string; reason?: string }) => {
      const { error: approvalError } = await supabase.from('driver_approval_queue')
        .update({ status: 'REJECTED', reviewed_at: new Date().toISOString(), decision_notes: reason || 'Adicionado à blacklist' })
        .eq('id', approvalId);
      if (approvalError) throw approvalError;
      const { error: driverError } = await supabase.from('drivers')
        .update({ status: 'BLACKLIST', blacklisted: true, whitelisted: false, risk_level: 'CRITICAL', risk_score: 10, blacklist_reason: reason || 'Bloqueado manualmente' })
        .eq('id', driverId);
      if (driverError) throw driverError;
    },
    onSuccess: () => { invalidateAll(); toast.error('Motorista na Blacklist', { description: 'Motorista bloqueado permanentemente.' }); },
    onError: (error) => { logger.error('Error blacklisting:', error); toast.error('Falha ao adicionar à blacklist.'); },
  });

  return { approveMutation, rejectMutation, whitelistMutation, blacklistMutation };
}
