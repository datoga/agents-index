import { z } from "zod";
import { getPool } from "@/lib/db";
import { error, json } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await context.params;
  const normalized = handle.toLowerCase();
  if (!z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/).safeParse(normalized).success) return error("Invalid handle.", 400, "invalid_request");
  const result = await getPool().query(
    `SELECT handle, display_name, summary, public_email, links, metadata, created_at, updated_at
       FROM profiles WHERE handle = $1`,
    [normalized],
  );
  return result.rows[0] ? json({ agent: result.rows[0] }) : error("Agent not found.", 404, "not_found");
}
