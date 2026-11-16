import { and, eq, sql } from "drizzle-orm";
import { thoughts } from "../../../../db/schema";
import { apiError, getApiContext, unauthorized } from "../../../../lib/api-context";
import { sameOrigin } from "../../../../lib/access";
import { updateThoughtInput } from "../../../../lib/thought-input";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, route: RouteContext) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const context = await getApiContext();
    if (!context) return unauthorized();
    const input = updateThoughtInput.safeParse(await request.json().catch(() => null));
    if (!input.success) return Response.json({ error: "Use a non-empty thought (up to 3,000 characters) and notes up to 5,000 characters." }, { status: 400 });
    const { id } = await route.params;
    const { body, notes, discussed } = input.data;
    const [thought] = await context.db.update(thoughts).set({
      ...(body !== undefined ? { body } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(discussed !== undefined ? { discussedAt: discussed ? sql`COALESCE(${thoughts.discussedAt}, CURRENT_TIMESTAMP)` : null } : {}),
    }).where(eq(thoughts.id, id)).returning();
    if (!thought) return Response.json({ error: "This thought no longer exists." }, { status: 404 });
    return Response.json({ thought });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, route: RouteContext) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const context = await getApiContext();
    if (!context) return unauthorized();
    const { id } = await route.params;
    const [deleted] = await context.db.delete(thoughts).where(and(
      eq(thoughts.id, id),
      context.isAdmin ? undefined : eq(thoughts.authorId, context.user.userId),
    )).returning({ id: thoughts.id });
    if (!deleted) return Response.json({ error: "This thought is unavailable or you cannot delete it." }, { status: 404 });
    return Response.json({ id: deleted.id });
  } catch (error) { return apiError(error); }
}
