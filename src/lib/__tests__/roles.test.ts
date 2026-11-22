import { describe, expect, it } from 'vitest';
import { roleHierarchy, roleLevel, meetsRole, hasRole, getRoleDisplayName, ROLE_ORDER } from '../roles';

describe('roleHierarchy', () => {
  it('admin > manager > operator > viewer', () => {
    expect(roleHierarchy.admin).toBeGreaterThan(roleHierarchy.manager);
    expect(roleHierarchy.manager).toBeGreaterThan(roleHierarchy.operator);
    expect(roleHierarchy.operator).toBeGreaterThan(roleHierarchy.viewer);
  });

  it('ROLE_ORDER é a sequência crescente dos papéis', () => {
    expect(ROLE_ORDER).toEqual(['viewer', 'operator', 'manager', 'admin']);
  });
});

describe('roleLevel', () => {
  it('retorna 0 para papel nulo ou desconhecido', () => {
    expect(roleLevel(null)).toBe(0);
    expect(roleLevel(undefined)).toBe(0);
    expect(roleLevel('superadmin')).toBe(0);
  });

  it('retorna o nível do papel', () => {
    expect(roleLevel('admin')).toBe(4);
    expect(roleLevel('viewer')).toBe(1);
  });
});

describe('meetsRole', () => {
  it('sem required sempre libera', () => {
    expect(meetsRole('viewer', undefined)).toBe(true);
  });

  it('admin atende manager, mas manager não atende admin', () => {
    expect(meetsRole('admin', 'manager')).toBe(true);
    expect(meetsRole('manager', 'admin')).toBe(false);
  });

  it('operator não atende manager', () => {
    expect(meetsRole('operator', 'manager')).toBe(false);
  });
});

describe('hasRole', () => {
  it('true somente se o papel exato está ativo', () => {
    const roles = [
      { role: 'admin' as const, is_active: true },
      { role: 'viewer' as const, is_active: false },
    ];
    expect(hasRole(roles, 'admin')).toBe(true);
    expect(hasRole(roles, 'viewer')).toBe(false);
  });

  it('false para lista nula', () => {
    expect(hasRole(null, 'admin')).toBe(false);
  });
});

describe('getRoleDisplayName', () => {
  it('traduz cada papel', () => {
    expect(getRoleDisplayName('admin')).toBe('Administrador');
    expect(getRoleDisplayName('manager')).toBe('Gerente');
    expect(getRoleDisplayName('operator')).toBe('Operador');
    expect(getRoleDisplayName('viewer')).toBe('Visualizador');
    expect(getRoleDisplayName(null)).toBe('Membro');
  });
});
