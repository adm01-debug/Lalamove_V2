import * as React from "react";
import { toast } from "sonner";
import { Undo2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UndoableAction<T> {
  action: () => Promise<T>;
  undo: () => Promise<void>;
  description: string;
  undoTimeout?: number;
}

interface UndoToastOptions {
  title: string;
  description?: string;
  undoLabel?: string;
  duration?: number;
}

// Hook para ações com undo
export function useUndoableAction<T>() {
  const [isPending, setIsPending] = React.useState(false);
  const [canUndo, setCanUndo] = React.useState(false);
  const undoTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const undoFnRef = React.useRef<(() => Promise<void>) | null>(null);

  const execute = React.useCallback(async (
    { action, undo, description, undoTimeout = 5000 }: UndoableAction<T>,
    options?: UndoToastOptions
  ): Promise<T | null> => {
    setIsPending(true);
    setCanUndo(true);
    undoFnRef.current = undo;

    let result: T | null = null;
    let toastId: string | number = "";

    try {
      // Mostrar toast com opção de undo
      toastId = toast(
        <UndoToast
          title={options?.title || "Ação realizada"}
          description={options?.description || description}
          undoLabel={options?.undoLabel}
          onUndo={async () => {
            if (undoTimeoutRef.current) {
              clearTimeout(undoTimeoutRef.current);
            }
            
            setCanUndo(false);
            toast.dismiss(toastId);
            
            try {
              await undo();
              toast.success("Ação desfeita com sucesso!");
            } catch (error) {
              toast.error("Erro ao desfazer ação");
            }
          }}
          duration={options?.duration || undoTimeout}
        />,
        {
          duration: options?.duration || undoTimeout,
          className: "undo-toast",
        }
      );

      // Executar ação
      result = await action();

      // Timeout para remover opção de undo
      undoTimeoutRef.current = setTimeout(() => {
        setCanUndo(false);
        undoFnRef.current = null;
      }, undoTimeout);

    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Erro ao executar ação", {
        description: error instanceof Error ? error.message : "Tente novamente",
      });
      setCanUndo(false);
    } finally {
      setIsPending(false);
    }

    return result;
  }, []);

  const undoLastAction = React.useCallback(async () => {
    if (!canUndo || !undoFnRef.current) return;
    
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    try {
      await undoFnRef.current();
      setCanUndo(false);
      undoFnRef.current = null;
      toast.success("Ação desfeita!");
    } catch (error) {
      toast.error("Erro ao desfazer");
    }
  }, [canUndo]);

  // Limpar timeout ao desmontar
  React.useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  return {
    execute,
    undoLastAction,
    isPending,
    canUndo,
  };
}

// Componente do Toast com Undo
interface UndoToastProps {
  title: string;
  description?: string;
  undoLabel?: string;
  onUndo: () => void;
  duration: number;
}

function UndoToast({ title, description, undoLabel = "Desfazer", onUndo, duration }: UndoToastProps) {
  const [progress, setProgress] = React.useState(100);

  React.useEffect(() => {
    const interval = 50;
    const decrement = (100 / duration) * interval;
    
    const timer = setInterval(() => {
      setProgress(prev => Math.max(0, prev - decrement));
    }, interval);

    return () => clearInterval(timer);
  }, [duration]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">{title}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <button
          onClick={onUndo}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md",
            "text-xs font-medium text-primary",
            "bg-primary/10 hover:bg-primary/20",
            "transition-colors shrink-0"
          )}
        >
          <Undo2 className="w-3 h-3" />
          {undoLabel}
        </button>
      </div>
      
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// Hook para Optimistic Updates
interface OptimisticState<T> {
  data: T;
  isPending: boolean;
  error: Error | null;
}

export function useOptimisticUpdate<T>(initialData: T) {
  const [state, setState] = React.useState<OptimisticState<T>>({
    data: initialData,
    isPending: false,
    error: null,
  });
  
  const previousDataRef = React.useRef<T>(initialData);

  const update = React.useCallback(async (
    optimisticData: T,
    serverUpdate: () => Promise<T>
  ) => {
    // Salvar estado anterior
    previousDataRef.current = state.data;
    
    // Atualização otimista
    setState({
      data: optimisticData,
      isPending: true,
      error: null,
    });

    try {
      // Executar atualização no servidor
      const serverData = await serverUpdate();
      
      // Confirmar com dados do servidor
      setState({
        data: serverData,
        isPending: false,
        error: null,
      });
      
      return serverData;
    } catch (error) {
      // Rollback em caso de erro
      setState({
        data: previousDataRef.current,
        isPending: false,
        error: error instanceof Error ? error : new Error("Unknown error"),
      });
      
      throw error;
    }
  }, [state.data]);

  const rollback = React.useCallback(() => {
    setState({
      data: previousDataRef.current,
      isPending: false,
      error: null,
    });
  }, []);

  const setData = React.useCallback((data: T) => {
    previousDataRef.current = state.data;
    setState({
      data,
      isPending: false,
      error: null,
    });
  }, [state.data]);

  return {
    data: state.data,
    isPending: state.isPending,
    error: state.error,
    update,
    rollback,
    setData,
  };
}

// Hook para lista com optimistic updates
export function useOptimisticList<T extends { id: string }>(initialItems: T[]) {
  const { data: items, update, setData, isPending, error } = useOptimisticUpdate(initialItems);

  const addItem = React.useCallback(async (
    newItem: T,
    serverAdd: () => Promise<T>
  ) => {
    return update(
      [...items, newItem],
      async () => {
        const serverItem = await serverAdd();
        return [...items, serverItem];
      }
    );
  }, [items, update]);

  const removeItem = React.useCallback(async (
    itemId: string,
    serverRemove: () => Promise<void>
  ) => {
    const itemToRemove = items.find(item => item.id === itemId);
    if (!itemToRemove) return;

    return update(
      items.filter(item => item.id !== itemId),
      async () => {
        await serverRemove();
        return items.filter(item => item.id !== itemId);
      }
    );
  }, [items, update]);

  const updateItem = React.useCallback(async (
    itemId: string,
    updates: Partial<T>,
    serverUpdate: () => Promise<T>
  ) => {
    return update(
      items.map(item => item.id === itemId ? { ...item, ...updates } : item),
      async () => {
        const updatedItem = await serverUpdate();
        return items.map(item => item.id === itemId ? updatedItem : item);
      }
    );
  }, [items, update]);

  return {
    items,
    setItems: setData,
    addItem,
    removeItem,
    updateItem,
    isPending,
    error,
  };
}

// Toast helper functions
export const undoableToast = {
  success: (title: string, options?: { description?: string; onUndo?: () => void; duration?: number }) => {
    if (options?.onUndo) {
      return toast(
        <UndoToast
          title={title}
          description={options.description}
          onUndo={options.onUndo}
          duration={options.duration || 5000}
        />,
        { duration: options.duration || 5000 }
      );
    }
    return toast.success(title, { description: options?.description });
  },

  delete: (itemName: string, onUndo: () => void, duration = 5000) => {
    return toast(
      <UndoToast
        title={`${itemName} removido`}
        description="Clique em desfazer para restaurar"
        onUndo={onUndo}
        duration={duration}
      />,
      { duration }
    );
  },

  archive: (itemName: string, onUndo: () => void, duration = 5000) => {
    return toast(
      <UndoToast
        title={`${itemName} arquivado`}
        description="Clique em desfazer para restaurar"
        onUndo={onUndo}
        duration={duration}
      />,
      { duration }
    );
  },
};
