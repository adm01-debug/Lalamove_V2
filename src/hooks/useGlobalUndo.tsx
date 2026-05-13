import { toast } from 'sonner';
import { Undo2, CheckCircle2 } from 'lucide-react';

interface UndoableAction {
  id: string;
  description: string;
  undoFn: () => Promise<void>;
  timeout: ReturnType<typeof setTimeout>;
  toastId: string | number;
}

// Simple store without zustand (to avoid adding dependency)
let pendingActionsMap = new Map<string, UndoableAction>();

export function showUndoToast(
  actionId: string,
  description: string,
  undoFn: () => Promise<void>,
  onConfirm?: () => void,
  timeoutMs: number = 5000
) {
  // Clear any existing action with same ID
  const existing = pendingActionsMap.get(actionId);
  if (existing) {
    clearTimeout(existing.timeout);
    toast.dismiss(existing.toastId);
  }

  const toastId = toast(
    <div className="flex items-center gap-3 w-full">
      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{description}</p>
        <p className="text-xs text-muted-foreground">Clique em Desfazer para reverter</p>
      </div>
      <button
        onClick={async () => {
          const action = pendingActionsMap.get(actionId);
          if (action) {
            clearTimeout(action.timeout);
            pendingActionsMap.delete(actionId);
            toast.dismiss(action.toastId);
            
            try {
              await undoFn();
              toast.success('Ação desfeita com sucesso!', {
                icon: <Undo2 className="w-4 h-4" />,
                duration: 2000,
              });
            } catch {
              toast.error('Erro ao desfazer ação');
            }
          }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <Undo2 className="w-4 h-4" />
        Desfazer
      </button>
    </div>,
    {
      duration: timeoutMs,
      className: 'undo-toast',
    }
  );

  const timeout = setTimeout(() => {
    pendingActionsMap.delete(actionId);
    onConfirm?.();
  }, timeoutMs);

  pendingActionsMap.set(actionId, {
    id: actionId,
    description,
    undoFn,
    timeout,
    toastId,
  });

  return {
    cancel: () => {
      const action = pendingActionsMap.get(actionId);
      if (action) {
        clearTimeout(action.timeout);
        toast.dismiss(action.toastId);
        pendingActionsMap.delete(actionId);
      }
    },
  };
}

// Hook for component usage
export function useGlobalUndo() {
  const showUndo = (
    actionId: string,
    description: string,
    undoFn: () => Promise<void>,
    onConfirm?: () => void,
    timeoutMs?: number
  ) => {
    return showUndoToast(actionId, description, undoFn, onConfirm, timeoutMs);
  };

  return { showUndo };
}
