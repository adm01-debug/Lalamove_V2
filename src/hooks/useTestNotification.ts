import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TestNotificationParams {
  channel: 'whatsapp' | 'email' | 'slack' | 'bitrix24' | 'n8n';
  alertType: string;
  recipients?: string[];
  webhookUrl?: string;
}

async function testNotification(params: TestNotificationParams): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke('test-notification', {
    body: params,
  });

  if (error) {
    throw new Error(error.message || 'Erro ao testar notificação');
  }

  return data;
}

export function useTestNotification() {
  return useMutation({
    mutationFn: testNotification,
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Teste enviado com sucesso!', {
          description: data.message,
        });
      } else {
        toast.warning('Teste executado', {
          description: data.message,
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao testar notificação', {
        description: error.message,
      });
    },
  });
}
