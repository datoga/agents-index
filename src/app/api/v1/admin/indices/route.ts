import { z } from "zod";
import { authenticateAdmin } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { error, json, readJson } from "@/lib/http";

const schema = z.object({
  handle: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  display_name: z.string().trim().min(1).max(100),
  summary: z.string().trim().max(500).optional().default(""),
  endpoint_url: z.url().max(2048).refine((value) => {
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash; }
    catch { return false; }
  }, "Use the HTTPS origin of the child index."),
  parent_handle: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/).nullable().optional(),
  profile_handle: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/).nullable().optional(),
}).strict();

export async function GET(request: Request): Promise<Response> {
  if (!await authenticateAdmin(request)) return error("Admin session required.", 401, "unauthorized");
  const result = await getPool().query("SELECT * FROM federated_indices ORDER BY created_at DESC");
  return json({ indices: result.rows });
}

export async function POST(request: Request): Promise<Response> {
  const admin = await authenticateAdmin(request);
  if (!admin) return error("Admin session required.", 401, "unauthorized");
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await readJson(request)); }
  catch { return error("Invalid federated index registration.", 400, "invalid_request"); }
  const client = await getPool().connect();
  try {
    const endpoint = new URL(body.endpoint_url).origin;
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO federated_indices (handle, display_name, summary, endpoint_url, parent_handle, profile_handle, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, handle, display_name, summary, endpoint_url, parent_handle, profile_handle, status, created_at`,
      [body.handle, body.display_name, body.summary, endpoint, body.parent_handle ?? null, body.profile_handle ?? null, admin.email],
    );
    await client.query(
      "INSERT INTO audit_events (admin_email, action, target_account_id, details) VALUES ($1, 'index.register', $2, $3::jsonb)",
      [admin.email, body.handle, JSON.stringify({ endpoint_url: endpoint, parent_handle: body.parent_handle ?? null })],
    );
    await client.query("COMMIT");
    return json({ index: result.rows[0] }, 201);
  } catch (cause) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505") return error("An index with this handle or profile is already registered.", 409, "already_registered");
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23503") return error("The parent index or profile does not exist.", 400, "invalid_reference");
    return error("Unable to register the index.", 500, "internal_error");
  } finally { client.release(); }
}
