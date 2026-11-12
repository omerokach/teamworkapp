import { eq } from "drizzle-orm";
import { activities, tasks } from "../../../../db/schema";
import {
  apiError,
  getApiContext,
  unauthorized,
} from "../../../../lib/api-context";

const statuses = ["backlog", "in_progress", "review", "done"] as const;
const priorities = ["low", "medium", "high"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getApiContext();
    if (!context) return unauthorized();
    const { id } = await params;
    const payload = (await request.json()) as {
      title?: string;
      description?: string;
      status?: (typeof statuses)[number];
      priority?: (typeof priorities)[number];
      assigneeId?: string | null;
      dueDate?: string | null;
    };

    const existing = await context.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);
    if (!existing[0]) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }

    const updates: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (typeof payload.title === "string" && payload.title.trim()) {
      updates.title = payload.title.trim().slice(0, 140);
    }
    if (typeof payload.description === "string") {
      updates.description = payload.description.trim();
    }
    if (payload.status && statuses.includes(payload.status)) {
      updates.status = payload.status;
    }
    if (payload.priority && priorities.includes(payload.priority)) {
      updates.priority = payload.priority;
    }
    if ("assigneeId" in payload) updates.assigneeId = payload.assigneeId || null;
    if ("dueDate" in payload) updates.dueDate = payload.dueDate || null;

    const [task] = await context.db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();

    await context.db.insert(activities).values({
      id: crypto.randomUUID(),
      actorId: context.user.userId,
      kind: "task_updated",
      entityId: id,
      text:
        payload.status && payload.status !== existing[0].status
          ? `moved “${task.title}” to ${payload.status.replace("_", " ")}`
          : `updated “${task.title}”`,
    });

    return Response.json({ task });
  } catch (error) {
    return apiError(error);
  }
}
