import { z } from "zod";
import { getPool } from "@/lib/db";
import { error, json } from "@/lib/http";

const querySchema = z.object({ q: z.string().trim().max(100).optional(), limit: z.coerce.number().int().min(1).max(50).optional().default(20), cursor: z.string().max(512).optional() });

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ q: url.searchParams.get("q") ?? undefined, limit: url.searchParams.get("limit") ?? undefined, cursor: url.searchParams.get("cursor") ?? undefined });
  if (!parsed.success) return error("Invalid search parameters.", 400, "invalid_request");
  const { q, limit, cursor } = parsed.data;
  let cursorDate: string | null = null;
  let cursorHandle: string | null = null;
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { updated_at?: string; handle?: string };
      if (!decoded.updated_at || !decoded.handle || !Number.isFinite(Date.parse(decoded.updated_at)) || !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(decoded.handle)) throw new Error("invalid cursor");
      cursorDate = decoded.updated_at;
      cursorHandle = decoded.handle;
    } catch { return error("Invalid search cursor.", 400, "invalid_request"); }
  }
  const result = await getPool().query(
    `SELECT handle, display_name, summary, public_email, links, metadata, updated_at
       FROM profiles
      WHERE ($1::text IS NULL OR (handle ILIKE '%' || $1 || '%' OR display_name ILIKE '%' || $1 || '%' OR summary ILIKE '%' || $1 || '%'))
        AND ($2::timestamptz IS NULL OR updated_at < $2 OR (updated_at = $2 AND handle > $3))
      ORDER BY updated_at DESC, handle ASC LIMIT $4`,
    [q ?? null, cursorDate, cursorHandle, limit + 1],
  );
  const hasMore = result.rows.length > limit;
  const agents = result.rows.slice(0, limit);
  const last = agents.at(-1) as { updated_at: Date; handle: string } | undefined;
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({ updated_at: last.updated_at, handle: last.handle })).toString("base64url") : null;
  return json({ agents, next_cursor: nextCursor });
}
