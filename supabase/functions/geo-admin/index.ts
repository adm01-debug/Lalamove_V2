// Etapa 9 do plano Mapbox: administracao do token de servidor pela Tokens API.
//
// Duas actions, ambas idempotentes e explicitas:
//   rotate-mapbox-token  -> cria um `sk.` novo com os mesmos scopes (menos
//                           `tokens:*`) e devolve o valor UMA vez na resposta;
//   revoke-mapbox-token  -> revoga um token pelo id, depois que o secret novo
//                           ja esta em producao.
//
// A janela de 10 minutos entre as duas (REVOKE_AFTER_MS) existe para o deploy
// das edges terminar antes do token velho morrer. Por isso nao agendamos nada
// aqui: a edge nao tem scheduler confiavel, e um DELETE automatico que falhasse
// em silencio deixaria o token vazado vivo. Quem chama e responsavel pelo passo 2.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCreateTokenBody,
  pickTokenToRevoke,
  REVOKE_AFTER_MS,
  tokenFingerprint,
  validateNewToken,
  type MapboxToken,
} from "./rotation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOKENS_API = "https://api.mapbox.com/tokens/v2";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// verify_jwt=true ja validou a assinatura; aqui so lemos o payload para saber
// quem chamou (mesmo padrao de simulate-driver-movement).
function getCaller(req: Request): { uid: string | null; isServiceRole: boolean } {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.role === "service_role") return { uid: null, isServiceRole: true };
    return { uid: payload.sub ?? null, isServiceRole: false };
  } catch {
    return { uid: null, isServiceRole: false };
  }
}

