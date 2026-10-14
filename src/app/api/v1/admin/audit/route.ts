import { authenticateAdmin } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { error, json } from "@/lib/http";

export async function GET(request: Request): Promise<Response> {
  if (!await authenticateAdmin(request)) return error("Admin session required.", 401, "unauthorized");
  const result = await getPool().query("SELECT id, admin_email, action, target_account_id, details, created_at FROM audit_events ORDER BY created_at DESC LIMIT 100");
  return json({ events: result.rows });
}
