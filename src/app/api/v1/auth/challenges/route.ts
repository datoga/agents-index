import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";
import { error, json, readJson, requestIp } from "@/lib/http";
import { hashIp, makeOtp, normalizeEmail, otpDigest, otpTtlSeconds } from "@/lib/security";

const bodySchema = z.object({
  email: z.email().max(254),
  action: z.enum(["register", "recover"]),
  locale: z.enum(["es", "en"]).optional().default("en"),
  profile: z.object({
    handle: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
    display_name: z.string().trim().min(1).max(100),
    summary: z.string().trim().max(500).optional().default(""),
    public_email: z.email().max(254).optional().nullable(),
  }).optional(),
});

export async function POST(request: Request): Promise<Response> {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await readJson(request));
  } catch {
    return error("Invalid request body.", 400, "invalid_request");
  }
  if (body.action === "register" && !body.profile) return error("profile is required for registration.", 400, "invalid_request");

  const email = normalizeEmail(body.email);
  const ipHash = hashIp(requestIp(request));
  const pool = getPool();
  await pool.query("DELETE FROM otp_challenges WHERE created_at < now() - interval '7 days'");
  const recent = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE email = $1)::int AS email_count,
            COUNT(*) FILTER (WHERE ip_hash = $2)::int AS ip_count
       FROM otp_challenges
      WHERE created_at > now() - interval '15 minutes' AND (email = $1 OR ip_hash = $2)`,
    [email, ipHash],
  );
  const counts = recent.rows[0] as { email_count: number; ip_count: number };
  // Always return the same shape. A rate-limited request simply receives no message.
  if (counts.email_count >= 4 || counts.ip_count >= 12) return json({ challenge_id: randomUUID(), status: "accepted" }, 202);

  if (body.action === "recover") {
    const account = await pool.query("SELECT id FROM accounts WHERE email = $1 AND status = 'active'", [email]);
    if (account.rows.length === 0) return json({ challenge_id: randomUUID(), status: "accepted" }, 202);
  }

  const code = makeOtp();
  const purpose = body.action === "register" ? "agent_register" : "agent_recover";
  const inserted = await pool.query(
    `INSERT INTO otp_challenges (email, purpose, code_hash, payload, ip_hash, expires_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, now() + ($6::text || ' seconds')::interval)
     RETURNING id`,
    [email, purpose, otpDigest(email, purpose, code), JSON.stringify(body.profile ?? {}), ipHash, otpTtlSeconds()],
  );
  const challengeId = (inserted.rows[0] as { id: string }).id;

  try {
    await sendOtpEmail(email, code, body.locale, "agent", otpTtlSeconds());
  } catch {
    await pool.query("UPDATE otp_challenges SET consumed_at = now() WHERE id = $1", [challengeId]);
    return error("Unable to send the one-time code. Try again later.", 503, "email_unavailable");
  }
  return json({ challenge_id: challengeId, status: "accepted", expires_in: otpTtlSeconds() }, 202);
}
