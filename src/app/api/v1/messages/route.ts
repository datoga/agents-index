import { z } from "zod";
import { authenticateAgent, isAgentPrincipal } from "@/lib/agents";
import { getPool } from "@/lib/db";
import { error, json, readJson } from "@/lib/http";

const messageSchema = z.object({
  to: z.string().trim().regex(/^agent:\/\/[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "Use a local agent://handle recipient."),
  subject: z.string().trim().min(1).max(160).refine((value) => !/[\r\n]/.test(value), "Subject must be a single line."),
  text: z.string().trim().min(1).max(10_000),
}).strict();

const cursorId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | undefined {
  try {
    const [createdAt, id, ...rest] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (rest.length || !createdAt || !id || !cursorId.test(id) || !Number.isFinite(Date.parse(createdAt))) return undefined;
    return { createdAt: new Date(createdAt).toISOString(), id };
  } catch { return undefined; }
}

export async function POST(request: Request): Promise<Response> {
  const principal = await authenticateAgent(request, "messages:send");
  if (!isAgentPrincipal(principal)) return principal;

  let body: z.infer<typeof messageSchema>;
  try { body = messageSchema.parse(await readJson(request)); }
  catch { return error("Invalid message. Provide a local agent://handle, a one-line subject, and plain-text content up to 10,000 characters.", 400, "invalid_request"); }

  const recipientHandle = body.to.slice("agent://".length);
  const pool = getPool();
  const recipientResult = await pool.query(
    `SELECT a.id AS account_id, p.handle
       FROM accounts a JOIN profiles p ON p.account_id = a.id
      WHERE p.handle = $1 AND a.status = 'active'`,
    [recipientHandle],
  );
  const recipient = recipientResult.rows[0] as { account_id: string; handle: string } | undefined;
  if (!recipient) return error("Recipient agent not found.", 404, "recipient_not_found");
  if (recipient.account_id === principal.accountId) return error("An agent cannot send a message to itself.", 400, "self_message_not_allowed");

  const client = await pool.connect();
  let message: { id: string; created_at: Date };
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM accounts WHERE id = $1 FOR UPDATE", [principal.accountId]);
    const recent = await client.query(
      `SELECT COUNT(*)::int AS count FROM message_deliveries
        WHERE sender_account_id = $1 AND created_at > now() - interval '1 hour'`,
      [principal.accountId],
    );
    if ((recent.rows[0] as { count: number }).count >= 10) {
      await client.query("ROLLBACK");
      return error("Message send limit reached. Try again later.", 429, "rate_limited");
    }

    await client.query(
      `INSERT INTO message_deliveries (sender_account_id, recipient_account_id, transport, status)
       VALUES ($1, $2, 'postgresql', 'sent')`,
      [principal.accountId, recipient.account_id],
    );
    const inserted = await client.query(
      `INSERT INTO agent_messages (sender_account_id, recipient_account_id, sender_handle, recipient_handle, subject, body)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [principal.accountId, recipient.account_id, principal.handle, recipient.handle, body.subject, body.text],
    );
    message = inserted.rows[0] as { id: string; created_at: Date };
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return error("Unable to store the message.", 503, "message_store_unavailable");
  } finally { client.release(); }

  return json({
    message: {
      id: message.id,
      from: `agent://${principal.handle}`,
      to: `agent://${recipientHandle}`,
      transport: "postgresql",
      status: "stored",
      stored_at: message.created_at.toISOString(),
    },
  }, 202);
}

export async function GET(request: Request): Promise<Response> {
  const principal = await authenticateAgent(request, "messages:read");
  if (!isAgentPrincipal(principal)) return principal;

  const url = new URL(request.url);
  const limitText = url.searchParams.get("limit");
  const limit = limitText === null ? 20 : Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return error("limit must be an integer from 1 to 50.", 400, "invalid_request");

  const cursorText = url.searchParams.get("cursor");
  const cursor = cursorText ? decodeCursor(cursorText) : undefined;
  if (cursorText && !cursor) return error("Invalid message cursor.", 400, "invalid_cursor");

  const result = await getPool().query(
    `SELECT id, sender_handle, recipient_handle, subject, body, created_at
       FROM agent_messages
      WHERE recipient_account_id = $1
        AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::uuid))
      ORDER BY created_at DESC, id DESC
      LIMIT $4`,
    [principal.accountId, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
  );
  const hasMore = result.rows.length > limit;
  const rows = result.rows.slice(0, limit) as { id: string; sender_handle: string; recipient_handle: string; subject: string; body: string; created_at: Date }[];
  const last = rows.at(-1);
  return json({
    messages: rows.map((row) => ({
      id: row.id,
      from: `agent://${row.sender_handle}`,
      to: `agent://${row.recipient_handle}`,
      subject: row.subject,
      text: row.body,
      received_at: row.created_at.toISOString(),
      transport: "postgresql",
    })),
    next_cursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
  });
}
