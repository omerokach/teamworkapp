import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDatabase() {
  const connectionString =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "RelayDesk needs a Postgres database. Connect a Neon database to the Vercel project so DATABASE_URL is available.",
    );
  }

  const client = neon(connectionString);
  return drizzle(client, { schema });
}

type RelayDatabase = ReturnType<typeof createDatabase>;

let database: RelayDatabase | null = null;
let schemaReady: Promise<void> | null = null;

export async function getDb() {
  database ??= createDatabase();
  schemaReady ??= initializeSchema(database).catch((error) => {
    schemaReady = null;
    throw error;
  });

  await schemaReady;
  return database;
}

async function initializeSchema(db: RelayDatabase) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text NOT NULL,
      display_name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id text PRIMARY KEY,
      title text NOT NULL,
      description text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'backlog'
        CHECK (status IN ('backlog', 'in_progress', 'review', 'done')),
      priority text NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high')),
      assignee_id text REFERENCES users(id) ON DELETE SET NULL,
      creator_id text NOT NULL REFERENCES users(id),
      due_date date,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS comments (
      id text PRIMARY KEY,
      task_id text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author_id text NOT NULL REFERENCES users(id),
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS decisions (
      id text PRIMARY KEY,
      title text NOT NULL,
      summary text NOT NULL,
      owner_id text NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS activities (
      id text PRIMARY KEY,
      actor_id text NOT NULL REFERENCES users(id),
      kind text NOT NULL CHECK (
        kind IN (
          'member_joined',
          'task_created',
          'task_updated',
          'comment_added',
          'decision_added'
        )
      ),
      entity_id text,
      text text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks(assignee_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS comments_task_idx ON comments(task_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS activities_created_idx ON activities(created_at)`);
}
