import { z } from "zod";
import { getPool } from "@/lib/db";
import { error, json, readJson } from "@/lib/http";
import { apiTokenTtlDays, createApiKey, normalizeEmail, otpDigest, secureEqualsHex } from "@/lib/security";

const schema = z.object({ challenge_id: z.uuid(), code: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request): Promise<Response> {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await readJson(request));
  } catch {
    return error("Invalid challenge or code.", 400, "invalid_request");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT id, email, purpose, code_hash, payload, expires_at, attempts, consumed_at
         FROM otp_challenges WHERE id = $1 FOR UPDATE`,
      [body.challenge_id],
    );
    const challenge = found.rows[0] as { id: string; email: string; purpose: string; code_hash: string; payload: Record<string, unknown>; expires_at: Date; attempts: number; consumed_at: Date | null } | undefined;
    const invalid = !challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now() || challenge.attempts >= 5 || !["agent_register", "agent_login", "agent_recover"].includes(challenge.purpose);
    if (invalid) {
      await client.query("ROLLBACK");
      return error("Invalid, expired, or already used code.", 400, "invalid_code");
    }

    const expected = otpDigest(normalizeEmail(challenge.email), challenge.purpose, body.code);
    if (!secureEqualsHex(challenge.code_hash, expected)) {
      await client.query("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1", [challenge.id]);
      await client.query("COMMIT");
      return error("Invalid, expired, or already used code.", 400, "invalid_code");
    }
    await client.query("UPDATE otp_challenges SET consumed_at = now() WHERE id = $1", [challenge.id]);

    let accountId: string;
    let handle: string;
    if (challenge.purpose === "agent_register") {
      const profile = challenge.payload as { handle?: string; display_name?: string; summary?: string; public_email?: string | null; links?: { label: string; url: string; type?: string }[] };
      if (!profile.handle || !profile.display_name) {
        await client.query("ROLLBACK");
        return error("Registration data is incomplete.", 400, "invalid_registration");
      }
      const existing = await client.query("SELECT id FROM accounts WHERE email = $1", [normalizeEmail(challenge.email)]);
      if (existing.rows.length) {
        await client.query("ROLLBACK");
        return error("This email already has an agent. Use the recovery flow.", 409, "account_exists");
      }
      const account = await client.query(
        "INSERT INTO accounts (email) VALUES ($1) RETURNING id",
        [normalizeEmail(challenge.email)],
      );
      accountId = (account.rows[0] as { id: string }).id;
      const profileResult = await client.query(
        `INSERT INTO profiles (account_id, handle, display_name, summary, public_email, links)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING handle`,
        [accountId, profile.handle, profile.display_name, profile.summary ?? "", profile.public_email ?? null, JSON.stringify(profile.links ?? [])],
      );
      handle = (profileResult.rows[0] as { handle: string }).handle;
    } else {
      const account = await client.query("SELECT id, status FROM accounts WHERE email = $1 FOR UPDATE", [normalizeEmail(challenge.email)]);
      const row = account.rows[0] as { id: string; status: string } | undefined;
      if (!row || row.status !== "active") {
        await client.query("ROLLBACK");
        return error("Unable to recover this account.", 400, "invalid_code");
      }
      accountId = row.id;
      await client.query("UPDATE accounts SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1", [accountId]);
      if (challenge.purpose === "agent_recover") {
        await client.query("UPDATE api_tokens SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL", [accountId]);
      }
      const profileResult = await client.query("SELECT handle FROM profiles WHERE account_id = $1", [accountId]);
      const profileRow = profileResult.rows[0] as { handle: string } | undefined;
      if (!profileRow) {
        await client.query("ROLLBACK");
        return error("Unable to recover this account.", 400, "invalid_code");
      }
      handle = profileRow.handle;
    }

    const apiKey = createApiKey();
    const ttlDays = apiTokenTtlDays();
    const insertedToken = await client.query(
      `INSERT INTO api_tokens (account_id, token_prefix, token_hash, label, scopes, expires_at)
       VALUES ($1, $2, $3, 'primary agent', ARRAY['profile:read','profile:write','profile:delete','tokens:manage'], now() + ($4::text || ' days')::interval)
       RETURNING id`,
      [accountId, apiKey.prefix, apiKey.digest, ttlDays],
    );
    await client.query("COMMIT");
    return json({
      token_type: "Bearer",
      api_key: apiKey.token,
      api_key_id: (insertedToken.rows[0] as { id: string }).id,
      expires_in: ttlDays * 86_400,
      scopes: ["profile:read", "profile:write", "profile:delete", "tokens:manage"],
      agent: { handle, profile_url: `${process.env.APP_URL ?? new URL(request.url).origin}/en/${handle}` },
      warning: "Store this API key now. It is shown only once.",
    }, 201);
  } catch (cause) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505") {
      return error("The handle or email is already registered.", 409, "already_registered");
    }
    console.error("agent registration exchange failed", cause instanceof Error ? cause.message : "unknown error");
    return error("Unable to complete registration.", 500, "internal_error");
  } finally {
    client.release();
  }
}
