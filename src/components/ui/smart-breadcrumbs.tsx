import { useLocation, Link, useNavigate } from "react-router-dom";
import { ChevronRight, Home, Star, Clock, MoreHorizontal, ArrowLeft, Bookmark, Copy, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState, useEffect, useMemo, forwardRef } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  routeLabels, sectionConfig, routeToSection, pageQuickActions,
  getRecentPages, saveRecentPage, getFavoritePages, toggleFavoritePage, isFavorite as checkIsFavorite,
  type BreadcrumbItem, type RecentPage, type FavoritePage,
} from "./breadcrumb-config";

interface SmartBreadcrumbsProps {
  className?: string;
  showQuickActions?: boolean;
  showFavorites?: boolean;
  showRecent?: boolean;
  compact?: boolean;
}

export function SmartBreadcrumbs({ className, showQuickActions = true, showFavorites = true, showRecent = true, compact = false }: SmartBreadcrumbsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const [favoritePages, setFavoritePages] = useState<FavoritePage[]>([]);
  const [isFav, setIsFav] = useState(false);

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const currentSegment = pathSegments[pathSegments.length - 1] || "dashboard";
  const currentPageInfo = routeLabels[currentSegment] || { label: currentSegment, description: "" };
  const currentSection = routeToSection[currentSegment];
  const sectionInfo = currentSection ? sectionConfig[currentSection] : null;
  const quickActions = pageQuickActions[currentSegment] || [];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentPages(getRecentPages()); setFavoritePages(getFavoritePages()); setIsFav(checkIsFavorite(location.pathname));
    const timer = setTimeout(() => { saveRecentPage(location.pathname, currentPageInfo.label); }, 1000);
    return () => clearTimeout(timer);
  }, [location.pathname, currentPageInfo.label]);

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ label: "Home", path: "/", icon: Home }];
    let currentPath = "";
    pathSegments.forEach((segment) => {
      currentPath += `/${segment}`;
      const info = routeLabels[segment] || { label: segment, description: "" };
      items.push({ label: info.label, path: currentPath, section: routeToSection[segment], description: info.description });
    });
    return items;
  }, [pathSegments]);

  const handleToggleFavorite = () => { const added = toggleFavoritePage(location.pathname, currentPageInfo.label); setIsFav(added); setFavoritePages(getFavoritePages()); toast.success(added ? "Página adicionada aos favoritos" : "Página removida dos favoritos"); };
  const handleCopyLink = () => { navigator.clipboard.writeText(window.location.href); toast.success("Link copiado!"); };
  const handleShare = async () => { if (navigator.share) { try { await navigator.share({ title: currentPageInfo.label, url: window.location.href }); } catch { } } else { handleCopyLink(); } };

  if (breadcrumbs.length <= 1) return null;

  if (compact) return <CompactBreadcrumbs breadcrumbs={breadcrumbs} sectionInfo={sectionInfo} isFav={isFav} onToggleFavorite={handleToggleFavorite} />;

  return (
    <motion.nav initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} aria-label="Navegação estrutural" className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-2">
        {sectionInfo && <Badge variant="outline" className={cn("text-xs font-medium", sectionInfo.color)}>{sectionInfo.label}</Badge>}
        <ol className="flex items-center gap-0.5 text-sm">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const Icon = item.icon;
            return (
              <motion.li key={item.path} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03, duration: 0.15 }} className="flex items-center">
                {index > 0 && <ChevronRight className="w-3.5 h-3.5 mx-1 text-muted-foreground/40" />}
                {isLast ? (
                  <Tooltip><TooltipTrigger asChild><span className="flex items-center gap-1.5 font-medium text-foreground px-2 py-1 rounded-md bg-primary/10">{Icon && <Icon className="w-3.5 h-3.5" />}{item.label}</span></TooltipTrigger>{item.description && <TooltipContent side="bottom"><p>{item.description}</p></TooltipContent>}</Tooltip>
                ) : (
                  <Link to={item.path} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-md transition-all duration-200 hover:bg-muted/50">{Icon && <Icon className="w-3.5 h-3.5" />}{item.label}</Link>
                )}
              </motion.li>
            );
          })}
        </ol>
        {showFavorites && <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleToggleFavorite}><Star className={cn("w-3.5 h-3.5", isFav && "fill-amber-400 text-amber-400")} /></Button></TooltipTrigger><TooltipContent side="bottom">{isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}</TooltipContent></Tooltip>}
      </div>
      <div className="flex items-center gap-1">
        {showQuickActions && quickActions.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 mr-2">
            {quickActions.slice(0, 2).map((action) => <Button key={action.path} variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => navigate(action.path)}><action.icon className="w-3 h-3" />{action.label}</Button>)}
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Mais navegação" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Ações da Página</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleCopyLink}><Copy className="w-4 h-4 mr-2" />Copiar Link</DropdownMenuItem>
            <DropdownMenuItem onClick={handleShare}><Share2 className="w-4 h-4 mr-2" />Compartilhar</DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleFavorite}><Bookmark className={cn("w-4 h-4 mr-2", isFav && "fill-current")} />{isFav ? "Remover Favorito" : "Adicionar Favorito"}</DropdownMenuItem>
            {showRecent && recentPages.length > 0 && <><DropdownMenuSeparator /><DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="w-3 h-3" />Páginas Recentes</DropdownMenuLabel>{recentPages.filter(p => p.path !== location.pathname).slice(0, 3).map((page) => <DropdownMenuItem key={page.path} onClick={() => navigate(page.path)}>{page.label}</DropdownMenuItem>)}</>}
            {showFavorites && favoritePages.length > 0 && <><DropdownMenuSeparator /><DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5"><Star className="w-3 h-3" />Favoritos</DropdownMenuLabel>{favoritePages.filter(p => p.path !== location.pathname).slice(0, 3).map((page) => <DropdownMenuItem key={page.path} onClick={() => navigate(page.path)}>{page.label}</DropdownMenuItem>)}</>}
            {quickActions.length > 0 && <><DropdownMenuSeparator /><DropdownMenuLabel className="text-xs text-muted-foreground">Ações Rápidas</DropdownMenuLabel>{quickActions.map((action) => <DropdownMenuItem key={action.path} onClick={() => navigate(action.path)}><action.icon className="w-4 h-4 mr-2" />{action.label}</DropdownMenuItem>)}</>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.nav>
  );
}

