import { activities, tasks } from "../../../db/schema";
import { apiError, getApiContext, unauthorized } from "../../../lib/api-context";

const statuses = ["backlog", "in_progress", "review", "done"] as const;
const priorities = ["low", "medium", "high"] as const;

export async function POST(request: Request) {
  try {
    const context = await getApiContext();
    if (!context) return unauthorized();

    const payload = (await request.json()) as {
      title?: string;
      description?: string;
      status?: (typeof statuses)[number];
      priority?: (typeof priorities)[number];
      assigneeId?: string | null;
      dueDate?: string | null;
    };

    const title = payload.title?.trim() ?? "";
    if (!title) {
      return Response.json({ error: "Task title is required." }, { status: 400 });
    }
    if (title.length > 140) {
      return Response.json(
        { error: "Task title must be 140 characters or fewer." },
        { status: 400 },
      );
    }

    const status = statuses.includes(payload.status ?? "backlog")
      ? (payload.status ?? "backlog")
      : "backlog";
    const priority = priorities.includes(payload.priority ?? "medium")
      ? (payload.priority ?? "medium")
      : "medium";
    const id = crypto.randomUUID();

    const [task] = await context.db
      .insert(tasks)
      .values({
        id,
        title,
        description: payload.description?.trim() ?? "",
        status,
        priority,
        assigneeId: payload.assigneeId || null,
        creatorId: context.user.userId,
        dueDate: payload.dueDate || null,
      })
      .returning();

    await context.db.insert(activities).values({
      id: crypto.randomUUID(),
      actorId: context.user.userId,
      kind: "task_created",
      entityId: id,
      text: `created “${title}”`,
    });

    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
