import { z } from "zod";
import { adminCookie, adminEmails, authenticateAdmin } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { error, json, readJson } from "@/lib/http";
import { createAdminSessionToken, normalizeEmail, otpDigest, secureEqualsHex } from "@/lib/security";

const schema = z.object({ challenge_id: z.uuid(), code: z.string().regex(/^\d{6}$/) });

export async function GET(request: Request): Promise<Response> {
  const admin = await authenticateAdmin(request);
  return admin ? json({ admin: { email: admin.email } }) : error("Admin session required.", 401, "unauthorized");
}

export async function POST(request: Request): Promise<Response> {
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await readJson(request)); }
  catch { return error("Invalid challenge or code.", 400, "invalid_request"); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, email, code_hash, expires_at, attempts, consumed_at
         FROM otp_challenges WHERE id = $1 AND purpose = 'admin_login' FOR UPDATE`,
      [body.challenge_id],
    );
    const challenge = result.rows[0] as { id: string; email: string; code_hash: string; expires_at: Date; attempts: number; consumed_at: Date | null } | undefined;
    if (!challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now() || challenge.attempts >= 5 || !adminEmails().includes(challenge.email)) {
      await client.query("ROLLBACK");
      return error("Invalid, expired, or already used code.", 400, "invalid_code");
    }
    if (!secureEqualsHex(challenge.code_hash, otpDigest(normalizeEmail(challenge.email), "admin_login", body.code))) {
      await client.query("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1", [challenge.id]);
      await client.query("COMMIT");
      return error("Invalid, expired, or already used code.", 400, "invalid_code");
    }

    await client.query("UPDATE otp_challenges SET consumed_at = now() WHERE id = $1", [challenge.id]);
    const session = createAdminSessionToken();
    const hours = Number(process.env.ADMIN_SESSION_TTL_HOURS ?? 8);
    const ttl = Number.isFinite(hours) && hours >= 1 && hours <= 24 ? hours : 8;
    await client.query(
      `INSERT INTO admin_sessions (email, token_prefix, token_hash, expires_at)
       VALUES ($1, $2, $3, now() + ($4::text || ' hours')::interval)`,
      [challenge.email, session.prefix, session.digest, ttl],
    );
    await client.query("COMMIT");
    return json({ admin: { email: challenge.email }, expires_in: ttl * 3600 }, 200, { "Set-Cookie": adminCookie(session.token, ttl * 3600) });
  } catch (cause) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("admin otp verification failed", cause instanceof Error ? cause.message : "unknown error");
    return error("Unable to verify code.", 500, "internal_error");
  } finally { client.release(); }
}

export async function DELETE(request: Request): Promise<Response> {
  const admin = await authenticateAdmin(request);
  if (admin) await getPool().query("UPDATE admin_sessions SET revoked_at = now() WHERE id = $1", [admin.sessionId]);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return json({ signed_out: true }, 200, { "Set-Cookie": `aidx_admin=; Path=/api/v1/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure}` });
}
