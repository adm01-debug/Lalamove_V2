/**
 * Fonte de verdade única para papéis e hierarquia de acesso (item 48).
 *
 * Todas as camadas (roteamento, sidebar, gates de permissão) leem daqui para não
 * divergirem a ordem dos papéis. `roleHierarchy` é a ordem numérica usada nas
 * comparações "admin > manager > operator > viewer".
 */
export type AppRole = 'admin' | 'manager' | 'operator' | 'viewer';

export const ROLE_ORDER: AppRole[] = ['viewer', 'operator', 'manager', 'admin'];

export const roleHierarchy: Record<AppRole, number> = {
  viewer: 1,
  operator: 2,
  manager: 3,
  admin: 4,
};

/** Retorna o nível de um papel (0 para papéis desconhecidos/nulos). */
export function roleLevel(role: string | null | undefined): number {
  if (!role) return 0;
  return roleHierarchy[role as AppRole] ?? 0;
}

/** `true` se `role` atende (ou supera) o nível de `required`. */
export function meetsRole(role: string | null | undefined, required?: AppRole): boolean {
  if (!required) return true;
  return roleLevel(role) >= roleHierarchy[required];
}

/** `true` se o usuário tem o papel exato `role` ativo (ex.: `hasRole('admin')`). */
export function hasRole(userRoles: { role: AppRole; is_active: boolean }[] | null | undefined, role: AppRole): boolean {
  if (!userRoles) return false;
  return userRoles.some(r => r.role === role && r.is_active);
}

export function getRoleDisplayName(role: string | null | undefined) {
  switch (role) {
    case 'admin': return 'Administrador';
    case 'manager': return 'Gerente';
    case 'operator': return 'Operador';
    case 'viewer': return 'Visualizador';
    default: return 'Membro';
  }
}

export function getRoleColor(role: string | null | undefined) {
  switch (role) {
    case 'admin': return 'text-primary';
    case 'manager': return 'text-amber-500';
    case 'operator': return 'text-info';
    default: return 'text-muted-foreground';
  }
}