async function listTokens(username: string, accessToken: string): Promise<MapboxToken[]> {
  const res = await fetch(`${TOKENS_API}/${encodeURIComponent(username)}?access_token=${encodeURIComponent(accessToken)}`);
  if (!res.ok) throw new Error(`Tokens API list ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  // A listagem vem embrulhada em `{tokens:[...]}`; a criacao vem em `{token:{...}}`.
  return (data.tokens ?? data) as MapboxToken[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // So admin/manager: esta function cunha e revoga credenciais de faturamento.
  const { uid, isServiceRole } = getCaller(req);
  if (!isServiceRole) {
    if (!uid) return json({ error: "Unauthorized" }, 401);
    // has_role() depende de auth.uid(), que e null com service_role; com o client
    // service_role (bypassa RLS) consultamos user_roles replicando a condicao.
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role, is_active, expires_at")
      .eq("user_id", uid)
      .in("role", ["admin", "manager"]);
    if (rolesError) return json({ error: "Internal server error" }, 500);
    const now = Date.now();
    const allowed = (roles ?? []).some(
      (r) => r.is_active === true && (!r.expires_at || new Date(r.expires_at).getTime() > now),
    );
    if (!allowed) return json({ error: "Forbidden: requires admin or manager role" }, 403);
  }

  let body: { action?: string; note?: string; dry_run?: boolean; token_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const username = Deno.env.get("MAPBOX_USERNAME");
  const adminToken = Deno.env.get("MAPBOX_TOKENS_API_TOKEN");
  if (!username || !adminToken) {
    return json({
      error: "MAPBOX_USERNAME e MAPBOX_TOKENS_API_TOKEN precisam estar configurados como secrets",
    }, 500);
  }

  // Id de correlacao para o audit_log: resource_id e UUID NOT NULL, e o id de
  // token da Mapbox e um ObjectId de 24 hex (nao serve). O id real vai em changes.
  const correlationId = crypto.randomUUID();
  const audit = async (action: string, changes: Record<string, unknown>) => {
    const { error } = await supabase.from("audit_log").insert({
      user_id: uid,
      action,
      resource_type: "mapbox_token",
      resource_id: correlationId,
      changes,
    });
    if (error) console.error("audit_log insert falhou:", error.message);
  };

  try {
    if (body.action === "rotate-mapbox-token") {
      const tokens = await listTokens(username, adminToken);
      const currentSecret = Deno.env.get("MAPBOX_SERVER_TOKEN");
      const currentFingerprint = currentSecret ? tokenFingerprint(currentSecret) : undefined;
      // O token de servidor e o `sk.` sem `tokens:*`: ele nao administra token, so
      // chama as APIs de geo.
      const serverTokens = tokens.filter(
        (t) => (t.usage ?? "").toLowerCase() === "sk" && (t.scopes ?? []).every((s) => !s.startsWith("tokens:")),
      );
      const previous = serverTokens[0];

      if (!previous) {
        return json({ error: "Nenhum token secreto (sk.) de servico encontrado para herdar scopes" }, 409);
      }

      const note = body.note ?? `${previous.note ?? "lalamove-v2-server"} rotated ${new Date().toISOString().slice(0, 10)}`;
      const payload = buildCreateTokenBody(previous, note);
      // Qual id o passo 3 do runbook deve revogar. `pickTokenToRevoke` devolve null
      // quando ha mais de um `sk.` e nenhum fingerprint para desempatar: nesse caso
      // o operador escolhe, em vez de a function adivinhar e derrubar producao.
      const revokeCandidate = pickTokenToRevoke(tokens, "", currentFingerprint);

      if (body.dry_run) {
        return json({
          dry_run: true,
          would_create: payload,
          revoke_candidate_id: revokeCandidate?.id ?? null,
          revoke_candidate_note: revokeCandidate?.note ?? null,
          revoke_after_ms: REVOKE_AFTER_MS,
        });
      }
      if (payload.scopes.length === 0) {
        return json({ error: "Token atual nao tem scopes para herdar; crie o novo manualmente" }, 409);
      }

      const createRes = await fetch(`${TOKENS_API}/${encodeURIComponent(username)}?access_token=${encodeURIComponent(adminToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!createRes.ok) {
        return json({ error: `Tokens API create ${createRes.status}: ${(await createRes.text()).slice(0, 200)}` }, 502);
      }
      const created = (await createRes.json()).token as MapboxToken | undefined;
      const invalid = validateNewToken(created?.token, created?.scopes ?? payload.scopes);
      if (invalid) return json({ error: invalid }, 502);

      await audit("mapbox_token.rotate", {
        correlation_id: correlationId,
        new_token_id: created!.id,
        new_token_fingerprint: tokenFingerprint(created!.token!),
        previous_token_id: previous.id,
        previous_token_note: previous.note ?? null,
        scopes: created!.scopes ?? payload.scopes,
        revoke_after_ms: REVOKE_AFTER_MS,
      });

      return json({
        // Devolvido UMA vez, nunca persistido: e o valor que vai para o secret.
        new_token: created!.token,
        new_token_id: created!.id,
        new_token_fingerprint: tokenFingerprint(created!.token!),
        previous_token_id: previous.id,
        previous_token_fingerprint: currentFingerprint ?? null,
        revoke_candidate_id: revokeCandidate?.id ?? null,
        scopes: created!.scopes ?? payload.scopes,
        revoke_after_ms: REVOKE_AFTER_MS,
        next_steps: [
          `supabase secrets set MAPBOX_SERVER_TOKEN=<new_token> --project-ref ${Deno.env.get("SUPABASE_PROJECT_REF") ?? "iecgydonctmabiijadsf"}`,
          "aguardar o deploy das edges (deploy-edges.yml) terminar",
          revokeCandidate
            ? `action revoke-mapbox-token com token_id=${revokeCandidate.id}`
            : "mais de um sk. sem fingerprint: revogar o antigo a mao no painel Mapbox",
        ],
      });
    }

    if (body.action === "revoke-mapbox-token") {
      if (!body.token_id) return json({ error: "token_id e obrigatorio" }, 400);

      // Nunca revogar o ultimo `sk.` restante: se o id passado for o do secret em
      // uso, o gateway cai na proxima requisicao e nao ha como voltar atras.
      const tokens = await listTokens(username, adminToken);
      const target = tokens.find((t) => t.id === body.token_id);
      if (!target) return json({ error: "token_id nao encontrado na conta" }, 404);
      if ((target.usage ?? "").toLowerCase() !== "sk") {
        return json({ error: "So tokens secretos (sk.) sao revogados aqui" }, 409);
      }
      const otherSecrets = tokens.filter(
        (t) => t.id !== target.id && (t.usage ?? "").toLowerCase() === "sk",
      );
      if (otherSecrets.length === 0) {
        return json({ error: "esse e o unico token secreto restante; criar o novo antes de revogar" }, 409);
      }

      const delRes = await fetch(
        `${TOKENS_API}/${encodeURIComponent(username)}/${encodeURIComponent(target.id)}?access_token=${encodeURIComponent(adminToken)}`,
        { method: "DELETE" },
      );
      if (!delRes.ok) {
        return json({ error: `Tokens API delete ${delRes.status}: ${(await delRes.text()).slice(0, 200)}` }, 502);
      }

      await audit("mapbox_token.revoke", {
        correlation_id: correlationId,
        token_id: target.id,
        token_note: target.note ?? null,
        token_fingerprint: target.token ? tokenFingerprint(target.token) : null,
      });

      return json({ revoked: true, token_id: target.id });
    }

    return json({ error: "action desconhecida (rotate-mapbox-token | revoke-mapbox-token)" }, 400);
  } catch (err) {
    console.error("geo-admin:", err instanceof Error ? err.message : err);
    return json({ error: "Internal server error" }, 500);
  }
});