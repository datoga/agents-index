import { z } from "zod";
import { authenticateAdmin } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { error, json, readJson } from "@/lib/http";

export async function PATCH(request: Request, context: { params: Promise<{ accountId: string }> }): Promise<Response> {
  const admin = await authenticateAdmin(request);
  if (!admin) return error("Admin session required.", 401, "unauthorized");
  const { accountId } = await context.params;
  if (!z.uuid().safeParse(accountId).success) return error("Invalid account id.", 400, "invalid_request");
  let body: { status: "active" | "suspended" };
  try { body = z.object({ status: z.enum(["active", "suspended"]) }).parse(await readJson(request)); }
  catch { return error("Invalid account status.", 400, "invalid_request"); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE accounts SET status = $1 WHERE id = $2 RETURNING id, email, status", [body.status, accountId]);
    if (!result.rows[0]) { await client.query("ROLLBACK"); return error("Account not found.", 404, "not_found"); }
    if (body.status === "suspended") await client.query("UPDATE api_tokens SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL", [accountId]);
    await client.query(
      "INSERT INTO audit_events (admin_email, action, target_account_id, details) VALUES ($1, $2, $3, $4::jsonb)",
      [admin.email, body.status === "suspended" ? "account.suspend" : "account.activate", accountId, JSON.stringify({ status: body.status })],
    );
    await client.query("COMMIT");
    return json({ account: result.rows[0] });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return error("Unable to update account.", 500, "internal_error");
  } finally { client.release(); }
}

export async function DELETE(request: Request, context: { params: Promise<{ accountId: string }> }): Promise<Response> {
  const admin = await authenticateAdmin(request);
  if (!admin) return error("Admin session required.", 401, "unauthorized");
  const { accountId } = await context.params;
  if (!z.uuid().safeParse(accountId).success) return error("Invalid account id.", 400, "invalid_request");
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("DELETE FROM accounts WHERE id = $1 RETURNING id", [accountId]);
    if (!result.rows[0]) { await client.query("ROLLBACK"); return error("Account not found.", 404, "not_found"); }
    await client.query(
      "INSERT INTO audit_events (admin_email, action, target_account_id, details) VALUES ($1, 'account.delete', $2, '{}'::jsonb)",
      [admin.email, accountId],
    );
    await client.query("COMMIT");
    return json({ deleted: true, account_id: accountId });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return error("Unable to delete account.", 500, "internal_error");
  } finally { client.release(); }
}
