import { asc, desc } from "drizzle-orm";
import { getApiContext, apiError, unauthorized } from "../../../lib/api-context";
import {
  activities,
  comments,
  decisions,
  tasks,
  users,
} from "../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await getApiContext();
    if (!context) return unauthorized();

    const { db, user } = context;
    const existingTasks = await db.select({ id: tasks.id }).from(tasks).limit(1);

    if (existingTasks.length === 0) {
      const due = new Date();
      due.setDate(due.getDate() + 7);
      const dueDate = due.toISOString().slice(0, 10);

      await db
        .insert(tasks)
        .values([
          {
            id: "starter-invite-team",
            title: "Invite your partners to RelayDesk",
            description:
              "Share the public app link so everyone works from the same source of truth. No account or password is required.",
            status: "in_progress",
            priority: "high",
            assigneeId: user.userId,
            creatorId: user.userId,
            dueDate,
          },
          {
            id: "starter-capture-work",
            title: "Capture this week’s active work",
            description:
              "Create one task for every meaningful outcome currently buried in chat messages. Add an owner and due date to each.",
            status: "backlog",
            priority: "high",
            assigneeId: user.userId,
            creatorId: user.userId,
          },
          {
            id: "starter-agree-rules",
            title: "Agree on your team communication rules",
            description:
              "Use WhatsApp only for urgent alerts. Keep tasks, decisions, and project discussion here where they stay searchable.",
            status: "backlog",
            priority: "medium",
            assigneeId: user.userId,
            creatorId: user.userId,
          },
        ])
        .onConflictDoNothing();

      await db
        .insert(activities)
        .values({
          id: "starter-workspace-ready",
          actorId: user.userId,
          kind: "task_created",
          text: "set up the workspace starter tasks",
        })
        .onConflictDoNothing();
    }

    const memberRows = await db.select().from(users).orderBy(asc(users.createdAt));
    const taskRows = await db.select().from(tasks).orderBy(desc(tasks.updatedAt));
    const commentRows = await db
      .select()
      .from(comments)
      .orderBy(asc(comments.createdAt));
    const decisionRows = await db
      .select()
      .from(decisions)
      .orderBy(desc(decisions.createdAt));
    const activityRows = await db
      .select()
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(30);

    return Response.json({
      currentUserId: user.userId,
      members: memberRows,
      tasks: taskRows,
      comments: commentRows,
      decisions: decisionRows,
      activities: activityRows,
    });
  } catch (error) {
    return apiError(error);
  }
}
