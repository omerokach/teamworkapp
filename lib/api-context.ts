import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../db";
import { activities, users } from "../db/schema";

export async function getApiContext() {
  const requestHeaders = await headers();
  const guestId = requestHeaders.get("x-relaydesk-guest-id")?.trim() ?? "";
  const encodedGuestName =
    requestHeaders.get("x-relaydesk-guest-name")?.trim() ?? "";
  const guestName = safeDecode(encodedGuestName).slice(0, 60);
  const validGuest =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      guestId,
    ) && guestName.length > 0;

  const user = validGuest
    ? {
        userId: guestId,
        email: `${guestId}@relaydesk.local`,
        displayName: guestName,
        fullName: guestName,
      }
    : null;
  if (!user) return null;

  const db = await getDb();
  await db
    .insert(users)
    .values({
      id: user.userId,
      email: user.email,
      displayName: user.displayName,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        displayName: user.displayName,
        lastSeenAt: sql`CURRENT_TIMESTAMP`,
      },
    });

  await db
    .insert(activities)
    .values({
      id: `member-${user.userId}`,
      actorId: user.userId,
      kind: "member_joined",
      entityId: user.userId,
      text: "joined the workspace",
    })
    .onConflictDoNothing();

  return { db, user };
}

export function unauthorized() {
  return Response.json(
    { error: "Choose a display name to enter the workspace." },
    { status: 401 },
  );
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}
