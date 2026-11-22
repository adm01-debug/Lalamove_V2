import { logger } from '@/utils/logger';
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Fuse from 'fuse.js';
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { buildOrIlike } from "@/lib/postgrest";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Package, User, AlertTriangle, CheckCircle, MapPin, TrendingUp, FileText, Settings,
} from "lucide-react";
import React from "react";

export interface SearchResult {
  id: string;
  type: "order" | "driver" | "alert" | "approval" | "page";
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: React.ReactNode;
  path?: string;
  data?: Record<string, unknown>;
  relevance?: number;
}

export interface SearchFilter {
  type?: string;
  status?: string;
  dateRange?: "today" | "week" | "month" | "all";
}

export interface RecentSearch {
  query: string;
  timestamp: Date;
  filters?: SearchFilter;
}

const STORAGE_KEY_RECENT = "global-search-recent-v2";
const STORAGE_KEY_FAVORITES = "global-search-favorites";
const MAX_RECENT = 10;

export const PAGES: SearchResult[] = [
  { id: "page-dashboard", type: "page", title: "Dashboard", subtitle: "Visão geral", path: "/", icon: React.createElement(TrendingUp, { className: "w-4 h-4" }) },
  { id: "page-orders", type: "page", title: "Pedidos", subtitle: "Gerenciar pedidos", path: "/orders", icon: React.createElement(Package, { className: "w-4 h-4" }) },
  { id: "page-drivers", type: "page", title: "Motoristas", subtitle: "Gestão de motoristas", path: "/drivers", icon: React.createElement(User, { className: "w-4 h-4" }) },
  { id: "page-approvals", type: "page", title: "Aprovações", subtitle: "Fila de aprovação", path: "/approvals", icon: React.createElement(CheckCircle, { className: "w-4 h-4" }) },
  { id: "page-alerts", type: "page", title: "Alertas", subtitle: "Central de alertas", path: "/alerts", icon: React.createElement(AlertTriangle, { className: "w-4 h-4" }) },
  { id: "page-map", type: "page", title: "Mapa ao Vivo", subtitle: "Rastreamento", path: "/map", icon: React.createElement(MapPin, { className: "w-4 h-4" }) },
  { id: "page-reports", type: "page", title: "Relatórios", subtitle: "Relatórios e exportações", path: "/reports", icon: React.createElement(FileText, { className: "w-4 h-4" }) },
  { id: "page-settings", type: "page", title: "Configurações", subtitle: "Configurações do sistema", path: "/settings", icon: React.createElement(Settings, { className: "w-4 h-4" }) },
];

export const typeIcons: Record<string, React.ReactNode> = {
  order: React.createElement(Package, { className: "w-4 h-4" }),
  driver: React.createElement(User, { className: "w-4 h-4" }),
  alert: React.createElement(AlertTriangle, { className: "w-4 h-4" }),
  approval: React.createElement(CheckCircle, { className: "w-4 h-4" }),
  page: React.createElement(FileText, { className: "w-4 h-4" }),
};

export const typeColors: Record<string, string> = {
  order: "bg-info/10 text-info",
  driver: "bg-success/10 text-success",
  alert: "bg-warning/10 text-warning",
  approval: "bg-accent/10 text-accent",
  page: "bg-muted text-muted-foreground",
};

export const typeLabels: Record<string, string> = {
  order: "Pedido", driver: "Motorista", alert: "Alerta", approval: "Aprovação", page: "Página",
};

function getRecentSearches(): RecentSearch[] {
  try { const stored = localStorage.getItem(STORAGE_KEY_RECENT); return stored ? JSON.parse(stored) : []; } catch { return []; }
}
function saveRecentSearch(query: string, filters?: SearchFilter) {
  try { const recent = getRecentSearches().filter(r => r.query !== query); recent.unshift({ query, timestamp: new Date(), filters }); localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(recent.slice(0, MAX_RECENT))); } catch {}
}
function clearRecentSearches() { localStorage.removeItem(STORAGE_KEY_RECENT); }
function getFavorites(): string[] {
  try { const stored = localStorage.getItem(STORAGE_KEY_FAVORITES); return stored ? JSON.parse(stored) : []; } catch { return []; }
}
function toggleFavoriteStorage(id: string): boolean {
  try { const favorites = getFavorites(); const idx = favorites.indexOf(id); if (idx !== -1) { favorites.splice(idx, 1); localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites)); return false; } else { favorites.push(id); localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites)); return true; } } catch { return false; }
}

