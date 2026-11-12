import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { workspaceAccess } from "../db/schema";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export function ownerEmail() {
  return normalizeEmail(process.env.RELAYDESK_OWNER_EMAIL ?? "");
}
export async function allowedEmail(email: string) {
  email = normalizeEmail(email);
  if (ownerEmail() && email === ownerEmail()) return true;
  const db = await getDb();
  const [access] = await db.select().from(workspaceAccess).where(eq(workspaceAccess.email, email));
  return !!access && (access.status === "active" || (access.status === "invited" && new Date(access.expiresAt).getTime() > Date.now()));
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}
