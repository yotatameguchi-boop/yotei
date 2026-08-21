import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { ensureDbReady, getDb } from "./db";
import { users } from "./db/schema";
import { createId } from "./types";

const SESSION_COOKIE = "yotei_session";

function getAuthSecret(): string {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }

  const host =
    process.env.VERCEL_URL ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ??
    "localhost";

  return `yotei-session-${host}`;
}

function encodeSession(userId: string): string {
  const data = Buffer.from(userId, "utf8").toString("base64url");
  const signature = Buffer.from(`${data}.${getAuthSecret()}`, "utf8").toString("base64url");
  return `${data}.${signature}`;
}

function decodeSession(value: string): string | null {
  const [data, signature] = value.split(".");
  if (!data || !signature) {
    return null;
  }

  const expected = Buffer.from(`${data}.${getAuthSecret()}`, "utf8").toString("base64url");
  if (signature !== expected) {
    return null;
  }

  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

async function readSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  return decodeSession(raw);
}

export type SessionUser = {
  id: string;
  googleSub: string | null;
  email: string | null;
  name: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  await ensureDbReady();
  const userId = await readSessionUserId();
  if (!userId) {
    return null;
  }

  const db = getDb();
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    googleSub: row.googleSub ?? null,
    email: row.email ?? null,
    name: row.name ?? null,
  };
}

export async function getOrCreateSessionUser(): Promise<SessionUser> {
  await ensureDbReady();
  const existing = await getSessionUser();
  if (existing) {
    return existing;
  }

  const db = getDb();
  const userId = createId();
  const now = new Date().toISOString();

  await db.insert(users).values({
    id: userId,
    createdAt: now,
    updatedAt: now,
  });

  await setSessionCookie(userId);

  return {
    id: userId,
    googleSub: null,
    email: null,
    name: null,
  };
}

export async function linkGoogleAccount(input: {
  googleSub: string;
  email?: string | null;
  name?: string | null;
}): Promise<SessionUser> {
  await ensureDbReady();
  const db = getDb();
  const current = await getOrCreateSessionUser();
  const now = new Date().toISOString();

  const existingGoogleUser = await db.query.users.findFirst({
    where: eq(users.googleSub, input.googleSub),
  });

  if (existingGoogleUser && existingGoogleUser.id !== current.id) {
    await mergeUserData(current.id, existingGoogleUser.id);
    await setSessionCookie(existingGoogleUser.id);

    await db
      .update(users)
      .set({
        email: input.email ?? existingGoogleUser.email,
        name: input.name ?? existingGoogleUser.name,
        updatedAt: now,
      })
      .where(eq(users.id, existingGoogleUser.id));

    return {
      id: existingGoogleUser.id,
      googleSub: input.googleSub,
      email: input.email ?? existingGoogleUser.email ?? null,
      name: input.name ?? existingGoogleUser.name ?? null,
    };
  }

  await db
    .update(users)
    .set({
      googleSub: input.googleSub,
      email: input.email ?? null,
      name: input.name ?? null,
      updatedAt: now,
    })
    .where(eq(users.id, current.id));

  return {
    id: current.id,
    googleSub: input.googleSub,
    email: input.email ?? null,
    name: input.name ?? null,
  };
}

async function mergeUserData(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    return;
  }

  const db = getDb();
  const { habits, goals, userPreferences, syncRuns } = await import("./db/schema");

  await db
    .update(habits)
    .set({ userId: toUserId, updatedAt: new Date().toISOString() })
    .where(eq(habits.userId, fromUserId));

  await db
    .update(goals)
    .set({ userId: toUserId, updatedAt: new Date().toISOString() })
    .where(eq(goals.userId, fromUserId));

  await db
    .update(syncRuns)
    .set({ userId: toUserId })
    .where(eq(syncRuns.userId, fromUserId));

  const sourcePrefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, fromUserId),
  });

  if (sourcePrefs) {
    const targetPrefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, toUserId),
    });

    if (!targetPrefs) {
      await db.insert(userPreferences).values({
        userId: toUserId,
        autoSync: sourcePrefs.autoSync,
        initialized: sourcePrefs.initialized,
        useDemoEvents: sourcePrefs.useDemoEvents,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  await db.delete(users).where(eq(users.id, fromUserId));
}
