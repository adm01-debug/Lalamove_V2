import { hasUsableRefreshToken, REFRESH_TOKEN_MIN_LENGTH } from "./session-renewal.ts";

function assertEq<T>(actual: T, expected: T, msg = ""): void {
  if (actual !== expected) {
    throw new Error(`${msg} esperado ${String(expected)}, recebido ${String(actual)}`);
  }
}

const token = (n: number) => "a".repeat(n);

Deno.test("refresh_token no tamanho mínimo é utilizável", () => {
  assertEq(hasUsableRefreshToken(token(REFRESH_TOKEN_MIN_LENGTH)), true);
});

Deno.test("refresh_token abaixo do mínimo não é utilizável", () => {
  assertEq(hasUsableRefreshToken(token(REFRESH_TOKEN_MIN_LENGTH - 1)), false);
});

Deno.test("refresh_token vazio, nulo ou ausente não é utilizável", () => {
  assertEq(hasUsableRefreshToken(""), false);
  assertEq(hasUsableRefreshToken("   "), false);
  assertEq(hasUsableRefreshToken(null), false);
  assertEq(hasUsableRefreshToken(undefined), false);
});

Deno.test("espaços nas pontas não contam como tamanho", () => {
  assertEq(hasUsableRefreshToken(`  ${token(REFRESH_TOKEN_MIN_LENGTH - 1)}  `), false);
  assertEq(hasUsableRefreshToken(`  ${token(REFRESH_TOKEN_MIN_LENGTH)}  `), true);
});