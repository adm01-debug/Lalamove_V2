/**
 * Renovação automática da sessão UAPI.
 *
 * O `refresh_token` é o único caminho de renovação sem navegador: o gateway
 * recusa chamada server-side (`ret 10010 "Gateway signature error"`), então
 * quem renova de fato é o coletor, dentro da página — e ele também depende
 * desse mesmo valor. Sessão sem `refresh_token` só sobrevive enquanto o perfil
 * do navegador durar; depois disso carteira, extrato, cupons e frota param até
 * um login manual.
 */
export const REFRESH_TOKEN_MIN_LENGTH = 16;

export function hasUsableRefreshToken(refreshToken: string | null | undefined): boolean {
  return (refreshToken ?? '').trim().length >= REFRESH_TOKEN_MIN_LENGTH;
}