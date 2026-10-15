import { z } from "zod";
import { error, json } from "@/lib/http";
import { getPublicIndex } from "@/lib/federation";

export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await context.params;
  const normalized = handle.toLowerCase();
  if (!z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/).safeParse(normalized).success) return error("Invalid index handle.", 400, "invalid_request");
  const index = await getPublicIndex(normalized);
  return index ? json({ index }) : error("Index not found.", 404, "not_found");
}
