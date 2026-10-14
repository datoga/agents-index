import { z } from "zod";
import { authenticateAgent, isAgentPrincipal } from "@/lib/agents";
import { getPool } from "@/lib/db";
import { error, json, readJson } from "@/lib/http";

const httpUrl = z.url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Only HTTP and HTTPS links are allowed.");

const updateSchema = z.object({
  display_name: z.string().trim().min(1).max(100).optional(),
  summary: z.string().trim().max(500).optional(),
  public_email: z.email().max(254).nullable().optional(),
  links: z.array(z.object({ label: z.string().max(80), url: httpUrl })).max(30).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export async function GET(request: Request): Promise<Response> {
  const principal = await authenticateAgent(request, "profile:read");
  if (!isAgentPrincipal(principal)) return principal;
  const result = await getPool().query(
    `SELECT p.id, p.handle, p.display_name, p.summary, p.public_email, p.links, p.metadata,
            p.created_at, p.updated_at, a.email_verified_at
       FROM profiles p JOIN accounts a ON a.id = p.account_id WHERE p.account_id = $1`,
    [principal.accountId],
  );
  if (!result.rows[0]) return error("Agent profile not found.", 404, "not_found");
  return json({ agent: result.rows[0] });
}

export async function PATCH(request: Request): Promise<Response> {
  const principal = await authenticateAgent(request, "profile:write");
  if (!isAgentPrincipal(principal)) return principal;
  let body: z.infer<typeof updateSchema>;
  try {
    body = updateSchema.parse(await readJson(request));
  } catch {
    return error("Invalid profile update.", 400, "invalid_request");
  }
  if (Object.keys(body).length === 0) return error("Provide at least one field to update.", 400, "invalid_request");

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const field of ["display_name", "summary", "public_email", "links", "metadata"] as const) {
    if (body[field] !== undefined) {
      values.push(field === "links" || field === "metadata" ? JSON.stringify(body[field]) : body[field]);
      sets.push(`${field} = $${values.length}${field === "links" || field === "metadata" ? "::jsonb" : ""}`);
    }
  }
  values.push(principal.accountId);
  const result = await getPool().query(
    `UPDATE profiles SET ${sets.join(", ")}, updated_at = now() WHERE account_id = $${values.length}
     RETURNING id, handle, display_name, summary, public_email, links, metadata, updated_at`,
    values,
  );
  return result.rows[0] ? json({ agent: result.rows[0] }) : error("Agent profile not found.", 404, "not_found");
}

export async function DELETE(request: Request): Promise<Response> {
  const principal = await authenticateAgent(request, "profile:delete");
  if (!isAgentPrincipal(principal)) return principal;
  const confirmation = request.headers.get("x-confirm-delete");
  if (confirmation !== principal.handle) return error("Set X-Confirm-Delete to your exact handle.", 400, "confirmation_required");
  await getPool().query("DELETE FROM accounts WHERE id = $1", [principal.accountId]);
  return json({ deleted: true, handle: principal.handle });
}
