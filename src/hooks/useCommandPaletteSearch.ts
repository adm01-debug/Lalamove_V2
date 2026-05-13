import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import {
import { logger } from '@/utils/logger';
  LayoutDashboard, Package, Users, Map, Bell, Settings,
  Shield, BarChart3, Truck, Flame, Activity, Scale,
  Webhook, Briefcase, AlertTriangle, History, ClipboardCheck,
  HardDrive, Globe, KeyRound, Moon, Sun, LogOut,
  RefreshCw, FileText, Keyboard,
} from 'lucide-react';

export interface SearchResult {
  id: string;
  type: 'order' | 'driver' | 'alert' | 'approval';
  title: string;
  subtitle?: string;
  badge?: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };
  path: string;
  timestamp?: string;
}

export interface RecentSearch {
  query: string;
  timestamp: number;
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  keywords?: string[];
  shortcut?: string;
  category: 'main' | 'operations' | 'analytics' | 'security' | 'settings';
  badge?: number;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
  shortcut?: string;
  category: 'navigation' | 'actions' | 'theme';
  description?: string;
}

const RECENT_SEARCHES_KEY = 'commandPalette:recentSearches';
const FAVORITES_KEY = 'commandPalette:favorites';
const MAX_RECENT_SEARCHES = 5;

export function getRecentSearches(): RecentSearch[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch { return []; }
}

export function saveRecentSearch(query: string): void {
  if (!query || query.length < 2) return;
  const recent = getRecentSearches();
  const filtered = recent.filter(s => s.query.toLowerCase() !== query.toLowerCase());
  const updated = [{ query, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)); } catch {}
}

