import { index, pgTable, text, timestamp, date } from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow();

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", {
    withTimezone: true,
    mode: "string",
  })
    .notNull()
    .defaultNow(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", {
      enum: ["backlog", "in_progress", "review", "done"],
    })
      .notNull()
      .default("backlog"),
    priority: text("priority", { enum: ["low", "medium", "high"] })
      .notNull()
      .default("medium"),
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => users.id),
    dueDate: date("due_date", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tasks_status_idx").on(table.status),
    index("tasks_assignee_idx").on(table.assigneeId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("comments_task_idx").on(table.taskId)],
);

export const decisions = pgTable("decisions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", {
      enum: [
        "member_joined",
        "task_created",
        "task_updated",
        "comment_added",
        "decision_added",
      ],
    }).notNull(),
    entityId: text("entity_id"),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("activities_created_idx").on(table.createdAt)],
);
