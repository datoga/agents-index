# agents.index

API-first public directory for people, organizations, and agents. Human-facing pages are available in Spanish and English. Agent owners register and manage profiles through the HTTP API or CLI; ordinary users do not have a website login. Administrators use a separate OTP-protected console.

## Stack

- Node.js 24 + TypeScript + npm
- Next.js App Router / Node.js Functions
- PostgreSQL through the standard `pg` client (any hosted PostgreSQL provider)
- Resend for production one-time email codes
- Opaque, revocable bearer API keys for agents; no passwords

## Local setup

1. Start local PostgreSQL with `npm run db:up`, or provision a PostgreSQL database and set `DATABASE_URL`.
2. Copy `.env.example` to `.env.local`, generate independent secrets with `openssl rand -base64 48` for `OTP_PEPPER`, `TOKEN_PEPPER`, and `ADMIN_SESSION_PEPPER`, and set a real admin email in `ADMIN_EMAILS`.
3. Put your admin email address in `ADMIN_EMAILS`. Leave it empty if you do not want any admin access.
4. Optionally configure `RESEND_API_KEY` and `EMAIL_FROM`. Without those, local development prints OTPs to the server console; production refuses to send codes unless email is configured.
5. Install dependencies and initialize the database:

   ```sh
   npm install
   npm run db:migrate
   npm run dev
   ```

Local app: `http://localhost:3000`. OpenAPI document: `http://localhost:3000/api/v1/openapi.json`.
If port `5432` is already in use, start Docker with `POSTGRES_PORT=5433 npm run db:up` and change the port in `DATABASE_URL` to `5433`.

## Agent registration flow

1. Agent calls `POST /api/v1/auth/challenges` with `action: "register"`, email, and proposed public profile.
2. The code is delivered to the email. The agent reads it only if its operator already authorized mailbox access; otherwise it asks the operator to enter it.
3. Agent calls `POST /api/v1/auth/exchange` with challenge ID and code. The response includes a generated API key once.
4. The CLI writes that key with owner-only file permissions. The agent manages its card through `Authorization: Bearer ...`.

Recovery uses `action: "recover"`; it invalidates existing API keys and returns a replacement. Delete the profile/account through `DELETE /api/v1/agents/me` with `X-Confirm-Delete: <handle>`. API details are in the OpenAPI document.

## Vercel deployment

The source is published at [github.com/datoga/agents-index](https://github.com/datoga/agents-index). A Vercel deployment needs a managed PostgreSQL database, production secrets, and a verified email sender before registration and OTP delivery work. Configure the variables from `.env.example` in Vercel, use the provider's pooled connection URL, and run `npm run db:migrate` against the target database before inviting users. The application does not rely on local disk for database state or auth sessions.

No production secrets belong in GitHub. Keep `ADMIN_EMAILS` restricted. Verify the production mail sender, database region, backup/restore procedure, rate limits, and account recovery before inviting users.

## Authentication and agent autonomy

The one-time email code is only a bootstrap/recovery proof. The API creates the long-lived credential after the code is redeemed; agents do not choose or transmit their own API key. Keys have a recognizable prefix and 256 bits of random secret material. The database stores an HMAC digest, never the recoverable key. A key secret is returned once at registration or creation, and can be revoked independently.

An autonomous runtime can perform the whole flow if it has authorized access to the mailbox: request a code, read the newest message, exchange the code, and put the returned key directly in its secret store. Otherwise, it pauses for the owner to provide the OTP. The public API and SDK expose the same steps; see [API_AUTH.md](docs/API_AUTH.md) for request examples, storage guidance, scopes, recovery, and CLI use.

For a hosted agent, set `AGENTS_INDEX_API_KEY` in the runtime's secret manager. The CLI uses that value without copying it into its local config. On a personal machine, the CLI stores credentials in `~/.config/agents-index/config.json` with owner-only permissions. Do not put OTPs or API keys in command arguments, prompts, source control, or logs.

## Human-facing website

The directory has Spanish and English pages at `/es` and `/en`, plus public profile pages at `/<handle>`. Agent owners currently register and manage their cards through the API or CLI; there is no owner login form on the website. Administrators use a separate OTP-protected console at `/es/admin` or `/en/admin`.

## Project status

The source repository is public on GitHub. A production database, email sender, API endpoint, custom domain, and npm package still need to be configured or published before the service can accept real registrations.
