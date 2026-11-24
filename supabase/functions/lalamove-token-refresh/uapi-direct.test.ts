import { buildUapiRefreshRequest, parseUapiRefreshResponse } from "./uapi-direct.ts";

// Assertivas locais: `deno lint` proíbe import inline de std nesta base.
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg} — esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  }
}

Deno.test("[uapi-direct] URL pede refresh_token com cara de portal", () => {
  const req = buildUapiRefreshRequest("access-abc", "refresh-xyz", 1732450000000);
  const parsed = new URL(req.url);
  const q = parsed.searchParams;
  assertEq(parsed.origin + parsed.pathname, "https://br-uapi.lalamove.com/index.php", "endpoint");
  assertEq(q.get("_m"), "refresh_token", "_m");
  assertEq(q.get("hcountry"), "20000", "hcountry");
  assertEq(q.get("_t"), "1732450000", "_t");
  assertEq(q.get("os"), "web", "os");
  assertEq(q.get("device_type"), "web", "device_type");
  assert(req.headers["Origin"].includes("web.lalamove.com"), "Origin do portal ausente");
});

Deno.test("[uapi-direct] corpo leva token e refresh_token em args", () => {
  const req = buildUapiRefreshRequest("access-abc", "refresh-xyz");
  const b = new URLSearchParams(req.body);
  assertEq(b.get("token"), "access-abc", "token");
  assertEq(b.get("is_ep"), "1", "is_ep");
  assertEq(b.get("city_id"), "21001", "city_id");
  assertEq(JSON.parse(b.get("args")!).refresh_token, "refresh-xyz", "args.refresh_token");
  assertEq(
    req.headers["Content-Type"],
    "application/x-www-form-urlencoded; charset=utf-8",
    "Content-Type",
  );
});

Deno.test("[uapi-direct] ret=0 devolve o novo par", () => {
  const r = parseUapiRefreshResponse(
    { ret: 0, data: { token: "novo-access", raw: { refresh_token: "novo-refresh" } } },
    "antigo",
  );
  assertEq(r.ok, true, "ok");
  assertEq(r.accessToken, "novo-access", "accessToken");
  assertEq(r.refreshToken, "novo-refresh", "refreshToken");
});

Deno.test("[uapi-direct] sem refresh_token novo, mantem o atual", () => {
  const r = parseUapiRefreshResponse({ ret: 0, data: { token: "novo-access", raw: {} } }, "antigo");
  assertEq(r.ok, true, "ok");
  assertEq(r.refreshToken, "antigo", "refreshToken preservado");
});

Deno.test("[uapi-direct] ret!=0 nao e sucesso e preserva o motivo", () => {
  const r = parseUapiRefreshResponse({ ret: 10007, msg: "token expirado" }, "antigo");
  assertEq(r.ok, false, "ok");
  assertEq(r.accessToken, undefined, "sem accessToken");
  assert(r.detail.includes("token expirado"), "motivo perdido");
});

Deno.test("[uapi-direct] resposta sem data.token falha", () => {
  const r = parseUapiRefreshResponse({ ret: 0, data: {} }, "antigo");
  assertEq(r.ok, false, "ok");
  assert(r.detail.includes("data.token"), "detalhe deveria citar data.token");
});