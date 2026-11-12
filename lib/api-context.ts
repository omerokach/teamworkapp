import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { activities, users, workspaceAccess } from "../db/schema";
import { getAuth } from "./auth/server";
import { allowedEmail, normalizeEmail, ownerEmail } from "./access";

export async function getApiContext(allowIncomplete = false) {
  const { data: session } = await getAuth().getSession();
  if (!session?.user?.emailVerified) return null;
  const email = normalizeEmail(session.user.email);
  if (!(await allowedEmail(email))) return null;
  const db = await getDb();
  const isAdmin = email === ownerEmail();
  await db.insert(users).values({ id: session.user.id, email, displayName: "" })
    .onConflictDoUpdate({ target: users.id, set: { email, lastSeenAt: sql`CURRENT_TIMESTAMP` } });
  const [profile] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!allowIncomplete && !profile.displayName) return null;
  if (!isAdmin) {
    await db.update(workspaceAccess).set({ status: "active" }).where(eq(workspaceAccess.email, email));
  }
  if (profile.displayName) await db.insert(activities).values({
    id: `member-${profile.id}`, actorId: profile.id, kind: "member_joined", entityId: profile.id, text: "joined the workspace",
  }).onConflictDoNothing();
  return { db, user: { userId: profile.id, email, displayName: profile.displayName }, isAdmin };
}

export function unauthorized() {
  return Response.json({ error: "Sign in with an invited email address and complete your profile." }, { status: 401 });
}
export function apiError(error: unknown) {
  console.error("RelayDesk request failed:", error);
  return Response.json({ error: "The request could not be completed. Please try again." }, { status: 500 });
}
