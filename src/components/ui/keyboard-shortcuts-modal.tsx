import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: KeyboardShortcut[] = [
  // Navegação Rápida
  { keys: ["Ctrl", "Space"], description: "Abrir/fechar menu de ações rápidas", category: "Ações Rápidas" },
  { keys: ["1", "-", "5"], description: "Selecionar ação quando menu aberto", category: "Ações Rápidas" },
  { keys: ["Esc"], description: "Fechar menu ou modal", category: "Ações Rápidas" },
  { keys: ["?"], description: "Abrir esta ajuda de atalhos", category: "Ações Rápidas" },
  
  // Go to pages (G + letter)
  { keys: ["G", "D"], description: "Ir para Dashboard", category: "Ir Para (G + Letra)" },
  { keys: ["G", "O"], description: "Ir para Pedidos (Orders)", category: "Ir Para (G + Letra)" },
  { keys: ["G", "M"], description: "Ir para Motoristas", category: "Ir Para (G + Letra)" },
  { keys: ["G", "A"], description: "Ir para Aprovações", category: "Ir Para (G + Letra)" },
  { keys: ["G", "L"], description: "Ir para Alertas", category: "Ir Para (G + Letra)" },
  { keys: ["G", "P"], description: "Ir para Mapa ao Vivo", category: "Ir Para (G + Letra)" },
  { keys: ["G", "R"], description: "Ir para Relatórios", category: "Ir Para (G + Letra)" },
  { keys: ["G", "I"], description: "Ir para Incidentes", category: "Ir Para (G + Letra)" },
  { keys: ["G", "S"], description: "Ir para Configurações", category: "Ir Para (G + Letra)" },
  
  // Busca Global
  { keys: ["Ctrl", "K"], description: "Abrir busca global", category: "Busca" },
  
  // Geral
  { keys: ["Tab"], description: "Navegar entre elementos", category: "Acessibilidade" },
  { keys: ["Enter"], description: "Ativar elemento focado", category: "Acessibilidade" },
  { keys: ["Space"], description: "Ativar botão focado", category: "Acessibilidade" },
];

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className={cn(
      "inline-flex items-center justify-center",
      "min-w-[24px] h-6 px-1.5",
      "text-xs font-mono font-semibold",
      "bg-muted border border-border rounded",
      "shadow-sm"
    )}>
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">⌨️</span>
            Atalhos de Teclado
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center">
                          {key === "-" ? (
                            <span className="text-muted-foreground mx-0.5">-</span>
                          ) : key === "+" ? (
                            <span className="text-muted-foreground mx-0.5">+</span>
                          ) : (
                            <KeyBadge>{key}</KeyBadge>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Pressione <KeyBadge>Esc</KeyBadge> ou clique fora para fechar
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
