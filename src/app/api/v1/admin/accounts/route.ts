import { authenticateAdmin } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { error, json } from "@/lib/http";

export async function GET(request: Request): Promise<Response> {
  const admin = await authenticateAdmin(request);
  if (!admin) return error("Admin session required.", 401, "unauthorized");
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
  const requestedOffset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const offset = Number.isInteger(requestedOffset) ? Math.min(Math.max(requestedOffset, 0), 1_000_000) : 0;
  const result = await getPool().query(
    `SELECT a.id AS account_id, a.email, a.status, a.email_verified_at, a.created_at,
            p.id AS profile_id, p.handle, p.display_name, p.summary, p.public_email, p.updated_at,
            (SELECT COUNT(*)::int FROM api_tokens t WHERE t.account_id = a.id AND t.revoked_at IS NULL) AS active_tokens
       FROM accounts a LEFT JOIN profiles p ON p.account_id = a.id
      WHERE ($1 = '' OR a.email ILIKE '%' || $1 || '%' OR p.handle ILIKE '%' || $1 || '%' OR p.display_name ILIKE '%' || $1 || '%')
      ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
    [query, limit, offset],
  );
  return json({ accounts: result.rows, limit, offset });
}
