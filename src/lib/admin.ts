import { getPool } from "@/lib/db";
import { adminSessionDigest, secureEqualsHex } from "@/lib/security";

export type AdminPrincipal = { email: string; sessionId: string };

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export async function authenticateAdmin(request: Request): Promise<AdminPrincipal | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)aidx_admin=([^;]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]!);
  const prefix = token.split(".")[0];
  if (!prefix || !token.includes(".")) return null;

  const pool = getPool();
  const result = await pool.query(
    "SELECT id, email, token_hash, expires_at FROM admin_sessions WHERE token_prefix = $1 AND revoked_at IS NULL",
    [prefix],
  );
  const row = result.rows[0] as { id: string; email: string; token_hash: string; expires_at: Date } | undefined;
  if (!row || new Date(row.expires_at).getTime() < Date.now() || !adminEmails().includes(row.email) || !secureEqualsHex(row.token_hash, adminSessionDigest(token))) return null;
  return { email: row.email, sessionId: row.id };
}

export function adminCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `aidx_admin=${encodeURIComponent(token)}; Path=/api/v1/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}
