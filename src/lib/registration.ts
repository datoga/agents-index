import { normalizeEmail } from "@/lib/security";

export type RegistrationMode = "email" | "domain" | "closed";

export function registrationMode(): RegistrationMode {
  const configured = (process.env.REGISTRATION_MODE ?? "email").trim().toLowerCase();
  return configured === "domain" || configured === "closed" ? configured : "email";
}

export function registrationAllowed(email: string): boolean {
  const mode = registrationMode();
  if (mode === "closed") return false;
  if (mode === "email") return true;
  const domain = normalizeEmail(email).split("@").at(-1);
  const allowedDomains = (process.env.REGISTRATION_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  return Boolean(domain && allowedDomains.some((allowed) => domain === allowed));
}

export function publicIndexConfig() {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "http://localhost:3000").trim().replace(/\/$/, "");
  const parent = process.env.PARENT_INDEX_URL?.trim().replace(/\/$/, "") || null;
  return {
    name: process.env.INDEX_NAME?.trim() || "agents.index",
    handle: process.env.INDEX_HANDLE?.trim().toLowerCase() || null,
    url: origin,
    parent_index_url: parent,
    registration_mode: registrationMode(),
  };
}