export function removeRecentSearch(query: string): RecentSearch[] {
  const recent = getRecentSearches();
  const updated = recent.filter(s => s.query !== query);
  try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function getFavorites(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch { return []; }
}

export function toggleFavorite(path: string): string[] {
  const favorites = getFavorites();
  const updated = favorites.includes(path) ? favorites.filter(f => f !== path) : [...favorites, path];
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function useCommandPaletteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const debouncedQuery = useDebouncedValue(query, 300);

  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { theme, toggleTheme: themeToggle } = useTheme();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName))) {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setFavorites(getFavorites());
    }
  }, [open]);

  const navigateTo = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
    setQuery('');
  }, [navigate]);

  const handleSelectResult = useCallback((path: string, searchQuery?: string) => {
    if (searchQuery) saveRecentSearch(searchQuery);
    navigateTo(path);
  }, [navigateTo]);

  const handleToggleTheme = useCallback(() => { themeToggle(); setOpen(false); }, [themeToggle]);
  const handleSignOut = useCallback(async () => { await signOut(); setOpen(false); }, [signOut]);
  const handleRefreshPage = useCallback(() => { window.location.reload(); setOpen(false); }, []);

  const navigationItems: NavigationItem[] = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/', keywords: ['home', 'inicio', 'principal'], shortcut: 'G D', category: 'main' },
    { id: 'orders', label: 'Pedidos', icon: Package, path: '/orders', keywords: ['entregas', 'delivery', 'compras'], shortcut: 'G O', category: 'main' },
    { id: 'drivers', label: 'Motoristas', icon: Users, path: '/drivers', keywords: ['entregadores', 'condutores'], shortcut: 'G M', category: 'main' },
    { id: 'approvals', label: 'Aprovações', icon: Shield, path: '/approvals', keywords: ['pendentes', 'revisar', 'aprovar'], shortcut: 'G A', category: 'main' },
    { id: 'map', label: 'Mapa ao Vivo', icon: Map, path: '/map', keywords: ['rastreamento', 'tracking', 'localizacao', 'gps'], shortcut: 'G L', category: 'main' },
    { id: 'incidents', label: 'Incidentes', icon: AlertTriangle, path: '/incidents', keywords: ['problemas', 'ocorrencias', 'eventos'], category: 'operations' },
    { id: 'evaluations', label: 'Avaliações', icon: ClipboardCheck, path: '/evaluations', keywords: ['score', 'risco', 'nota'], category: 'operations' },
    { id: 'risk-rules', label: 'Regras de Risco', icon: Scale, path: '/risk-rules', keywords: ['configuracao', 'regras'], category: 'operations' },
    { id: 'metrics', label: 'Métricas', icon: BarChart3, path: '/metrics', keywords: ['graficos', 'estatisticas', 'dados'], category: 'analytics' },
    { id: 'delivery-metrics', label: 'Métricas de Entregas', icon: Truck, path: '/delivery-metrics', keywords: ['performance', 'kpi'], category: 'analytics' },
    { id: 'sla', label: 'Dashboard SLA', icon: Activity, path: '/sla', keywords: ['tempo', 'performance', 'acordo'], category: 'analytics' },
    { id: 'heatmap', label: 'Mapa de Calor', icon: Flame, path: '/heatmap', keywords: ['regioes', 'zonas', 'densidade'], category: 'analytics' },
    { id: 'reports', label: 'Relatórios', icon: FileText, path: '/reports', keywords: ['exportar', 'pdf', 'dados'], category: 'analytics' },
    { id: 'alerts', label: 'Alertas', icon: Bell, path: '/alerts', keywords: ['notificacoes', 'avisos'], category: 'operations' },
    { id: 'alert-config', label: 'Config. Alertas', icon: Bell, path: '/alert-configurations', keywords: ['configuracao', 'regras'], category: 'operations' },
    { id: 'notification-history', label: 'Histórico Notificações', icon: History, path: '/notification-history', keywords: ['log', 'historico'], category: 'operations' },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook, path: '/webhooks', keywords: ['api', 'eventos', 'integracao'], category: 'settings' },
    { id: 'bitrix24', label: 'Bitrix24', icon: Briefcase, path: '/bitrix24', keywords: ['crm', 'integracao'], category: 'settings' },
    { id: 'security', label: 'Central Segurança', icon: Shield, path: '/security', keywords: ['protecao', 'auditoria'], shortcut: 'G S', category: 'security' },
    { id: 'roles', label: 'Roles', icon: Users, path: '/roles', keywords: ['permissoes', 'usuarios', 'cargos'], category: 'security' },
    { id: 'permissions', label: 'Permissões', icon: Shield, path: '/permissions', keywords: ['acesso', 'controle'], category: 'security' },
    { id: 'ip-whitelist', label: 'IP Whitelist', icon: Shield, path: '/ip-whitelist', keywords: ['seguranca', 'bloqueio'], category: 'security' },
    { id: 'geo-blocking', label: 'Bloqueio Geográfico', icon: Globe, path: '/geo-blocking', keywords: ['pais', 'regiao', 'bloqueio'], category: 'security' },
    { id: 'password-reset', label: 'Reset de Senha', icon: KeyRound, path: '/password-reset-approvals', keywords: ['usuarios', 'senha'], category: 'security' },
    { id: 'cache-monitoring', label: 'Cache Monitor', icon: HardDrive, path: '/cache-monitoring', keywords: ['performance', 'sistema', 'memoria'], category: 'settings' },
    { id: 'system-health', label: 'Saúde do Sistema', icon: Activity, path: '/system-health', keywords: ['status', 'monitoramento'], category: 'settings' },
    { id: 'settings', label: 'Configurações', icon: Settings, path: '/settings', keywords: ['preferencias', 'conta'], shortcut: 'G ,', category: 'settings' },
  ], []);

  const quickActions: QuickAction[] = useMemo(() => [
    { id: 'toggle-theme', label: theme === 'dark' ? 'Modo Claro' : 'Modo Escuro', icon: theme === 'dark' ? Sun : Moon, action: handleToggleTheme, shortcut: 'T', category: 'theme', description: 'Alternar tema da interface' },
    { id: 'refresh', label: 'Atualizar Página', icon: RefreshCw, action: handleRefreshPage, shortcut: '⌘ R', category: 'actions', description: 'Recarregar a página atual' },
    { id: 'keyboard-shortcuts', label: 'Atalhos de Teclado', icon: Keyboard, action: () => { setOpen(false); document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })); }, shortcut: '?', category: 'actions', description: 'Ver todos os atalhos disponíveis' },
    { id: 'logout', label: 'Sair da Conta', icon: LogOut, action: handleSignOut, shortcut: '⌘ Q', category: 'actions', description: 'Encerrar sessão atual' },
  ], [theme, handleToggleTheme, handleRefreshPage, handleSignOut]);

  // Search database
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) { setSearchResults([]); return; }
    const searchDatabase = async () => {
      setIsSearching(true);
      const results: SearchResult[] = [];
      const searchTerm = `%${debouncedQuery}%`;
      try {
        const { data: orders } = await supabase.from('lalamove_orders').select('id, lalamove_id, customer_name, delivery_address, status, created_at').or(`customer_name.ilike.${searchTerm},lalamove_id.ilike.${searchTerm},delivery_address.ilike.${searchTerm}`).order('created_at', { ascending: false }).limit(5);
        orders?.forEach(order => results.push({ id: order.id, type: 'order', title: order.customer_name, subtitle: order.lalamove_id, badge: { label: order.status, variant: order.status === 'COMPLETED' ? 'default' : order.status === 'CANCELLED' ? 'destructive' : 'secondary' }, path: `/orders?highlight=${order.id}`, timestamp: order.created_at }));
        const { data: drivers } = await supabase.from('drivers').select('id, name, phone, vehicle_type, status, risk_level').or(`name.ilike.${searchTerm},phone.ilike.${searchTerm},vehicle_plate.ilike.${searchTerm}`).limit(5);
        drivers?.forEach(driver => results.push({ id: driver.id, type: 'driver', title: driver.name, subtitle: driver.phone || driver.vehicle_type, badge: { label: driver.risk_level || driver.status, variant: driver.status === 'BLOCKED' || driver.risk_level === 'HIGH' ? 'destructive' : driver.status === 'APPROVED' ? 'default' : 'secondary' }, path: `/drivers?highlight=${driver.id}` }));
        const { data: alerts } = await supabase.from('alerts').select('id, title, message, severity, type, created_at, is_read').or(`title.ilike.${searchTerm},message.ilike.${searchTerm}`).order('created_at', { ascending: false }).limit(5);
        alerts?.forEach(alert => results.push({ id: alert.id, type: 'alert', title: alert.title, subtitle: alert.message?.substring(0, 50), badge: { label: alert.severity, variant: alert.severity === 'CRITICAL' ? 'destructive' : alert.severity === 'WARNING' ? 'secondary' : 'outline' }, path: `/alerts?highlight=${alert.id}`, timestamp: alert.created_at }));
        const { data: approvals } = await supabase.from('driver_approval_queue').select('id, driver_name, driver_id, status, risk_score, requested_at').eq('status', 'PENDING').or(`driver_name.ilike.${searchTerm}`).limit(3);
        approvals?.forEach(approval => results.push({ id: approval.id, type: 'approval', title: approval.driver_name || 'Motorista', subtitle: `Risco: ${approval.risk_score}`, badge: { label: 'PENDENTE', variant: 'secondary' }, path: `/approvals?highlight=${approval.id}`, timestamp: approval.requested_at }));
        setSearchResults(results);
      } catch (error) { logger.error('Search error:', error); } finally { setIsSearching(false); }
    };
    searchDatabase();
  }, [debouncedQuery]);

  useEffect(() => { if (!open) { setQuery(''); setSearchResults([]); } }, [open]);

  const navSearchKeys = useMemo(() => ['label', 'keywords'], []);
  const navSearchResults = useFuseSearchWithMatches(navigationItems, navSearchKeys, query);
  const filteredNavigation = query.trim() ? navSearchResults.map(r => ({ ...r.item, _matches: r.matches })) : navigationItems;

  const groupedNavigation = useMemo(() => {
    const groups: Record<string, NavigationItem[]> = { main: [], operations: [], analytics: [], security: [], settings: [] };
    filteredNavigation.forEach(item => { groups[item.category].push(item); });
    return groups;
  }, [filteredNavigation]);

  const favoriteItems = useMemo(() => navigationItems.filter(item => favorites.includes(item.path)), [navigationItems, favorites]);

  return {
    open, setOpen, query, setQuery, isSearching, searchResults, recentSearches, setRecentSearches,
    favorites, setFavorites, navigateTo, handleSelectResult, quickActions, groupedNavigation,
    favoriteItems, navigationItems, location, user,
  };
}
