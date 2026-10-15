import { z } from "zod";
import { authenticateAgent, isAgentPrincipal } from "@/lib/agents";
import { getPool } from "@/lib/db";
import { error, json, readJson } from "@/lib/http";
import { createApiKey } from "@/lib/security";

const allowedScopes = ["profile:read", "profile:write", "profile:delete", "tokens:manage", "messages:send", "messages:read"] as const;
const schema = z.object({
  label: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(allowedScopes)).min(1).max(6).optional().default(["profile:read", "profile:write"]),
  expires_in_days: z.number().int().min(1).max(365).optional().default(90),
});

export async function GET(request: Request): Promise<Response> {
  const principal = await authenticateAgent(request, "tokens:manage");
  if (!isAgentPrincipal(principal)) return principal;
  const result = await getPool().query(
    `SELECT id, token_prefix, label, scopes, expires_at, last_used_at, revoked_at, created_at
       FROM api_tokens WHERE account_id = $1 ORDER BY created_at DESC`,
    [principal.accountId],
  );
  return json({ tokens: result.rows });
}

export async function POST(request: Request): Promise<Response> {
  const principal = await authenticateAgent(request, "tokens:manage");
  if (!isAgentPrincipal(principal)) return principal;
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await readJson(request)); }
  catch { return error("Invalid token request.", 400, "invalid_request"); }
  if (body.scopes.some((scope) => !principal.scopes.includes(scope))) {
    return error("A token cannot grant scopes that the current token does not have.", 403, "scope_escalation");
  }

  const key = createApiKey();
  const result = await getPool().query(
    `INSERT INTO api_tokens (account_id, token_prefix, token_hash, label, scopes, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + ($6::text || ' days')::interval)
     RETURNING id, token_prefix, label, scopes, expires_at, created_at`,
    [principal.accountId, key.prefix, key.digest, body.label, body.scopes, body.expires_in_days],
  );
  return json({ token: { ...result.rows[0], api_key: key.token }, warning: "Store this API key now. It is shown only once." }, 201);
}
