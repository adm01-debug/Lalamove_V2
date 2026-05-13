import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Clock, Star, Filter, Loader2, ArrowRight, Calendar, Tag, Command, Hash } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useGlobalSearch, PAGES, typeIcons, typeColors, typeLabels, type SearchResult, type SearchFilter } from "@/hooks/useGlobalSearch";

interface GlobalSearchAdvancedProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GlobalSearchAdvanced({ open, onOpenChange }: GlobalSearchAdvancedProps) {
  const {
    inputRef, query, setQuery, isLoading, activeTab, setActiveTab, filters, setFilters,
    recentSearches, favorites, selectedIndex, showFilters, setShowFilters,
    effectiveOpen, setEffectiveOpen, displayResults, groupedResults, favoritePages,
    handleSelect, handleToggleFavorite, handleClearRecent,
  } = useGlobalSearch(open, onOpenChange);

  return (
    <Dialog open={effectiveOpen} onOpenChange={setEffectiveOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <Input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pedidos, motoristas, alertas..." className="border-0 bg-transparent focus-visible:ring-0 text-lg" />
            {isLoading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
            {query && !isLoading && <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setQuery("")}><X className="w-4 h-4" /></Button>}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-3 h-7">Tudo</TabsTrigger>
                <TabsTrigger value="order" className="text-xs px-3 h-7">Pedidos</TabsTrigger>
                <TabsTrigger value="driver" className="text-xs px-3 h-7">Motoristas</TabsTrigger>
                <TabsTrigger value="alert" className="text-xs px-3 h-7">Alertas</TabsTrigger>
                <TabsTrigger value="page" className="text-xs px-3 h-7">Páginas</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant={showFilters ? "secondary" : "ghost"} size="sm" className="gap-1.5" onClick={() => setShowFilters(!showFilters)}><Filter className="w-3.5 h-3.5" />Filtros</Button>
          </div>
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-3 pt-3 mt-3 border-t border-border">
                  <Select value={filters.dateRange || "all"} onValueChange={(value) => setFilters({ ...filters, dateRange: value as SearchFilter["dateRange"] })}>
                    <SelectTrigger className="w-32 h-8 text-xs"><Calendar className="w-3 h-3 mr-1" /><SelectValue placeholder="Período" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="today">Hoje</SelectItem><SelectItem value="week">Esta semana</SelectItem><SelectItem value="month">Este mês</SelectItem></SelectContent>
                  </Select>
                  <Select value={filters.status || "all"} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                    <SelectTrigger className="w-32 h-8 text-xs"><Tag className="w-3 h-3 mr-1" /><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Ativos</SelectItem><SelectItem value="pending">Pendentes</SelectItem><SelectItem value="completed">Concluídos</SelectItem></SelectContent>
                  </Select>
                  {(filters.dateRange || filters.status) && <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFilters({})}>Limpar filtros</Button>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-2">
            {!query && (
              <div className="space-y-4">
                {favoritePages.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground"><Star className="w-3 h-3" />Favoritos</div>
                    {favoritePages.map((page, idx) => <ResultItem key={page.id} result={page} isSelected={selectedIndex === idx} isFavorite onSelect={() => handleSelect(page)} onToggleFavorite={() => handleToggleFavorite(page.id)} />)}
                  </div>
                )}
                {recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Clock className="w-3 h-3" />Recentes</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleClearRecent}>Limpar</Button>
                    </div>
                    {recentSearches.slice(0, 5).map((search, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => setQuery(search.query)}>
                        <Clock className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{search.query}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground"><Hash className="w-3 h-3" />Acesso Rápido</div>
                  {PAGES.slice(0, 6).map((page, idx) => <ResultItem key={page.id} result={page} isSelected={!query && selectedIndex === idx + favoritePages.length} isFavorite={favorites.includes(page.id)} onSelect={() => handleSelect(page)} onToggleFavorite={() => handleToggleFavorite(page.id)} />)}
                </div>
              </div>
            )}
            {query && displayResults.length === 0 && !isLoading && (
              <div className="py-12 text-center"><Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">Nenhum resultado para "{query}"</p></div>
            )}
            {query && Object.keys(groupedResults).length > 0 && (
              <div className="space-y-3">
                {Object.entries(groupedResults).map(([type, items]) => (
                  <div key={type}>
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">{typeIcons[type]}{typeLabels[type]}s ({items.length})</div>
                    {items.map((result) => { const flatIndex = displayResults.indexOf(result); return <ResultItem key={result.id} result={result} isSelected={selectedIndex === flatIndex} isFavorite={favorites.includes(result.id)} onSelect={() => handleSelect(result)} onToggleFavorite={() => handleToggleFavorite(result.id)} />; })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">↑↓</kbd>Navegar</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">↵</kbd>Selecionar</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">esc</kbd>Fechar</span>
          </div>
          <div className="flex items-center gap-1"><Command className="w-3 h-3" /><span>K para abrir</span></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultItem({ result, isSelected, isFavorite, onSelect, onToggleFavorite }: { result: SearchResult; isSelected: boolean; isFavorite: boolean; onSelect: () => void; onToggleFavorite: () => void }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors group", isSelected ? "bg-primary/10" : "hover:bg-muted/50")} onClick={onSelect}>
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", typeColors[result.type])}>{result.icon || typeIcons[result.type]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2"><span className="font-medium text-sm truncate">{result.title}</span>{result.meta && <Badge variant="outline" className="text-[10px] shrink-0">{result.meta}</Badge>}</div>
        {result.subtitle && <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}><Star className={cn("w-3.5 h-3.5", isFavorite && "fill-amber-400 text-amber-400")} /></Button>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
}

export default GlobalSearchAdvanced;
