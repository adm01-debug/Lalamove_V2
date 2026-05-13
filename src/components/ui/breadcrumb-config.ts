import { Clock, Star, ExternalLink } from "lucide-react";
import type React from "react";

export interface BreadcrumbItem {
  label: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
  section?: string;
  description?: string;
}

export interface RecentPage {
  path: string;
  label: string;
  visitedAt: Date;
  count: number;
}

export interface FavoritePage {
  path: string;
  label: string;
  addedAt: Date;
}

export const routeLabels: Record<string, { label: string; description: string }> = {
  "": { label: "Dashboard", description: "Visão geral do sistema" },
  "dashboard": { label: "Dashboard", description: "Visão geral do sistema" },
  "dashboard-redesigned": { label: "Dashboard Novo", description: "Nova interface do dashboard" },
  "orders": { label: "Pedidos", description: "Gerenciamento de pedidos" },
  "drivers": { label: "Motoristas", description: "Gestão de motoristas" },
  "approvals": { label: "Aprovações", description: "Fila de aprovações pendentes" },
  "alerts": { label: "Alertas", description: "Central de alertas do sistema" },
  "incidents": { label: "Incidentes", description: "Registro de incidentes" },
  "evaluations": { label: "Avaliações", description: "Avaliações de motoristas" },
  "heatmap": { label: "Mapa de Calor", description: "Visualização geográfica" },
  "live-map": { label: "Mapa ao Vivo", description: "Rastreamento em tempo real" },
  "map": { label: "Mapa ao Vivo", description: "Rastreamento em tempo real" },
  "metrics": { label: "Métricas", description: "Indicadores de performance" },
  "delivery-metrics": { label: "Métricas de Entrega", description: "KPIs de entregas" },
  "sla": { label: "Dashboard SLA", description: "Monitoramento de SLA" },
  "reports": { label: "Relatórios", description: "Relatórios e exportações" },
  "notification-history": { label: "Histórico", description: "Histórico de notificações" },
  "alert-configurations": { label: "Config. Alertas", description: "Configurar alertas" },
  "settings": { label: "Configurações", description: "Configurações do sistema" },
  "bitrix24": { label: "Bitrix24", description: "Integração Bitrix24" },
  "webhooks": { label: "Webhooks", description: "Gerenciar webhooks" },
  "security": { label: "Segurança", description: "Central de segurança" },
  "permissions": { label: "Permissões", description: "Gerenciar permissões" },
  "roles": { label: "Papéis", description: "Gerenciar papéis" },
  "ip-whitelist": { label: "IP Whitelist", description: "Lista de IPs permitidos" },
  "geo-blocking": { label: "Geo Blocking", description: "Bloqueio geográfico" },
  "rate-limiting": { label: "Rate Limit", description: "Limites de requisição" },
  "password-reset-approvals": { label: "Reset Senha", description: "Aprovações de reset" },
  "system-health": { label: "Saúde", description: "Saúde do sistema" },
  "system-health-expanded": { label: "Saúde Detalhada", description: "Métricas detalhadas" },
  "cache-status": { label: "Cache", description: "Status do cache" },
  "cache-monitoring": { label: "Monit. Cache", description: "Monitoramento de cache" },
  "job-queue": { label: "Fila de Jobs", description: "Processamento em background" },
  "risk-rules": { label: "Regras de Risco", description: "Configurar regras de risco" },
};

export const sectionConfig: Record<string, { label: string; color: string }> = {
  "Principal": { label: "Principal", color: "bg-primary/10 text-primary" },
  "Operações": { label: "Operações", color: "bg-success/10 text-success" },
  "Notificações": { label: "Notificações", color: "bg-warning/10 text-warning" },
  "Analytics": { label: "Analytics", color: "bg-accent/10 text-accent" },
  "Integrações": { label: "Integrações", color: "bg-info/10 text-info" },
  "Segurança": { label: "Segurança", color: "bg-destructive/10 text-destructive" },
  "Sistema": { label: "Sistema", color: "bg-muted text-muted-foreground" },
};

export const routeToSection: Record<string, string> = {
  "dashboard": "Principal", "dashboard-redesigned": "Principal",
  "orders": "Operações", "drivers": "Operações", "approvals": "Operações", "incidents": "Operações", "evaluations": "Operações",
  "alerts": "Notificações", "notification-history": "Notificações", "alert-configurations": "Notificações",
  "heatmap": "Analytics", "live-map": "Analytics", "map": "Analytics", "metrics": "Analytics", "delivery-metrics": "Analytics", "sla": "Analytics", "reports": "Analytics",
  "bitrix24": "Integrações", "webhooks": "Integrações",
  "security": "Segurança", "permissions": "Segurança", "roles": "Segurança", "ip-whitelist": "Segurança", "geo-blocking": "Segurança", "rate-limiting": "Segurança", "password-reset-approvals": "Segurança",
  "system-health": "Sistema", "system-health-expanded": "Sistema", "cache-status": "Sistema", "cache-monitoring": "Sistema", "job-queue": "Sistema", "risk-rules": "Sistema", "settings": "Sistema",
};

export const pageQuickActions: Record<string, Array<{ label: string; path: string; icon: React.ComponentType<{ className?: string }> }>> = {
  "drivers": [{ label: "Aprovações Pendentes", path: "/approvals", icon: Clock }, { label: "Avaliações", path: "/evaluations", icon: Star }],
  "orders": [{ label: "Mapa ao Vivo", path: "/map", icon: ExternalLink }, { label: "Métricas", path: "/delivery-metrics", icon: ExternalLink }],
  "alerts": [{ label: "Configurar Alertas", path: "/alert-configurations", icon: ExternalLink }, { label: "Histórico", path: "/notification-history", icon: Clock }],
  "approvals": [{ label: "Motoristas", path: "/drivers", icon: ExternalLink }, { label: "Regras de Risco", path: "/risk-rules", icon: ExternalLink }],
};

const RECENT_PAGES_KEY = "smart-breadcrumbs-recent";
const FAVORITE_PAGES_KEY = "smart-breadcrumbs-favorites";
const MAX_RECENT_PAGES = 5;

export function getRecentPages(): RecentPage[] {
  try { const stored = localStorage.getItem(RECENT_PAGES_KEY); return stored ? JSON.parse(stored) : []; } catch { return []; }
}

export function saveRecentPage(path: string, label: string) {
  try {
    const recent = getRecentPages();
    const existing = recent.findIndex(p => p.path === path);
    if (existing !== -1) { recent[existing].visitedAt = new Date(); recent[existing].count++; } else { recent.unshift({ path, label, visitedAt: new Date(), count: 1 }); }
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_PAGES)));
  } catch { }
}

export function getFavoritePages(): FavoritePage[] {
  try { const stored = localStorage.getItem(FAVORITE_PAGES_KEY); return stored ? JSON.parse(stored) : []; } catch { return []; }
}

export function toggleFavoritePage(path: string, label: string): boolean {
  try {
    const favorites = getFavoritePages();
    const existing = favorites.findIndex(p => p.path === path);
    if (existing !== -1) { favorites.splice(existing, 1); localStorage.setItem(FAVORITE_PAGES_KEY, JSON.stringify(favorites)); return false; }
    else { favorites.push({ path, label, addedAt: new Date() }); localStorage.setItem(FAVORITE_PAGES_KEY, JSON.stringify(favorites)); return true; }
  } catch { return false; }
}

export function isFavorite(path: string): boolean {
  return getFavoritePages().some(p => p.path === path);
}
