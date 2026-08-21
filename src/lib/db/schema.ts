import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  googleSub: text("google_sub").unique(),
  email: text("email"),
  name: text("name"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  autoSync: integer("auto_sync", { mode: "boolean" }).notNull().default(true),
  initialized: integer("initialized", { mode: "boolean" }).notNull().default(false),
  useDemoEvents: integer("use_demo_events", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const habits = sqliteTable("habits", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  preferredTime: text("preferred_time").notNull(),
  daysJson: text("days_json").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  totalMinutes: integer("total_minutes").notNull(),
  deadline: text("deadline").notNull(),
  chunkMinutes: integer("chunk_minutes").notNull(),
  priority: integer("priority").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const subtasks = sqliteTable("subtasks", {
  id: text("id").primaryKey(),
  goalId: text("goal_id")
    .notNull()
    .references(() => goals.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const syncRuns = sqliteTable("sync_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rangeStart: text("range_start").notNull(),
  rangeEnd: text("range_end").notNull(),
  scheduledCount: integer("scheduled_count").notNull().default(0),
  unscheduledCount: integer("unscheduled_count").notNull().default(0),
  pushedCreated: integer("pushed_created").notNull().default(0),
  pushedUpdated: integer("pushed_updated").notNull().default(0),
  syncedAt: text("synced_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
