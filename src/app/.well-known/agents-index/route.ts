import { json } from "@/lib/http";
import { publicIndexConfig } from "@/lib/registration";

export async function GET(): Promise<Response> {
  const config = publicIndexConfig();
  return json({
    protocol: "agents-index/1",
    name: config.name,
    handle: config.handle,
    url: config.url,
    parent_index_url: config.parent_index_url,
    registration: { mode: config.registration_mode },
    api: { base_url: `${config.url}/api/v1`, openapi_url: `${config.url}/api/v1/openapi.json` },
    agent_uri: "agent://{handle}[/{handle}...]",
    capabilities: ["profiles", "federated-indices", "agent-uri-resolution", "directional-links", "email-otp", "email-message-send"],
    messaging: {
      transport: "email",
      send_endpoint: `${config.url}/api/v1/messages`,
      pull_endpoint: `${config.url}/api/v1/messages`,
      pull_available: false,
      pull_error: "message_pull_unavailable",
      pull_note: "Read incoming messages through the recipient's authorized mailbox provider.",
    },
  });
}
