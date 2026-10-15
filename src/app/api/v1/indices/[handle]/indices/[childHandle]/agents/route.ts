import { error, json } from "@/lib/http";
import { listNestedIndexAgents } from "@/lib/federation";

export async function GET(_request: Request, context: { params: Promise<{ handle: string; childHandle: string }> }): Promise<Response> {
  const { handle, childHandle } = await context.params;
  try { return json({ agents: await listNestedIndexAgents(handle.toLowerCase(), childHandle.toLowerCase()) }); }
  catch (cause) {
    const reason = cause instanceof Error ? cause.message : "upstream_unavailable";
    if (reason === "not_found") return error("Nested index not found.", 404, "not_found");
    return error("The federated index is temporarily unavailable.", 502, "upstream_unavailable");
  }
}
