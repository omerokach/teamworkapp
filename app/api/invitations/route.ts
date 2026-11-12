import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getApiContext, apiError, unauthorized } from "../../../lib/api-context";
import { normalizeEmail, ownerEmail, sameOrigin } from "../../../lib/access";
import { getAuth } from "../../../lib/auth/server";
import { users, workspaceAccess, workspaceSettings } from "../../../db/schema";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const context = await getApiContext();
    if (!context) return unauthorized();
    if (!context.isAdmin) return Response.json({ error: "Owner access required." }, { status: 403 });
    const invitations = await context.db.select().from(workspaceAccess).orderBy(desc(workspaceAccess.createdAt));
    const profiles = await context.db.select({ email: users.email, displayName: users.displayName }).from(users);
    return Response.json({ invitations: invitations.map(i => ({ ...i, displayName: profiles.find(p => p.email === i.email)?.displayName ?? "" })) });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const context = await getApiContext();
    if (!context) return unauthorized();
    if (!context.isAdmin) return Response.json({ error: "Only the owner can invite people." }, { status: 403 });
    const body = await request.json() as { email?: unknown };
    const parsed = z.string().email().max(254).safeParse(body.email);
    if (!parsed.success) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    const email = normalizeEmail(parsed.data);
    if (email === ownerEmail()) return Response.json({ error: "You already own this workspace." }, { status: 400 });
    const [existing] = await context.db.select().from(workspaceAccess).where(eq(workspaceAccess.email, email));
    if (existing?.status === "active") return Response.json({ error: "This person already has access." }, { status: 409 });
    const auth = getAuth();
    let [settings] = await context.db.select().from(workspaceSettings).where(eq(workspaceSettings.key, "organization"));
    if (!settings) {
      const listed = await auth.organization.list();
      if (listed.error) throw new Error("Could not load workspace invitations.");
      let org = listed.data?.find(o => o.slug === "relaydesk-teamworkapp");
      if (!org) {
        const result = await auth.organization.create({ name: "RelayDesk", slug: "relaydesk-teamworkapp" });
        if (result.error || !result.data) throw new Error("Could not initialize workspace invitations.");
        org = result.data;
      }
      await context.db.insert(workspaceSettings).values({ key: "organization", value: org.id }).onConflictDoNothing();
      [settings] = await context.db.select().from(workspaceSettings).where(eq(workspaceSettings.key, "organization"));
    }
    const result = await auth.organization.inviteMember({ email, role: "member", organizationId: settings.value, resend: true });
    if (result.error || !result.data) return Response.json({ error: "The invitation email could not be sent. Please try again." }, { status: 502 });
    const values = { email, status: "invited" as const, invitationId: result.data.id, expiresAt: new Date(result.data.expiresAt).toISOString() };
    await context.db.insert(workspaceAccess).values(values).onConflictDoUpdate({ target: workspaceAccess.email, set: values });
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const context = await getApiContext();
    if (!context) return unauthorized();
    if (!context.isAdmin) return Response.json({ error: "Owner access required." }, { status: 403 });
    const body = await request.json() as { email?: unknown };
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    if (!email || email === ownerEmail()) return Response.json({ error: "Invalid request" }, { status: 400 });
    await context.db.update(workspaceAccess).set({ status: "revoked" }).where(eq(workspaceAccess.email, email));
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
