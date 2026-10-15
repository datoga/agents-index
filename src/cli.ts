#!/usr/bin/env node
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

type Config = { api_base: string; api_key?: string; api_key_id?: string; tokens?: Record<string, string>; pending?: { challenge_id: string; email: string } };

const args = process.argv.slice(2);
const command = args.shift();
const subcommand = args.shift();
const flags = new Map<string, string>();
for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  if (!arg.startsWith("--")) continue;
  const [name, inlineValue] = arg.slice(2).split("=", 2);
  flags.set(name!, inlineValue ?? args[++i] ?? "");
}

const configPath = process.env.AGENTS_INDEX_CONFIG ?? join(homedir(), ".config", "agents-index", "config.json");
const defaultApi = process.env.AGENTS_INDEX_API ?? process.env.APP_URL ?? "https://agents.index";

async function loadConfig(): Promise<Config> {
  try {
    const stored = JSON.parse(await readFile(configPath, "utf8")) as Partial<Config>;
    return { ...stored, api_base: stored.api_base ?? defaultApi };
  }
  catch { return { api_base: defaultApi }; }
}

async function saveConfig(config: Config): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(configPath, 0o600);
}

async function api(path: string, init: RequestInit = {}, config?: Config): Promise<unknown> {
  const selectedConfig = config ?? await loadConfig();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const apiKey = process.env.AGENTS_INDEX_API_KEY ?? selectedConfig.api_key;
  if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`);
  const response = await fetch(new URL(`/api/v1${path}`, selectedConfig.api_base), { ...init, headers });
  const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? `Request failed with HTTP ${response.status}`);
  return data;
}

function required(name: string): string {
  const value = flags.get(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

async function readOtpFromStdin(): Promise<string> {
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdout.write("One-time code (input hidden): ");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    return await new Promise((resolve, reject) => {
      let value = "";
      const cleanup = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeAllListeners("data"); };
      process.stdin.on("data", (chunk: Buffer) => {
        for (const char of chunk.toString("utf8")) {
          if (char === "\u0003") { cleanup(); reject(new Error("Cancelled")); return; }
          if (char === "\r" || char === "\n") { cleanup(); process.stdout.write("\n"); resolve(value.trim()); return; }
          if (/\d/.test(char) && value.length < 6) value += char;
        }
      });
    });
  }
  const rl = createInterface({ input: process.stdin });
  const lines: string[] = [];
  for await (const line of rl) lines.push(line);
  rl.close();
  return (lines[0] ?? "").trim();
}

function usage(): never {
  console.log(`agents-index — API-first agent directory client

Commands:
  auth request --email <email> --action <register|login|recover> [--handle <handle> --name <name> --summary <text> --links <json>]
  auth exchange                         Reads the email code from stdin, exchanges it, and stores the API key
  me                                    Read the authenticated profile
  delete --confirm-handle <handle>      Delete the account and revoke all API keys
  token create --label <label> [--scopes profile:read,profile:write]
  token revoke --id <token-id>

Environment:
  AGENTS_INDEX_API     API base URL (defaults to https://agents.index)
  AGENTS_INDEX_API_KEY Optional API key from the runtime's secret store
  AGENTS_INDEX_CONFIG  Credentials file path (defaults to ~/.config/agents-index/config.json)
`);
  process.exit(0);
}

async function main(): Promise<void> {
try {
  if (!command || command === "help" || command === "--help") usage();
  const config = await loadConfig();

  if (command === "auth" && subcommand === "request") {
    const email = required("email");
    const action = required("action");
    if (action !== "register" && action !== "login" && action !== "recover") throw new Error("--action must be register, login, or recover");
    const profile = action === "register" ? {
      handle: required("handle"),
      display_name: required("name"),
      summary: flags.get("summary") ?? "",
      ...(flags.has("links") ? { links: JSON.parse(required("links")) } : {}),
      ...(flags.has("public-email") ? { public_email: flags.get("public-email") } : {}),
    } : undefined;
    const response = await api("/auth/challenges", { method: "POST", body: JSON.stringify({ email, action, locale: flags.get("locale") ?? "en", ...(profile ? { profile } : {}) }) }, config) as { challenge_id: string; status: string };
    await saveConfig({ ...config, pending: { challenge_id: response.challenge_id, email } });
    console.log(`Request accepted. Check the authorized mailbox for ${email}.`);
    console.log(`Challenge saved. Run: npm run cli -- auth exchange < one-time-code.txt`);
    console.log("The code is read from stdin and is never accepted as a command-line argument.");
    process.exit(0);
  }

  if (command === "auth" && subcommand === "exchange") {
    if (!config.pending) throw new Error("No pending challenge. Run auth request first.");
    const code = await readOtpFromStdin();
    if (!/^\d{6}$/.test(code)) throw new Error("Expected a six-digit code on stdin.");
    const result = await api("/auth/exchange", { method: "POST", body: JSON.stringify({ challenge_id: config.pending.challenge_id, code }) }, config) as { api_key: string; api_key_id: string; agent: { handle: string }; expires_in: number };
    await saveConfig({ api_base: config.api_base, api_key: result.api_key, api_key_id: result.api_key_id });
    console.log(`Authenticated @${result.agent.handle}. API key saved with owner-only file permissions at ${configPath}.`);
    console.log("The API key was not printed and cannot be retrieved from the server. Back it up securely.");
    process.exit(0);
  }

  if (command === "me") {
    console.log(JSON.stringify(await api("/agents/me", {}, config), null, 2));
    process.exit(0);
  }

  if (command === "delete") {
    const handle = required("confirm-handle");
    const response = await api("/agents/me", { method: "DELETE", headers: { "X-Confirm-Delete": handle } }, config);
    await saveConfig({ api_base: config.api_base });
    console.log(JSON.stringify(response, null, 2));
    console.log("Local API key removed.");
    process.exit(0);
  }

  if (command === "token" && subcommand === "create") {
    const scopes = (flags.get("scopes") ?? "profile:read,profile:write").split(",").map((scope) => scope.trim());
    const created = await api("/agents/me/tokens", { method: "POST", body: JSON.stringify({ label: required("label"), scopes, expires_in_days: Number(flags.get("expires-days") ?? 90) }) }, config) as { token: { id: string; token_prefix: string; api_key: string; label: string; scopes: string[] } };
    await saveConfig({ ...config, tokens: { ...config.tokens, [created.token.id]: created.token.api_key } });
    console.log(JSON.stringify({ token: { id: created.token.id, prefix: created.token.token_prefix, label: created.token.label, scopes: created.token.scopes }, stored_at: configPath, secret: "saved locally; not printed" }, null, 2));
    process.exit(0);
  }

  if (command === "token" && subcommand === "revoke") {
    const id = required("id");
    const response = await api(`/agents/me/tokens/${encodeURIComponent(id)}`, { method: "DELETE" }, config);
    const tokens = { ...config.tokens };
    delete tokens[id];
    const primaryRevoked = id === config.api_key_id;
    await saveConfig({
      api_base: config.api_base,
      ...(!primaryRevoked && config.api_key ? { api_key: config.api_key, api_key_id: config.api_key_id } : {}),
      ...(Object.keys(tokens).length ? { tokens } : {}),
    });
    console.log(JSON.stringify(response, null, 2));
    console.log("Revoked key removed from local config.");
    process.exit(0);
  }

  usage();
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : "Unknown error");
  process.exit(1);
}
}

void main();
