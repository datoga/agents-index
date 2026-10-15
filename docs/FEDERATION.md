# agents.index federation protocol (draft 0.1)

This is an open, opt-in federation model. An index is a self-hosted agents.index-compatible service with its own operator, database, account policy, and API origin. Parent indexes publish explicitly registered child indexes and resolve public cards from them. A parent relationship is a discovery link; it does not transfer account ownership or make the parent a global authority.

## Discovery document

Every implementation should expose `GET /.well-known/agents-index` as JSON. This implementation returns:

```json
{
  "protocol": "agents-index/1",
  "name": "Company directory",
  "handle": "company",
  "url": "https://agents.example",
  "parent_index_url": "https://agents.index",
  "registration": { "mode": "domain" },
  "api": {
    "base_url": "https://agents.example/api/v1",
    "openapi_url": "https://agents.example/api/v1/openapi.json"
  },
  "agent_uri": "agent://{handle}[/{handle}...]",
  "capabilities": ["profiles", "federated-indices", "agent-uri-resolution", "directional-links", "email-otp"]
}
```

## URI resolution

- `agent://<handle>` identifies a profile on the index doing the resolution.
- `agent://<index-handle>/<handle>` identifies a profile on a child index registered by the current index.
- Additional path segments traverse nested child indexes. For example, `agent://company/investors/quarterly-reports` resolves through the `company` index, then its `investors` child index, and finally to `quarterly-reports`.
- `GET /api/v1/resolve?uri=<encoded-agent-uri>` returns `{ "uri", "agent", "index" }`.
- `GET /api/v1/indices` lists active children; `GET /api/v1/indices/<index-handle>` describes one child.
- `GET /api/v1/indices/<index-handle>/agents` proxies the child's public profile list.
- `GET /api/v1/indices/<index-handle>/indices` lists the child's own children; nested profile lists are available through `/api/v1/indices/<index-handle>/indices/<child-handle>/agents`.

The URI is an identifier resolved by an agents.index implementation; browsers do not natively open the `agent:` scheme. Implementations should link to a local resolver page or API rather than assume an OS handler exists. URI hosts and path segments are stable handles, not arbitrary URLs. This implementation supports up to five path segments.

## Trust and federation

A child index operator sets `INDEX_HANDLE` to the handle its parent will use and `PARENT_INDEX_URL` to the parent's canonical HTTPS origin. The parent administrator then registers it with `POST /api/v1/admin/indices` using an HTTPS origin. The resolver fetches only origins stored in that table; URI input cannot supply a network destination. Operators should verify the child operator and domain before registering it, and suspend an index if it becomes unavailable or untrusted. HTTPS and public profile APIs are required in this version.

Example parent registration:

```json
{
  "handle": "carrefour",
  "display_name": "Carrefour",
  "summary": "Company directory and agent index",
  "endpoint_url": "https://agents.carrefour.example",
  "profile_handle": "carrefour"
}
```

The parent does not copy child profiles into its database. It fetches the public profile on resolution and lists child profiles through the child API. This keeps the child authoritative for its data and permits independent deployments. Root-to-child registration is explicit at each parent, and a child can itself publish children. Recursive discovery beyond each configured parent is intentionally not implicit.

## One-way aliases

A profile may include a link target using `agent://` and `type: "alias"`. The link only points from the card containing it to the target. The target is not modified and no reverse alias is inferred. Other link types are `social`, `website`, `service`, and `index`; HTTPS and HTTP external targets remain supported.

## Registration and authentication

Registration policy is local to each index:

- `email`: any mailbox can register after OTP verification.
- `domain`: exact email domains from `REGISTRATION_ALLOWED_DOMAINS` can register.
- `closed`: self-service registration is disabled; an administrator provisions an account and profile, then the owner uses OTP `login` to obtain an API key.

Public registration remains email-verified regardless of policy. `login` issues a new API key while keeping other keys valid; `recover` revokes existing keys. Administrators use their separate allowlisted OTP session.

## Current limitations

- Child-index registration is manually approved by the parent administrator; automatic domain proof and signed delegation are not yet part of the protocol.
- Child indexes must expose the same public Agents API. Pagination options are not forwarded by the initial parent index pages.
- Parent-child federation is discovery, not a consensus system. Independent indexes may have duplicate handles; URI scope disambiguates child profiles.
- The global registry is not cryptographically canonical. Any compatible operator can run an index; clients decide which parent registries they trust.
