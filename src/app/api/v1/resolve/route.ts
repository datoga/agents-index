import { error, json } from "@/lib/http";
import { resolveAgentUri } from "@/lib/federation";

export async function GET(request: Request): Promise<Response> {
  const uri = new URL(request.url).searchParams.get("uri");
  if (!uri || uri.length > 512) return error("Provide a valid agent:// URI.", 400, "invalid_request");
  try {
    const headerHop = Number(request.headers.get("x-agents-index-hop") ?? 0);
    if (!Number.isInteger(headerHop) || headerHop < 0 || headerHop > 4) return error("Invalid federation hop count.", 400, "invalid_request");
    const resolved = await resolveAgentUri(uri, headerHop);
    return json({ uri, ...resolved });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "upstream_unavailable";
    if (reason === "invalid_uri") return error("Provide a valid agent:// URI.", 400, "invalid_request");
    if (reason === "not_found") return error("Agent or index not found.", 404, "not_found");
    return error("The federated index is temporarily unavailable.", 502, "upstream_unavailable");
  }
}
