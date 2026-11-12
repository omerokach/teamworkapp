import { eq } from "drizzle-orm";
import { getApiContext, apiError, unauthorized } from "../../../lib/api-context";
import { sameOrigin } from "../../../lib/access";
import { users } from "../../../db/schema";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const context = await getApiContext(true);
    if (!context) return unauthorized();
    return Response.json({ user: { id: context.user.userId, email: context.user.email, displayName: context.user.displayName }, isAdmin: context.isAdmin });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const context = await getApiContext(true);
    if (!context) return unauthorized();
    const payload = await request.json() as { displayName?: unknown };
    const name = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
    if (!name || name.length > 60) return Response.json({ error: "Enter a name between 1 and 60 characters." }, { status: 400 });
    await context.db.update(users).set({ displayName: name }).where(eq(users.id, context.user.userId));
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
