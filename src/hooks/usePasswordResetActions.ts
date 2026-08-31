import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PasswordResetRequest {
  id: string;
  user_email: string;
  requested_at: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
}

export function usePasswordResetActions() {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (request: PasswordResetRequest) => {
      if (request.status !== "pending") {
        throw new Error("Esta solicitação já foi revisada.");
      }

      if (new Date(request.expires_at).getTime() <= Date.now()) {
        throw new Error("Esta solicitação expirou e não pode mais ser aprovada.");
      }

      const { error: updateError } = await supabase
        .from("password_reset_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", request.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .select("id")
        .single();
      if (updateError) throw updateError;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        request.user_email,
        { redirectTo: `${window.location.origin}/reset-password` }
      );
      if (resetError) throw resetError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["password-reset-requests"] });
      toast.success("Solicitação aprovada! Email de reset enviado.");
    },
    onError: (error: Error) => {
      toast.error("Erro ao aprovar: " + error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("password_reset_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          rejection_reason: reason,
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["password-reset-requests"] });
      toast.success("Solicitação rejeitada");
    },
    onError: (error: Error) => {
      toast.error("Erro ao rejeitar: " + error.message);
    },
  });

  return { approveMutation, rejectMutation };
}
