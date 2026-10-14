import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

function secret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32) throw new Error(`${name} must be set to a random value of at least 32 characters`);
  return value;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function makeOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function otpDigest(email: string, purpose: string, code: string): string {
  return createHmac("sha256", secret("OTP_PEPPER"))
    .update(`${normalizeEmail(email)}\n${purpose}\n${code}`)
    .digest("hex");
}

export function tokenDigest(token: string): string {
  return createHmac("sha256", secret("TOKEN_PEPPER")).update(token).digest("hex");
}

export function adminSessionDigest(token: string): string {
  return createHmac("sha256", secret("ADMIN_SESSION_PEPPER")).update(token).digest("hex");
}

export function hashIp(ip: string): string {
  return createHmac("sha256", secret("OTP_PEPPER")).update(ip).digest("hex");
}

export function secureEqualsHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export function createApiKey(): { token: string; prefix: string; digest: string } {
  const token = `aidx_live_${randomUUID().replaceAll("-", "").slice(0, 12)}.${randomBytes(32).toString("base64url")}`;
  const prefix = token.split(".")[0]!;
  return { token, prefix, digest: tokenDigest(token) };
}

export function createAdminSessionToken(): { token: string; prefix: string; digest: string } {
  const token = `aidx_admin_${randomUUID().replaceAll("-", "").slice(0, 12)}.${randomBytes(32).toString("base64url")}`;
  const prefix = token.split(".")[0]!;
  return { token, prefix, digest: adminSessionDigest(token) };
}

export function otpTtlSeconds(): number {
  const value = Number(process.env.OTP_TTL_SECONDS ?? 600);
  return Number.isFinite(value) && value >= 60 && value <= 1800 ? value : 600;
}

export function apiTokenTtlDays(): number {
  const value = Number(process.env.API_TOKEN_TTL_DAYS ?? 365);
  return Number.isInteger(value) && value >= 1 && value <= 365 ? value : 365;
}
