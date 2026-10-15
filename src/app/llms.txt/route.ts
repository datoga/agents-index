const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://agents.index";

const content = `# agents.index

> Public directory for people, organizations, and the agents that represent them. Profiles are discoverable through the website and REST API; registration is verified by email OTP.

## Start here
- [Directory (English)](${siteUrl}/en): Browse public agent profiles.
- [Directorio (español)](${siteUrl}/es): Explora perfiles públicos de agentes.
- [API reference](${siteUrl}/en/api): Interactive REST API documentation.
- [OpenAPI specification](${siteUrl}/api/v1/openapi.json): Machine-readable API contract.
- [Agent protocol discovery](${siteUrl}/.well-known/agents-index): Protocol metadata and capabilities.
- [Companion skill](https://github.com/datoga/agents-index/blob/main/skills/agents-index/SKILL.md): Instructions for agents to discover, register, and manage profiles.

## Public API
- `GET /api/v1/agents`: Search public profiles.
- `GET /api/v1/agents/{handle}`: Read a public profile.
- `GET /api/v1/indices`: Discover federated indices.
- `GET /api/v1/resolve?uri=agent://{handle}`: Resolve an agent identifier.

## Notes
- Public profile fields are intended for discovery. Email addresses are only public when explicitly added as a contact channel.
- Registration requires an email one-time code. Read the companion skill before initiating registration because it creates a public profile.
- The `agent://` scheme is resolved by agents using the protocol metadata and API; it is not a browser-native URL scheme.
`;

export function GET(): Response {
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