function CompactBreadcrumbs({ breadcrumbs, sectionInfo, isFav, onToggleFavorite }: { breadcrumbs: BreadcrumbItem[]; sectionInfo?: { label: string; color: string } | null; isFav: boolean; onToggleFavorite: () => void }) {
  const navigate = useNavigate();
  const currentPage = breadcrumbs[breadcrumbs.length - 1];
  const parentPage = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;
  return (
    <motion.nav initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {parentPage && <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => navigate(parentPage.path)}><ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">{parentPage.label}</span></Button>}
        {sectionInfo && <Badge variant="outline" className={cn("text-xs", sectionInfo.color)}>{sectionInfo.label}</Badge>}
        <span className="font-medium">{currentPage.label}</span>
      </div>
      <Button variant="ghost" size="icon" aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"} className="h-8 w-8" onClick={onToggleFavorite}><Star className={cn("w-4 h-4", isFav && "fill-amber-400 text-amber-400")} /></Button>
    </motion.nav>
  );
}

export const MobileBreadcrumbs = forwardRef<HTMLElement, { className?: string }>(function MobileBreadcrumbs({ className }, _ref) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathSegments = location.pathname.split("/").filter(Boolean);
  if (pathSegments.length === 0) return null;
  const currentSegment = pathSegments[pathSegments.length - 1];
  const currentPage = routeLabels[currentSegment]?.label || currentSegment;
  const currentSection = routeToSection[currentSegment];
  const sectionInfo = currentSection ? sectionConfig[currentSection] : null;
  const parentPath = pathSegments.length > 1 ? "/" + pathSegments.slice(0, -1).join("/") : "/";
  return (
    <motion.nav initial={{ opacity: 0 }} animate={{ opacity: 1 }} aria-label="Navegação" className={cn("flex items-center gap-2", className)}>
      <Button variant="ghost" size="icon" aria-label="Voltar" className="h-8 w-8 shrink-0" onClick={() => navigate(parentPath)}><ArrowLeft className="w-4 h-4" /></Button>
      {sectionInfo && <Badge variant="outline" className={cn("text-xs shrink-0", sectionInfo.color)}>{sectionInfo.label}</Badge>}
      <span className="font-medium truncate">{currentPage}</span>
    </motion.nav>
  );
});

export default SmartBreadcrumbs;
