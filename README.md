# RelayDesk

RelayDesk is a lightweight shared workspace for a small team. It keeps tasks,
owners, comments, decisions, and recent activity together so action items do
not disappear inside chat threads.

## Stack

- Next.js 16 and React 19
- Drizzle ORM
- Neon serverless Postgres
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

The app is intentionally passwordless. A visitor chooses a display name, and
the browser remembers a generated guest ID. Anyone who has the production link
can read and change the shared workspace, so do not store confidential data in
this version.
