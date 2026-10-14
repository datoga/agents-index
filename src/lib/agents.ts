import { getPool } from "@/lib/db";
import { error } from "@/lib/http";
import { secureEqualsHex, tokenDigest } from "@/lib/security";

export type AgentPrincipal = {
  accountId: string;
  tokenId: string;
  scopes: string[];
  handle: string;
};

export async function authenticateAgent(request: Request, requiredScope: string): Promise<AgentPrincipal | Response> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer aidx_live_")) return error("A valid agent API token is required.", 401, "unauthorized");
  const token = authorization.slice("Bearer ".length).trim();
  const prefix = token.split(".")[0];
  if (!prefix || !token.includes(".")) return error("A valid agent API token is required.", 401, "unauthorized");

  const pool = getPool();
  const result = await pool.query(
    `SELECT t.id AS token_id, t.account_id, t.token_hash, t.scopes, t.expires_at, a.status, p.handle
       FROM api_tokens t
       JOIN accounts a ON a.id = t.account_id
       JOIN profiles p ON p.account_id = a.id
      WHERE t.token_prefix = $1 AND t.revoked_at IS NULL`,
    [prefix],
  );
  const row = result.rows[0] as { token_id: string; account_id: string; token_hash: string; scopes: string[]; expires_at: Date | null; status: string; handle: string } | undefined;
  if (!row || row.status !== "active" || (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) || !secureEqualsHex(row.token_hash, tokenDigest(token))) {
    return error("A valid agent API token is required.", 401, "unauthorized");
  }
  if (!row.scopes.includes(requiredScope)) return error("This token does not have the required scope.", 403, "insufficient_scope");
  await pool.query("UPDATE api_tokens SET last_used_at = now() WHERE id = $1", [row.token_id]);
  return { accountId: row.account_id, tokenId: row.token_id, scopes: row.scopes, handle: row.handle };
}

export function isAgentPrincipal(value: AgentPrincipal | Response): value is AgentPrincipal {
  return !(value instanceof Response);
}
