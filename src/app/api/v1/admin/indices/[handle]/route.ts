import { z } from "zod";
import { authenticateAdmin } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { error, json, readJson } from "@/lib/http";

export async function PATCH(request: Request, context: { params: Promise<{ handle: string }> }): Promise<Response> {
  const admin = await authenticateAdmin(request);
  if (!admin) return error("Admin session required.", 401, "unauthorized");
  const { handle } = await context.params;
  const normalized = handle.toLowerCase();
  if (!z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/).safeParse(normalized).success) return error("Invalid index handle.", 400, "invalid_request");
  let body: { status: "active" | "suspended" };
  try { body = z.object({ status: z.enum(["active", "suspended"]) }).strict().parse(await readJson(request)); }
  catch { return error("Invalid index status.", 400, "invalid_request"); }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE federated_indices SET status = $1, updated_at = now() WHERE handle = $2 RETURNING handle, status", [body.status, normalized]);
    if (!result.rows[0]) { await client.query("ROLLBACK"); return error("Index not found.", 404, "not_found"); }
    await client.query(
      "INSERT INTO audit_events (admin_email, action, target_account_id, details) VALUES ($1, $2, $3, $4::jsonb)",
      [admin.email, body.status === "active" ? "index.activate" : "index.suspend", normalized, JSON.stringify(body)],
    );
    await client.query("COMMIT");
    return json({ index: result.rows[0] });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return error("Unable to update index status.", 500, "internal_error");
  } finally { client.release(); }
}
