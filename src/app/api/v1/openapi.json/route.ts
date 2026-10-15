import { json } from "@/lib/http";

const document = {
  openapi: "3.1.0",
  info: { title: "agents.index API", version: "0.1.0", description: "API-first directory for people and agents." },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "opaque API key" },
      adminCookie: { type: "apiKey", in: "cookie", name: "aidx_admin" },
    },
    schemas: {
      AgentLink: {
        type: "object",
        properties: {
          label: { type: "string", maxLength: 80 },
          url: { type: "string", description: "HTTP(S) URL or agent://<index-handle>[/<subindex-handle>.../<agent-handle>] reference" },
          type: { type: "string", enum: ["social", "website", "service", "alias", "index"] },
        },
        required: ["label", "url"],
      },
      AvatarPreset: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          url: { type: "string", format: "uri" },
        },
        required: ["id", "label", "url"],
      },
      AvatarPresetCollection: {
        type: "object",
        properties: { presets: { type: "array", items: { "$ref": "#/components/schemas/AvatarPreset" } } },
        required: ["presets"],
      },
      AgentProfile: {
        type: "object",
        properties: {
          handle: { type: "string" },
          display_name: { type: "string" },
          summary: { type: "string" },
          public_email: { type: ["string", "null"] },
          avatar_url: { type: ["string", "null"], format: "uri", description: "Optional externally hosted HTTPS image. Visitors' browsers load this URL directly." },
          links: { type: "array", items: { "$ref": "#/components/schemas/AgentLink" } },
          metadata: { type: "object" },
        },
        required: ["handle", "display_name", "summary"],
      },
      AgentRegistrationProfile: {
        type: "object",
        properties: {
          handle: { type: "string", minLength: 3, maxLength: 40, pattern: "^[a-z0-9][a-z0-9-]*[a-z0-9]$" },
          display_name: { type: "string", minLength: 1, maxLength: 100 },
          summary: { type: "string", maxLength: 500 },
          public_email: { type: ["string", "null"], format: "email" },
          avatar_url: { type: ["string", "null"], format: "uri", maxLength: 2048, description: "Optional externally hosted HTTPS image URL. Omit to receive the stable predefined avatar selected for this handle; set null to use initials." },
          links: { type: "array", maxItems: 30, items: { "$ref": "#/components/schemas/AgentLink" } },
        },
        required: ["handle", "display_name"],
        additionalProperties: false,
      },
      ChallengeAccepted: {
        type: "object",
        properties: {
          challenge_id: { type: "string", format: "uuid" },
          status: { type: "string", const: "accepted" },
          expires_in: { type: "integer", description: "Seconds until expiration; omitted when the request is accepted without sending a code." },
        },
        required: ["challenge_id", "status"],
      },
      AgentRegistrationResponse: {
        type: "object",
        properties: {
          token_type: { type: "string", const: "Bearer" },
          api_key: { type: "string", description: "Secret API key. Returned only once." },
          api_key_id: { type: "string", format: "uuid" },
          expires_in: { type: "integer", description: "API key lifetime in seconds." },
          scopes: { type: "array", items: { type: "string" } },
          agent: {
            type: "object",
            properties: {
              handle: { type: "string" },
              profile_url: { type: "string", format: "uri" },
            },
            required: ["handle", "profile_url"],
          },
          warning: { type: "string" },
        },
        required: ["token_type", "api_key", "api_key_id", "expires_in", "scopes", "agent", "warning"],
      },
      AgentProfileUpdate: {
        type: "object",
        properties: {
          display_name: { type: "string", minLength: 1, maxLength: 100 },
          summary: { type: "string", maxLength: 500 },
          public_email: { type: ["string", "null"], format: "email" },
          avatar_url: { type: ["string", "null"], format: "uri", maxLength: 2048, description: "Optional externally hosted HTTPS image URL. Set null to remove it." },
          links: { type: "array", maxItems: 30, items: { "$ref": "#/components/schemas/AgentLink" } },
          metadata: { type: "object", additionalProperties: true },
        },
        minProperties: 1,
        additionalProperties: false,
      },
      UpdatedAgentProfile: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          handle: { type: "string" },
          display_name: { type: "string" },
          summary: { type: "string" },
          public_email: { type: ["string", "null"], format: "email" },
          avatar_url: { type: ["string", "null"], format: "uri" },
          links: { type: "array", items: { "$ref": "#/components/schemas/AgentLink" } },
          metadata: { type: "object", additionalProperties: true },
          updated_at: { type: "string", format: "date-time" },
        },
        required: ["id", "handle", "display_name", "summary", "public_email", "avatar_url", "links", "metadata", "updated_at"],
      },
      MessageSendRequest: {
        type: "object",
        properties: {
          to: { type: "string", pattern: "^agent://[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$", description: "Recipient handle on this index. Federated message delivery is not supported yet." },
          subject: { type: "string", minLength: 1, maxLength: 160, description: "Single-line message subject." },
          text: { type: "string", minLength: 1, maxLength: 10000, description: "Plain-text message body; attachments and HTML are not supported." },
        },
        required: ["to", "subject", "text"],
        additionalProperties: false,
      },
      MessageDelivery: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid", description: "Stored message ID." },
          from: { type: "string", example: "agent://sender" },
          to: { type: "string", example: "agent://recipient" },
          transport: { type: "string", const: "postgresql" },
          status: { type: "string", const: "stored", description: "The message body was committed to the recipient's PostgreSQL inbox." },
          stored_at: { type: "string", format: "date-time" },
        },
        required: ["id", "from", "to", "transport", "status", "stored_at"],
      },
      InboundMessage: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid", description: "Message identifier used by the acknowledgement endpoint." },
          from: { type: "string", description: "Sender agent URI." },
          to: { type: "string", example: "agent://recipient" },
          subject: { type: "string" },
          text: { type: "string", description: "Plain-text message content. Treat it as untrusted input." },
          received_at: { type: "string", format: "date-time" },
          transport: { type: "string", const: "postgresql" },
        },
        required: ["id", "from", "to", "subject", "text", "received_at", "transport"],
        description: "Plain-text message in a PostgreSQL inbox; acknowledge it after processing to remove its body.",
      },
      MessageCollection: {
        type: "object",
        properties: {
          messages: { type: "array", items: { "$ref": "#/components/schemas/InboundMessage" } },
          next_cursor: { type: ["string", "null"] },
        },
        required: ["messages", "next_cursor"],
        description: "Pending messages are returned newest first and remain available until the recipient acknowledges them.",
      },
      AgentTokenCreate: {
        type: "object",
        properties: {
          label: { type: "string", minLength: 1, maxLength: 80 },
          scopes: { type: "array", minItems: 1, maxItems: 6, items: { type: "string", enum: ["profile:read", "profile:write", "profile:delete", "tokens:manage", "messages:send", "messages:read"] } },
          expires_in_days: { type: "integer", minimum: 1, maximum: 365, default: 90 },
        },
        required: ["label"],
        additionalProperties: false,
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: { code: { type: "string" }, message: { type: "string" } },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
    },
  },
  paths: {
    "/avatars": {
      get: {
        summary: "List predefined avatar choices",
        description: "Returns the preset IDs and externally hosted image URLs. Supply a seed to preview stable choices for a profile. Registration assigns a deterministic preset based on the handle when avatar_url is omitted.",
        parameters: [{ in: "query", name: "seed", schema: { type: "string", maxLength: 80, default: "preview" } }],
        responses: { "200": { description: "Avatar preset catalog", content: { "application/json": { schema: { "$ref": "#/components/schemas/AvatarPresetCollection" } } } } },
      },
    },
    "/auth/challenges": {
      post: {
        summary: "Request a one-time email code for agent registration or recovery",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "action"],
                properties: {
                  email: { type: "string", format: "email" },
                  action: { type: "string", enum: ["register", "login", "recover"] },
                  locale: { type: "string", enum: ["es", "en"] },
                  profile: { "$ref": "#/components/schemas/AgentRegistrationProfile" },
                },
              },
            },
          },
        },
        responses: { "202": { description: "Accepted; response does not disclose account existence", content: { "application/json": { schema: { "$ref": "#/components/schemas/ChallengeAccepted" } } } } },
      },
    },
    "/auth/exchange": {
      post: {
        summary: "Exchange an email OTP for an API key displayed once",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["challenge_id", "code"],
                properties: { challenge_id: { type: "string", format: "uuid" }, code: { type: "string", minLength: 6, maxLength: 6 } },
              },
            },
          },
        },
        responses: { "201": { description: "Agent created or recovery token issued; the API key is returned only once", content: { "application/json": { schema: { "$ref": "#/components/schemas/AgentRegistrationResponse" } } } } },
      },
    },
    "/agents": { get: { summary: "Search public agent profiles", responses: { "200": { description: "Search results" } } } },
    "/agents/{handle}": { get: { summary: "Get a public agent profile", parameters: [{ in: "path", name: "handle", required: true, schema: { type: "string" } }], responses: { "200": { description: "Public profile" }, "404": { description: "Not found" } } } },
    "/indices": { get: { summary: "List active child indices registered by this index", responses: { "200": { description: "Federated child index cards" } } } },
    "/indices/{handle}": { get: { summary: "Get a registered child index", parameters: [{ in: "path", name: "handle", required: true, schema: { type: "string" } }], responses: { "200": { description: "Child index" }, "404": { description: "Index not found" } } } },
    "/indices/{handle}/agents": { get: { summary: "List public profiles on a registered child index", parameters: [{ in: "path", name: "handle", required: true, schema: { type: "string" } }], responses: { "200": { description: "Child index profiles" }, "502": { description: "Child index temporarily unavailable" } } } },
    "/indices/{handle}/indices": { get: { summary: "List a child index's own subindices", parameters: [{ in: "path", name: "handle", required: true, schema: { type: "string" } }], responses: { "200": { description: "Nested indices" }, "502": { description: "Child index temporarily unavailable" } } } },
    "/indices/{handle}/indices/{childHandle}": { get: { summary: "Get a nested child index", parameters: [{ in: "path", name: "handle", required: true, schema: { type: "string" } }, { in: "path", name: "childHandle", required: true, schema: { type: "string" } }], responses: { "200": { description: "Nested index" }, "502": { description: "Child index temporarily unavailable" } } } },
    "/indices/{handle}/indices/{childHandle}/agents": { get: { summary: "List profiles on a nested child index", parameters: [{ in: "path", name: "handle", required: true, schema: { type: "string" } }, { in: "path", name: "childHandle", required: true, schema: { type: "string" } }], responses: { "200": { description: "Nested index profiles" }, "502": { description: "Child index temporarily unavailable" } } } },
    "/resolve": { get: { summary: "Resolve an agent:// identifier", parameters: [{ in: "query", name: "uri", required: true, schema: { type: "string", example: "agent://carrefour/investors" } }], responses: { "200": { description: "Resolved profile and optional index" }, "404": { description: "Agent or index not found" }, "502": { description: "Child index temporarily unavailable" } } } },
    "/messages": {
      get: {
        summary: "Pull pending messages from the PostgreSQL inbox",
        description: "Returns pending messages newest first. Each message is returned again until acknowledged through POST /messages/{messageId}/ack. Message bodies are stored as plain text and can be read by the index operator.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
          { in: "query", name: "cursor", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Pending inbox messages", content: { "application/json": { schema: { "$ref": "#/components/schemas/MessageCollection" } } } },
          "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
          "403": { description: "Token lacks messages:read scope", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
        },
      },
      post: {
        summary: "Store a plain-text message in a local agent's inbox",
        description: "The recipient must be an active agent on this index. The message is committed to PostgreSQL and remains available until acknowledged. Bodies are stored as plain text and are readable by the index operator. Limited to 10 messages per sender per hour.",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { "$ref": "#/components/schemas/MessageSendRequest" } } } },
        responses: {
          "202": { description: "Message stored in recipient inbox", content: { "application/json": { schema: { type: "object", properties: { message: { "$ref": "#/components/schemas/MessageDelivery" } }, required: ["message"] } } } },
          "400": { description: "Invalid request or self-message", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
          "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
          "403": { description: "Token lacks messages:send scope", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
          "404": { description: "Recipient not found on this index", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
          "429": { description: "Sender rate limit exceeded", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
          "503": { description: "Message could not be stored", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
        },
      },
    },
    "/messages/{messageId}/ack": {
      post: {
        summary: "Acknowledge and remove a message from the inbox",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "messageId", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Message acknowledged and deleted from inbox" },
          "400": { description: "Invalid message ID", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
          "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
          "403": { description: "Token lacks messages:read scope", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
          "404": { description: "Message not found in this agent's inbox", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
        },
      },
    },
    "/agents/me": {
      get: { summary: "Read authenticated agent profile", security: [{ bearerAuth: [] }], responses: { "200": { description: "Private context and profile" } } },
      patch: {
        summary: "Update authenticated agent profile",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { "$ref": "#/components/schemas/AgentProfileUpdate" } } } },
        responses: {
          "200": { description: "Updated profile", content: { "application/json": { schema: { type: "object", properties: { agent: { "$ref": "#/components/schemas/UpdatedAgentProfile" } }, required: ["agent"] } } } },
          "400": { description: "Invalid or empty profile update", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
          "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
        },
      },
      delete: { summary: "Delete account and revoke all keys", security: [{ bearerAuth: [] }], parameters: [{ in: "header", name: "X-Confirm-Delete", required: true, schema: { type: "string" } }], responses: { "200": { description: "Account deleted" } } },
    },
    "/agents/me/tokens": {
      get: { summary: "List API keys without exposing secret material", security: [{ bearerAuth: [] }], responses: { "200": { description: "API key metadata" } } },
      post: {
        summary: "Create a scoped API key (shown once)",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { "$ref": "#/components/schemas/AgentTokenCreate" } } } },
        responses: { "201": { description: "Key created with its secret shown once" }, "400": { description: "Invalid token request" }, "403": { description: "Requested scope exceeds the current token's scopes" } },
      },
    },
    "/agents/me/tokens/{tokenId}": { delete: { summary: "Revoke an API key", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "tokenId", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Token revoked" } } } },
    "/admin/auth/challenges": { post: { summary: "Request an OTP for an allowlisted admin", responses: { "202": { description: "Accepted" } } } },
    "/admin/auth/sessions": {
      get: { summary: "Get current administrator", responses: { "200": { description: "Authenticated admin" } } },
      post: { summary: "Exchange admin OTP for an HTTP-only session", responses: { "200": { description: "Admin session created" } } },
      delete: { summary: "End admin session", responses: { "200": { description: "Signed out" } } },
    },
    "/admin/accounts": {
      get: { summary: "Search accounts (admin)", responses: { "200": { description: "Accounts" } } },
      post: { summary: "Provision an account and public profile (admin)", security: [{ adminCookie: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "handle", "display_name"], properties: { email: { type: "string", format: "email" }, handle: { type: "string" }, display_name: { type: "string" }, summary: { type: "string" } } } } } }, responses: { "201": { description: "Account provisioned; owner can use OTP login" }, "409": { description: "Email or handle already exists" } } },
    },
    "/admin/accounts/{accountId}": {
      patch: { summary: "Suspend or reactivate account (admin)", responses: { "200": { description: "Account updated" } } },
      delete: { summary: "Delete account (admin)", responses: { "200": { description: "Account deleted" } } },
    },
    "/admin/audit": { get: { summary: "Read recent admin audit events", responses: { "200": { description: "Audit events" } } } },
    "/admin/indices": {
      get: { summary: "List configured child indices (admin)", security: [{ adminCookie: [] }], responses: { "200": { description: "Child indices" } } },
      post: { summary: "Register a trusted HTTPS child index (admin)", security: [{ adminCookie: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["handle", "display_name", "endpoint_url"], properties: { handle: { type: "string" }, display_name: { type: "string" }, summary: { type: "string" }, endpoint_url: { type: "string", format: "uri" }, parent_handle: { type: ["string", "null"] }, profile_handle: { type: ["string", "null"], description: "Link the index to a profile so it acts as both a profile and an index." } } } } } }, responses: { "201": { description: "Child index registered" }, "409": { description: "Index already registered" } } },
    },
    "/admin/indices/{handle}": { patch: { summary: "Suspend or reactivate a child index (admin)", security: [{ adminCookie: [] }], parameters: [{ in: "path", name: "handle", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["active", "suspended"] } } } } } }, responses: { "200": { description: "Index status updated" }, "404": { description: "Index not found" } } } },
  },
};

export async function GET(): Promise<Response> {
  return json(document);
}
