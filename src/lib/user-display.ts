import type { User } from '@supabase/supabase-js';

/**
 * Retorna o nome de exibição do usuário.
 *
 * Ordem de prioridade:
 * 1. user_metadata.full_name
 * 2. user_metadata.name
 * 3. Fallback: parte do email antes do "@"
 *
 * Se nenhum dado estiver disponível, retorna null.
 */
export function getDisplayName(user: User | null | undefined): string | null {
  if (!user) return null;

  const metadata = user.user_metadata;
  const fullName = metadata?.full_name;
  const name = metadata?.name;

  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim();
  }

  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }

  if (user.email) {
    const localPart = user.email.split('@')[0];
    return localPart || null;
  }

  return null;
}

/**
 * Retorna as iniciais do nome de exibição para avatares.
 *
 * Suporta nomes completos (ex: "Abner Pereira" → "AP").
 * Se houver apenas uma palavra, retorna as 2 primeiras letras.
 */
export function getDisplayInitials(user: User | null | undefined): string {
  const name = getDisplayName(user);
  if (!name) return 'U';

  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
