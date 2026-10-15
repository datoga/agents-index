import { error, json } from "@/lib/http";
import { listChildIndices } from "@/lib/federation";

export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await context.params;
  try { return json({ indices: await listChildIndices(handle.toLowerCase()) }); }
  catch (cause) {
    const reason = cause instanceof Error ? cause.message : "upstream_unavailable";
    if (reason === "not_found") return error("Index not found.", 404, "not_found");
    return error("The federated index is temporarily unavailable.", 502, "upstream_unavailable");
  }
}