export function useGlobalSearch(open?: boolean, onOpenChange?: (open: boolean) => void) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [filters, setFilters] = useState<SearchFilter>({});
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 300);
  const effectiveOpen = open ?? isOpen;
  const setEffectiveOpen = onOpenChange ?? setIsOpen;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (effectiveOpen) { setRecentSearches(getRecentSearches()); setFavorites(getFavorites()); setTimeout(() => inputRef.current?.focus(), 100); } }, [effectiveOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setEffectiveOpen(true); }
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as Element)?.tagName)) { e.preventDefault(); setEffectiveOpen(true); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setEffectiveOpen]);

  const searchDatabase = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) { setResults([]); return; }
    setIsLoading(true);
    const searchResults: SearchResult[] = [];
    try {
      if (activeTab === "all" || activeTab === "order") {
        const { data: orders, error } = await supabase.from("lalamove_orders").select("id, lalamove_id, customer_name, status, delivery_address, created_at").or(buildOrIlike(["lalamove_id", "customer_name", "delivery_address"], searchQuery)).limit(10);
        if (error) logger.error("Busca de pedidos falhou:", error);
        orders?.forEach(order => searchResults.push({ id: order.id, type: "order", title: `#${order.lalamove_id}`, subtitle: order.customer_name, meta: format(new Date(order.created_at), "dd MMM yyyy", { locale: ptBR }), path: `/orders?id=${order.id}`, data: order }));
      }
      if (activeTab === "all" || activeTab === "driver") {
        const { data: drivers, error } = await supabase.from("drivers").select("id, name, phone, status, risk_level, vehicle_plate").or(buildOrIlike(["name", "phone", "vehicle_plate"], searchQuery)).limit(10);
        if (error) logger.error("Busca de motoristas falhou:", error);
        drivers?.forEach(driver => searchResults.push({ id: driver.id, type: "driver", title: driver.name, subtitle: driver.phone || driver.vehicle_plate || undefined, meta: driver.risk_level || driver.status, path: `/drivers?id=${driver.id}`, data: driver }));
      }
      if (activeTab === "all" || activeTab === "alert") {
        const { data: alerts, error } = await supabase.from("alerts").select("id, title, message, severity, type, created_at").or(buildOrIlike(["title", "message"], searchQuery)).eq("is_dismissed", false).limit(10);
        if (error) logger.error("Busca de alertas falhou:", error);
        alerts?.forEach(alert => searchResults.push({ id: alert.id, type: "alert", title: alert.title, subtitle: alert.message, meta: alert.severity, path: `/alerts?id=${alert.id}`, data: alert }));
      }
      if (activeTab === "all" || activeTab === "approval") {
        const { data: approvals, error } = await supabase.from("driver_approval_queue").select("id, driver_name, order_id, status, risk_score, requested_at").or(buildOrIlike(["driver_name", "order_id"], searchQuery)).limit(10);
        if (error) logger.error("Busca de aprovações falhou:", error);
        approvals?.forEach(approval => searchResults.push({ id: approval.id, type: "approval", title: approval.driver_name || "Motorista", subtitle: `Pedido: ${approval.order_id.substring(0, 8)}...`, meta: `Risco: ${approval.risk_score}`, path: `/approvals?id=${approval.id}`, data: approval }));
      }
      if (activeTab === "all" || activeTab === "page") {
        const pageFuse = new Fuse(PAGES, { keys: ['title', 'subtitle'], threshold: 0.3, includeScore: true });
        searchResults.push(...pageFuse.search(searchQuery).map(r => r.item));
      }
      setResults(searchResults);
    } catch (error) { logger.error("Search error:", error); } finally { setIsLoading(false); }
  }, [activeTab]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { searchDatabase(debouncedQuery); }, [debouncedQuery, searchDatabase]);

  const handleSelect = useCallback((result: SearchResult) => {
    if (query) saveRecentSearch(query, filters);
    setEffectiveOpen(false);
    setQuery("");
    if (result.path) navigate(result.path);
  }, [query, filters, setEffectiveOpen, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!effectiveOpen) return;
      const displayResults = query ? results : [...PAGES.slice(0, 5)];
      switch (e.key) {
        case "ArrowDown": e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, displayResults.length - 1)); break;
        case "ArrowUp": e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, 0)); break;
        case "Enter": e.preventDefault(); if (displayResults[selectedIndex]) handleSelect(displayResults[selectedIndex]); break;
        case "Escape": setEffectiveOpen(false); break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [effectiveOpen, results, selectedIndex, query, handleSelect, setEffectiveOpen]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSelectedIndex(0); }, [results, query]);

  const handleToggleFavorite = useCallback((id: string) => { toggleFavoriteStorage(id); setFavorites(getFavorites()); }, []);
  const handleClearRecent = useCallback(() => { clearRecentSearches(); setRecentSearches([]); }, []);

  const displayResults = useMemo(() => query ? results : [], [query, results]);
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    displayResults.forEach(result => { if (!groups[result.type]) groups[result.type] = []; groups[result.type].push(result); });
    return groups;
  }, [displayResults]);
  const favoritePages = useMemo(() => PAGES.filter(p => favorites.includes(p.id)), [favorites]);

  return {
    inputRef, query, setQuery, isLoading, activeTab, setActiveTab, filters, setFilters,
    recentSearches, favorites, selectedIndex, showFilters, setShowFilters,
    effectiveOpen, setEffectiveOpen, displayResults, groupedResults, favoritePages,
    handleSelect, handleToggleFavorite, handleClearRecent,
  };
}
