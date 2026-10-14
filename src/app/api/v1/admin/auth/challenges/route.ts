import { randomUUID } from "node:crypto";
import { z } from "zod";
import { adminEmails } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";
import { error, json, readJson, requestIp } from "@/lib/http";
import { hashIp, makeOtp, normalizeEmail, otpDigest, otpTtlSeconds } from "@/lib/security";

const schema = z.object({ email: z.email().max(254), locale: z.enum(["es", "en"]).optional().default("en") });

export async function POST(request: Request): Promise<Response> {
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await readJson(request)); }
  catch { return error("Invalid request.", 400, "invalid_request"); }
  const email = normalizeEmail(body.email);
  if (!adminEmails().includes(email)) return json({ challenge_id: randomUUID(), status: "accepted" }, 202);

  const pool = getPool();
  await pool.query("DELETE FROM otp_challenges WHERE created_at < now() - interval '7 days'");
  await pool.query("DELETE FROM admin_sessions WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days'");
  const ipHash = hashIp(requestIp(request));
  const recent = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE email = $1)::int AS email_count,
            COUNT(*) FILTER (WHERE ip_hash = $2)::int AS ip_count
       FROM otp_challenges
      WHERE purpose = 'admin_login' AND created_at > now() - interval '15 minutes' AND (email = $1 OR ip_hash = $2)`,
    [email, ipHash],
  );
  const counts = recent.rows[0] as { email_count: number; ip_count: number };
  if (counts.email_count >= 4 || counts.ip_count >= 12) return json({ status: "accepted" }, 202);

  const code = makeOtp();
  const inserted = await pool.query(
    `INSERT INTO otp_challenges (email, purpose, code_hash, ip_hash, expires_at)
     VALUES ($1, 'admin_login', $2, $3, now() + ($4::text || ' seconds')::interval) RETURNING id`,
    [email, otpDigest(email, "admin_login", code), ipHash, otpTtlSeconds()],
  );
  try { await sendOtpEmail(email, code, body.locale, "admin", otpTtlSeconds()); }
  catch {
    await pool.query("UPDATE otp_challenges SET consumed_at = now() WHERE id = $1", [(inserted.rows[0] as { id: string }).id]);
    return error("Unable to send the one-time code.", 503, "email_unavailable");
  }
  return json({ challenge_id: (inserted.rows[0] as { id: string }).id, status: "accepted", expires_in: otpTtlSeconds() }, 202);
}
