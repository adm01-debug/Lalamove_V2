import { useState, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import { HighlightText } from '@/components/ui/highlight-match';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, Command, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  category: string;
  action?: () => void;
}

const shortcuts: KeyboardShortcut[] = [
  // Navigation
  { id: 'goto-dashboard', keys: ['g', 'd'], description: 'Ir para Dashboard', category: 'Navegação' },
  { id: 'goto-orders', keys: ['g', 'o'], description: 'Ir para Pedidos', category: 'Navegação' },
  { id: 'goto-drivers', keys: ['g', 'm'], description: 'Ir para Motoristas', category: 'Navegação' },
  { id: 'goto-approvals', keys: ['g', 'a'], description: 'Ir para Aprovações', category: 'Navegação' },
  { id: 'goto-alerts', keys: ['g', 'l'], description: 'Ir para Alertas', category: 'Navegação' },
  { id: 'goto-map', keys: ['g', 'p'], description: 'Ir para Mapa', category: 'Navegação' },
  { id: 'goto-settings', keys: ['g', 's'], description: 'Ir para Configurações', category: 'Navegação' },
  
  // Actions
  { id: 'open-search', keys: ['/', 'Ctrl+K'], description: 'Abrir busca global', category: 'Ações' },
  { id: 'toggle-theme', keys: ['Ctrl+Shift+T'], description: 'Alternar tema', category: 'Ações' },
  { id: 'refresh-data', keys: ['r'], description: 'Atualizar dados', category: 'Ações' },
  { id: 'show-shortcuts', keys: ['?', 'Ctrl+/'], description: 'Mostrar atalhos', category: 'Ações' },
  { id: 'escape', keys: ['Esc'], description: 'Fechar modal/menu', category: 'Ações' },
  
  // Approvals
  { id: 'approve-first', keys: ['a'], description: 'Aprovar primeiro da fila', category: 'Aprovações' },
  { id: 'reject-first', keys: ['x'], description: 'Rejeitar primeiro da fila', category: 'Aprovações' },
  { id: 'next-approval', keys: ['j', '↓'], description: 'Próxima aprovação', category: 'Aprovações' },
  { id: 'prev-approval', keys: ['k', '↑'], description: 'Aprovação anterior', category: 'Aprovações' },
  
  // Table
  { id: 'select-all', keys: ['Ctrl+A'], description: 'Selecionar todos', category: 'Tabela' },
  { id: 'export-data', keys: ['Ctrl+E'], description: 'Exportar dados', category: 'Tabela' },
  { id: 'filter-toggle', keys: ['f'], description: 'Abrir/fechar filtros', category: 'Tabela' },
];

const categoryOrder = ['Navegação', 'Ações', 'Aprovações', 'Tabela'];

export const KeyboardShortcutsHelp = forwardRef<HTMLDivElement>(function KeyboardShortcutsHelp(_props, _ref) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Open with ? or Ctrl+/
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === '?' || (e.ctrlKey && e.key === '/')) {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fuzzy search with Fuse.js - with match highlighting
  const shortcutSearchKeys = useMemo(() => ['description', 'category'], []);
  const shortcutSearchResults = useFuseSearchWithMatches(shortcuts, shortcutSearchKeys, search);
  const filteredShortcuts = search.trim() 
    ? shortcutSearchResults.map(r => ({ ...r.item, _matches: r.matches }))
    : shortcuts;

  const groupedShortcuts = categoryOrder.reduce((acc, category) => {
    const items = filteredShortcuts.filter(s => s.category === category);
    if (items.length > 0) {
      acc[category] = items;
    }
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <>
      {/* Floating help button */}
      <motion.button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-20 left-4 z-40 p-3 rounded-full",
          "bg-card/80 backdrop-blur-xl border border-border shadow-lg",
          "hover:bg-accent hover:scale-105 transition-all duration-200",
          "hidden md:flex items-center justify-center"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Atalhos de teclado (?)"
      >
        <Keyboard className="h-5 w-5 text-muted-foreground" />
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-primary" />
              Atalhos de Teclado
            </DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="px-6 py-3 border-b bg-muted/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atalhos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearch('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-[50vh]">
            <div className="p-6 space-y-6">
              <AnimatePresence mode="popLayout">
                {Object.entries(groupedShortcuts).map(([category, items]) => (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </h3>
                    <div className="grid gap-2">
                      {items.map((shortcut, index) => (
                        <motion.div
                          key={shortcut.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg",
                            "bg-muted/30 hover:bg-muted/50 transition-colors"
                          )}
                        >
                          <span className="text-sm">{shortcut.description}</span>
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, i) => (
                              <div key={i} className="flex items-center gap-1">
                                {i > 0 && (
                                  <span className="text-xs text-muted-foreground mx-1">ou</span>
                                )}
                                <KeyCombo keys={key} />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredShortcuts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Keyboard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum atalho encontrado</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pressione <KeyCombo keys="?" /> para abrir esta ajuda</span>
              <span>Pressione <KeyCombo keys="Esc" /> para fechar</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

interface KeyComboProps {
  keys: string;
  className?: string;
}

function KeyCombo({ keys, className }: KeyComboProps) {
  const parts = keys.split('+');
  
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {parts.map((part, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && <span className="text-muted-foreground mx-0.5 text-xs">+</span>}
          <kbd className={cn(
            "inline-flex items-center justify-center min-w-[24px] h-6 px-1.5",
            "text-xs font-mono font-medium",
            "bg-background border border-border rounded shadow-sm",
            "text-foreground"
          )}>
            {formatKey(part)}
          </kbd>
        </div>
      ))}
    </div>
  );
}

function formatKey(key: string): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  
  const keyMap: Record<string, string> = {
    'Ctrl': isMac ? '⌘' : 'Ctrl',
    'Alt': isMac ? '⌥' : 'Alt',
    'Shift': isMac ? '⇧' : 'Shift',
    'Enter': '↵',
    'Esc': 'Esc',
    'Tab': '⇥',
    'Backspace': '⌫',
    'Delete': '⌦',
    'Space': '␣',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
  };
  
  return keyMap[key] || key.toUpperCase();
}

// Hook to use keyboard shortcuts in components
export function useKeyboardShortcuts(
  shortcuts: { key: string; callback: () => void; ctrl?: boolean; shift?: boolean; alt?: boolean }[]
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.callback();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Export KeyCombo for use in other components
export { KeyCombo };
