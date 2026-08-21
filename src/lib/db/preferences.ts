import { desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { syncRuns as syncRunsTable, userPreferences as preferencesTable } from "./schema";
import { createId } from "../types";

export type UserPreferences = {
  autoSync: boolean;
  initialized: boolean;
  useDemoEvents: boolean;
};

const DEFAULT_PREFERENCES: UserPreferences = {
  autoSync: true,
  initialized: false,
  useDemoEvents: false,
};

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const db = getDb();
  const row = await db.query.userPreferences.findFirst({
    where: eq(preferencesTable.userId, userId),
  });

  if (!row) {
    return DEFAULT_PREFERENCES;
  }

  return {
    autoSync: row.autoSync,
    initialized: row.initialized,
    useDemoEvents: row.useDemoEvents,
  };
}

export async function upsertUserPreferences(
  userId: string,
  input: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const db = getDb();
  const current = await getUserPreferences(userId);
  const next = { ...current, ...input };
  const now = new Date().toISOString();

  await db
    .insert(preferencesTable)
    .values({
      userId,
      autoSync: next.autoSync,
      initialized: next.initialized,
      useDemoEvents: next.useDemoEvents,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: preferencesTable.userId,
      set: {
        autoSync: next.autoSync,
        initialized: next.initialized,
        useDemoEvents: next.useDemoEvents,
        updatedAt: now,
      },
    });

  return next;
}

export type SyncRunRecord = {
  id: string;
  rangeStart: string;
  rangeEnd: string;
  scheduledCount: number;
  unscheduledCount: number;
  pushedCreated: number;
  pushedUpdated: number;
  syncedAt: string;
};

export async function recordSyncRun(
  userId: string,
  input: Omit<SyncRunRecord, "id">,
): Promise<SyncRunRecord> {
  const db = getDb();
  const id = createId();

  await db.insert(syncRunsTable).values({
    id,
    userId,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    scheduledCount: input.scheduledCount,
    unscheduledCount: input.unscheduledCount,
    pushedCreated: input.pushedCreated,
    pushedUpdated: input.pushedUpdated,
    syncedAt: input.syncedAt,
  });

  return { id, ...input };
}

export async function listSyncRuns(userId: string, limit = 20): Promise<SyncRunRecord[]> {
  const db = getDb();
  const rows = await db.query.syncRuns.findMany({
    where: eq(syncRunsTable.userId, userId),
    orderBy: [desc(syncRunsTable.syncedAt)],
    limit,
  });

  return rows.map((row) => ({
    id: row.id,
    rangeStart: row.rangeStart,
    rangeEnd: row.rangeEnd,
    scheduledCount: row.scheduledCount,
    unscheduledCount: row.unscheduledCount,
    pushedCreated: row.pushedCreated,
    pushedUpdated: row.pushedUpdated,
    syncedAt: row.syncedAt,
  }));
}

export async function getLatestSyncRun(userId: string): Promise<SyncRunRecord | null> {
  const runs = await listSyncRuns(userId, 1);
  return runs[0] ?? null;
}
