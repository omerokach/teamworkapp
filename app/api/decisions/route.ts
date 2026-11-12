import { activities, decisions } from "../../../db/schema";
import { apiError, getApiContext, unauthorized } from "../../../lib/api-context";

export async function POST(request: Request) {
  try {
    const context = await getApiContext();
    if (!context) return unauthorized();
    const payload = (await request.json()) as {
      title?: string;
      summary?: string;
    };
    const title = payload.title?.trim() ?? "";
    const summary = payload.summary?.trim() ?? "";
    if (!title || !summary) {
      return Response.json(
        { error: "A title and summary are required." },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const [decision] = await context.db
      .insert(decisions)
      .values({
        id,
        title: title.slice(0, 140),
        summary: summary.slice(0, 3000),
        ownerId: context.user.userId,
      })
      .returning();

    await context.db.insert(activities).values({
      id: crypto.randomUUID(),
      actorId: context.user.userId,
      kind: "decision_added",
      entityId: id,
      text: `recorded the decision “${decision.title}”`,
    });

    return Response.json({ decision }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
