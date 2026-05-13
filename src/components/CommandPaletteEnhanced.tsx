import { forwardRef, useCallback } from 'react';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { Package, Users, Bell, Shield, Search, Star, Clock, X, Zap, Loader2, ArrowRight, Command, Keyboard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useCommandPaletteSearch, removeRecentSearch, toggleFavorite,
  type SearchResult,
} from '@/hooks/useCommandPaletteSearch';

const getResultIcon = (type: SearchResult['type']) => {
  switch (type) {
    case 'order': return Package;
    case 'driver': return Users;
    case 'alert': return Bell;
    case 'approval': return Shield;
  }
};

const getResultColor = (type: SearchResult['type']) => {
  switch (type) {
    case 'order': return 'text-info';
    case 'driver': return 'text-success';
    case 'alert': return 'text-warning';
    case 'approval': return 'text-accent';
  }
};

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'main': return 'Principal';
    case 'operations': return 'Operações';
    case 'analytics': return 'Analytics';
    case 'security': return 'Segurança';
    case 'settings': return 'Sistema';
    default: return category;
  }
};

export const CommandPaletteEnhanced = forwardRef<HTMLDivElement>(function CommandPaletteEnhanced(_props, _ref) {
  const {
    open, setOpen, query, setQuery, isSearching, searchResults, recentSearches, setRecentSearches,
    favorites, setFavorites, navigateTo, handleSelectResult, quickActions, groupedNavigation,
    favoriteItems, location, user,
  } = useCommandPaletteSearch();

  const handleRecentSearchClick = useCallback((q: string) => setQuery(q), [setQuery]);
  const handleRemoveRecentSearch = useCallback((e: React.MouseEvent, q: string) => {
    e.stopPropagation();
    setRecentSearches(removeRecentSearch(q));
  }, [setRecentSearches]);
  const handleToggleFavorite = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setFavorites(toggleFavorite(path));
  }, [setFavorites]);

  const hasSearchQuery = query.length >= 2;
  const showSearchResults = hasSearchQuery && searchResults.length > 0;
  const showNoResults = hasSearchQuery && !isSearching && searchResults.length === 0;
  const showRecentSearches = !hasSearchQuery && recentSearches.length > 0;
  const showFavorites = !hasSearchQuery && favoriteItems.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center border-b px-3 py-2 bg-muted/30">
        <Command className="h-4 w-4 mr-2 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Command Palette</span>
        <div className="ml-auto flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded">⌘</kbd>
          <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded">K</kbd>
        </div>
      </div>

      <CommandInput placeholder="Buscar pedidos, motoristas, alertas ou navegar..." value={query} onValueChange={setQuery} className="border-0" />

      <CommandList className="max-h-[400px]">
        {isSearching && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
          </div>
        )}

        {showNoResults && (
          <CommandEmpty className="py-6">
            <div className="flex flex-col items-center gap-2">
              <Search className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum resultado para "{query}"</p>
              <p className="text-xs text-muted-foreground/70">Tente buscar por outro termo</p>
            </div>
          </CommandEmpty>
        )}

        {showFavorites && (
          <>
            <CommandGroup heading={<span className="flex items-center gap-2"><Star className="h-3 w-3 text-warning" />Favoritos</span>}>
              {favoriteItems.map(item => (
                <CommandItem key={`fav-${item.id}`} value={`fav-${item.id}-${item.label}`} onSelect={() => navigateTo(item.path)} className="cursor-pointer group">
                  <item.icon className="mr-2 h-4 w-4 text-amber-500" /><span className="flex-1">{item.label}</span>
                  {item.shortcut && <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.shortcut}</kbd>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {showRecentSearches && (
          <>
            <CommandGroup heading={<span className="flex items-center gap-2"><Clock className="h-3 w-3" />Buscas Recentes</span>}>
              {recentSearches.map(recent => (
                <CommandItem key={recent.timestamp} value={`recent-${recent.query}`} onSelect={() => handleRecentSearchClick(recent.query)} className="cursor-pointer group">
                  <Search className="mr-2 h-4 w-4 text-muted-foreground" /><span className="flex-1">{recent.query}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleRemoveRecentSearch(e, recent.query)}><X className="h-3 w-3" /></Button>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {showSearchResults && !isSearching && (
          <>
            {['order', 'driver', 'alert', 'approval'].map(type => {
              const typeResults = searchResults.filter(r => r.type === type);
              if (typeResults.length === 0) return null;
              const typeLabels: Record<string, string> = { order: 'Pedidos', driver: 'Motoristas', alert: 'Alertas', approval: 'Aprovações' };
              return (
                <CommandGroup key={type} heading={typeLabels[type]}>
                  {typeResults.map(result => {
                    const Icon = getResultIcon(result.type);
                    return (
                      <CommandItem key={result.id} value={`${result.type}-${result.id}-${result.title}`} onSelect={() => handleSelectResult(result.path, query)} className="cursor-pointer">
                        <Icon className={cn("mr-2 h-4 w-4", getResultColor(result.type))} />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="truncate font-medium">{result.title}</span>
                          {result.subtitle && <span className="text-xs text-muted-foreground truncate">{result.subtitle}</span>}
                        </div>
                        {result.badge && <Badge variant={result.badge.variant} className="ml-2 text-[10px]">{result.badge.label}</Badge>}
                        <ArrowRight className="ml-2 h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
            <CommandSeparator />
          </>
        )}

        {!hasSearchQuery && (
          <>
            <CommandGroup heading={<span className="flex items-center gap-2"><Zap className="h-3 w-3 text-primary" />Ações Rápidas</span>}>
              {quickActions.map(action => (
                <CommandItem key={action.id} value={`action-${action.id}-${action.label}`} onSelect={action.action} className="cursor-pointer">
                  <action.icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col flex-1"><span>{action.label}</span>{action.description && <span className="text-xs text-muted-foreground">{action.description}</span>}</div>
                  {action.shortcut && <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{action.shortcut}</kbd>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {Object.entries(groupedNavigation).map(([category, items]) => {
          if (items.length === 0) return null;
          return (
            <CommandGroup key={category} heading={getCategoryLabel(category)}>
              {items.map(item => {
                const isCurrentPage = location.pathname === item.path;
                const isFavorite = favorites.includes(item.path);
                return (
                  <CommandItem key={item.id} value={`nav-${item.id}-${item.label} ${item.keywords?.join(' ') || ''}`} onSelect={() => navigateTo(item.path)} className={cn("cursor-pointer group", isCurrentPage && "bg-primary/10 text-primary")}>
                    <item.icon className={cn("mr-2 h-4 w-4", isCurrentPage && "text-primary")} />
                    <span className="flex-1">{item.label}</span>
                    <Button variant="ghost" size="icon" className={cn("h-5 w-5 transition-opacity", isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-100")} onClick={(e) => handleToggleFavorite(e, item.path)}>
                      <Star className={cn("h-3 w-3", isFavorite ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
                    </Button>
                    {item.shortcut && <kbd className="ml-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.shortcut}</kbd>}
                    {isCurrentPage && <Badge variant="outline" className="ml-1 text-[10px]">atual</Badge>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>

      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground bg-muted/30">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-background rounded text-[10px]">↑↓</kbd>navegar</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-background rounded text-[10px]">↵</kbd>selecionar</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-background rounded text-[10px]">esc</kbd>fechar</span>
        </div>
        {user && <span className="text-muted-foreground/70">{user.email}</span>}
      </div>
    </CommandDialog>
  );
});
