import { eq } from "drizzle-orm";
import { activities, comments, tasks } from "../../../../../db/schema";
import {
  apiError,
  getApiContext,
  unauthorized,
} from "../../../../../lib/api-context";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getApiContext();
    if (!context) return unauthorized();
    const { id: taskId } = await params;
    const payload = (await request.json()) as { body?: string };
    const body = payload.body?.trim() ?? "";
    if (!body) {
      return Response.json({ error: "Write a comment first." }, { status: 400 });
    }

    const task = await context.db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!task[0]) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }

    const [comment] = await context.db
      .insert(comments)
      .values({
        id: crypto.randomUUID(),
        taskId,
        authorId: context.user.userId,
        body: body.slice(0, 2000),
      })
      .returning();

    await context.db.insert(activities).values({
      id: crypto.randomUUID(),
      actorId: context.user.userId,
      kind: "comment_added",
      entityId: taskId,
      text: `commented on “${task[0].title}”`,
    });

    return Response.json({ comment }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
