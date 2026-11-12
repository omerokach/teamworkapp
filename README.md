# RelayDesk

RelayDesk is a lightweight shared workspace for a small team. It keeps tasks,
owners, comments, decisions, and recent activity together so action items do
not disappear inside chat threads.

## Stack

- Next.js 16 and React 19
- Drizzle ORM
- Neon serverless Postgres
- Neon Auth for verified email sign-in and invitation emails
- Vercel hosting

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to a Neon
   Postgres connection string.
3. Start the app with `npm run dev`.

The app creates its tables and indexes on the first API request. A generated
Drizzle migration is also kept in `drizzle/` for teams that prefer an explicit
migration workflow.

## Checks

- `npm run typecheck` — verify TypeScript
- `npm run build` — create the production Next.js build
- `npm run db:generate` — regenerate a migration after schema changes
- `npm run db:push` — push the current schema to the configured database

## Deploy to Vercel

1. Create or link the Vercel project.
2. Add a Neon Postgres resource from the Vercel Marketplace and connect it to
   the project. The integration supplies `DATABASE_URL` automatically.
3. Deploy the repository as a Next.js project.
4. Open the production URL once; RelayDesk initializes the empty database and
   creates the starter workspace.

Access is invitation-only. Set `RELAYDESK_OWNER_EMAIL` in Vercel to the owner's
email address, `NEON_AUTH_BASE_URL` to the project's Auth URL, and
`NEON_AUTH_COOKIE_SECRET` to a cryptographically random value of at least 32
characters. Keep the secret in Vercel's secret environment variables.

In Neon Auth settings, trust the app's production URL, require email verification,
and enable organization invitation emails. The owner signs in with an email
code, chooses a name, and invites partners from Team. Invited partners verify
their email, choose a name, and share the board with their own My tasks view.
Only the owner can send invitations or revoke access. Revocation is checked on
every app API request. Legacy guest identity headers are no longer accepted.
