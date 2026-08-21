import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

let client: Client | null = null;
let database: LibSQLDatabase<typeof schema> | null = null;
let migrationPromise: Promise<void> | null = null;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "TURSO_DATABASE_URL is required in production. Run: bash scripts/setup-turso.sh",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

function isServerlessProduction(): boolean {
  return Boolean(process.env.VERCEL) && process.env.NODE_ENV === "production";
}

function getDatabaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }

  if (isServerlessProduction()) {
    throw new DatabaseNotConfiguredError();
  }

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return `file:${path.join(dataDir, "yotei.db")}`;
}

function getAuthToken(): string | undefined {
  return process.env.TURSO_AUTH_TOKEN || undefined;
}

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: getDatabaseUrl(),
      authToken: getAuthToken(),
    });
  }
  return client;
}

export function getDb(): LibSQLDatabase<typeof schema> {
  if (!database) {
    database = drizzle(getClient(), { schema });
  }
  return database;
}

async function runMigrations() {
  const dbClient = getClient();

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_sub TEXT UNIQUE,
      email TEXT,
      name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      auto_sync INTEGER NOT NULL DEFAULT 1,
      initialized INTEGER NOT NULL DEFAULT 0,
      use_demo_events INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      preferred_time TEXT NOT NULL,
      days_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      total_minutes INTEGER NOT NULL,
      deadline TEXT NOT NULL,
      chunk_minutes INTEGER NOT NULL,
      priority INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS sync_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      range_start TEXT NOT NULL,
      range_end TEXT NOT NULL,
      scheduled_count INTEGER NOT NULL DEFAULT 0,
      unscheduled_count INTEGER NOT NULL DEFAULT 0,
      pushed_created INTEGER NOT NULL DEFAULT 0,
      pushed_updated INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbClient.execute(
    `CREATE INDEX IF NOT EXISTS habits_user_id_idx ON habits(user_id)`,
  );
  await dbClient.execute(
    `CREATE INDEX IF NOT EXISTS goals_user_id_idx ON goals(user_id)`,
  );
  await dbClient.execute(
    `CREATE INDEX IF NOT EXISTS subtasks_goal_id_idx ON subtasks(goal_id)`,
  );
  await dbClient.execute(
    `CREATE INDEX IF NOT EXISTS sync_runs_user_id_idx ON sync_runs(user_id)`,
  );
}

export async function ensureDbReady() {
  if (!migrationPromise) {
    migrationPromise = runMigrations();
  }
  await migrationPromise;
}
