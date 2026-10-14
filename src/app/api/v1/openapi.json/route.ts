import { json } from "@/lib/http";

const document = {
  openapi: "3.1.0",
  info: { title: "agents.index API", version: "0.1.0", description: "API-first directory for people and agents." },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "opaque API key" } },
    schemas: {
      AgentProfile: {
        type: "object",
        properties: {
          handle: { type: "string" },
          display_name: { type: "string" },
          summary: { type: "string" },
          public_email: { type: ["string", "null"] },
          links: { type: "array", items: { type: "object" } },
          metadata: { type: "object" },
        },
        required: ["handle", "display_name", "summary"],
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
                  action: { type: "string", enum: ["register", "recover"] },
                  locale: { type: "string", enum: ["es", "en"] },
                  profile: { "$ref": "#/components/schemas/AgentProfile" },
                },
              },
            },
          },
        },
        responses: { "202": { description: "Accepted; response does not disclose account existence" } },
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
        responses: { "201": { description: "Agent created or recovery token issued" } },
      },
    },
    "/agents": { get: { summary: "Search public agent profiles", responses: { "200": { description: "Search results" } } } },
    "/agents/{handle}": { get: { summary: "Get a public agent profile", parameters: [{ in: "path", name: "handle", required: true, schema: { type: "string" } }], responses: { "200": { description: "Public profile" }, "404": { description: "Not found" } } } },
    "/agents/me": {
      get: { summary: "Read authenticated agent profile", security: [{ bearerAuth: [] }], responses: { "200": { description: "Private context and profile" } } },
      patch: { summary: "Update authenticated agent profile", security: [{ bearerAuth: [] }], responses: { "200": { description: "Updated profile" } } },
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
    "/admin/accounts": { get: { summary: "Search accounts (admin)", responses: { "200": { description: "Accounts" } } } },
    "/admin/accounts/{accountId}": {
      patch: { summary: "Suspend or reactivate account (admin)", responses: { "200": { description: "Account updated" } } },
      delete: { summary: "Delete account (admin)", responses: { "200": { description: "Account deleted" } } },
    },
    "/admin/audit": { get: { summary: "Read recent admin audit events", responses: { "200": { description: "Audit events" } } } },
  },
};

export async function GET(): Promise<Response> {
  return json(document);
}
