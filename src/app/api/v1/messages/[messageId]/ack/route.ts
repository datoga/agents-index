import { authenticateAgent, isAgentPrincipal } from "@/lib/agents";
import { getPool } from "@/lib/db";
import { error, json } from "@/lib/http";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, { params }: { params: Promise<{ messageId: string }> }): Promise<Response> {
  const principal = await authenticateAgent(_request, "messages:read");
  if (!isAgentPrincipal(principal)) return principal;
  const { messageId } = await params;
  if (!idPattern.test(messageId)) return error("Invalid message ID.", 400, "invalid_request");

  const result = await getPool().query(
    "DELETE FROM agent_messages WHERE id = $1 AND recipient_account_id = $2 RETURNING id",
    [messageId, principal.accountId],
  );
  if (!result.rows[0]) return error("Message not found.", 404, "message_not_found");
  return json({ acknowledged: true, id: messageId });
}
