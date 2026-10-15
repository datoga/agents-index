import { z } from "zod";
import { authenticateAdmin } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { error, json, readJson } from "@/lib/http";
import { normalizeEmail } from "@/lib/security";

const provisionSchema = z.object({
  email: z.email().max(254),
  handle: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  display_name: z.string().trim().min(1).max(100),
  summary: z.string().trim().max(500).optional().default(""),
}).strict();

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
            p.id AS profile_id, p.handle, p.display_name, p.summary, p.public_email, p.avatar_url, p.updated_at,
            (SELECT COUNT(*)::int FROM api_tokens t WHERE t.account_id = a.id AND t.revoked_at IS NULL) AS active_tokens
       FROM accounts a LEFT JOIN profiles p ON p.account_id = a.id
      WHERE ($1 = '' OR a.email ILIKE '%' || $1 || '%' OR p.handle ILIKE '%' || $1 || '%' OR p.display_name ILIKE '%' || $1 || '%')
      ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
    [query, limit, offset],
  );
  return json({ accounts: result.rows, limit, offset });
}

export async function POST(request: Request): Promise<Response> {
  const admin = await authenticateAdmin(request);
  if (!admin) return error("Admin session required.", 401, "unauthorized");
  let body: z.infer<typeof provisionSchema>;
  try { body = provisionSchema.parse(await readJson(request)); }
  catch { return error("Invalid account details.", 400, "invalid_request"); }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const account = await client.query(
      "INSERT INTO accounts (email, email_verified_at) VALUES ($1, NULL) RETURNING id, email, status, created_at",
      [normalizeEmail(body.email)],
    );
    const accountId = (account.rows[0] as { id: string }).id;
    const profile = await client.query(
      `INSERT INTO profiles (account_id, handle, display_name, summary)
       VALUES ($1, $2, $3, $4) RETURNING handle, display_name, summary`,
      [accountId, body.handle, body.display_name, body.summary],
    );
    await client.query(
      "INSERT INTO audit_events (admin_email, action, target_account_id, details) VALUES ($1, 'account.provision', $2, $3::jsonb)",
      [admin.email, accountId, JSON.stringify({ email: normalizeEmail(body.email), handle: body.handle })],
    );
    await client.query("COMMIT");
    return json({ account: { ...account.rows[0], ...profile.rows[0], email_verified: false }, next_step: "The owner can request an email OTP with action=login." }, 201);
  } catch (cause) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505") return error("An account with this email or handle already exists.", 409, "already_registered");
    return error("Unable to provision account.", 500, "internal_error");
  } finally { client.release(); }
}
