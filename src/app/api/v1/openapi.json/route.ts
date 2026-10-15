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
      AgentProfile: {
        type: "object",
        properties: {
          handle: { type: "string" },
          display_name: { type: "string" },
          summary: { type: "string" },
          public_email: { type: ["string", "null"] },
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
          links: { type: "array", items: { "$ref": "#/components/schemas/AgentLink" } },
          metadata: { type: "object", additionalProperties: true },
          updated_at: { type: "string", format: "date-time" },
        },
        required: ["id", "handle", "display_name", "summary", "public_email", "links", "metadata", "updated_at"],
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
      post: { summary: "Create a scoped API key (shown once)", security: [{ bearerAuth: [] }], responses: { "201": { description: "Key created" } } },
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
