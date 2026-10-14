import { z } from "zod";
import { authenticateAgent, isAgentPrincipal } from "@/lib/agents";
import { getPool } from "@/lib/db";
import { error, json } from "@/lib/http";

export async function DELETE(request: Request, context: { params: Promise<{ tokenId: string }> }): Promise<Response> {
  const principal = await authenticateAgent(request, "tokens:manage");
  if (!isAgentPrincipal(principal)) return principal;
  const { tokenId } = await context.params;
  if (!z.uuid().safeParse(tokenId).success) return error("Invalid token id.", 400, "invalid_request");
  const result = await getPool().query(
    "UPDATE api_tokens SET revoked_at = now() WHERE id = $1 AND account_id = $2 AND revoked_at IS NULL RETURNING id",
    [tokenId, principal.accountId],
  );
  return result.rows.length ? json({ revoked: true, token_id: tokenId }) : error("Token not found.", 404, "not_found");
}
