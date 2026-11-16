import { desc, eq } from "drizzle-orm";
import { thoughts, users } from "../../../db/schema";
import { apiError, getApiContext, unauthorized } from "../../../lib/api-context";
import { sameOrigin } from "../../../lib/access";
import { createThoughtInput } from "../../../lib/thought-input";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await getApiContext();
    if (!context) return unauthorized();
    const rows = await context.db.select({
      id: thoughts.id, body: thoughts.body, notes: thoughts.notes,
      authorId: thoughts.authorId, authorName: users.displayName,
      discussedAt: thoughts.discussedAt, createdAt: thoughts.createdAt,
    }).from(thoughts).innerJoin(users, eq(users.id, thoughts.authorId)).orderBy(desc(thoughts.createdAt));
    return Response.json({ thoughts: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const context = await getApiContext();
    if (!context) return unauthorized();
    const input = createThoughtInput.safeParse(await request.json().catch(() => null));
    if (!input.success) return Response.json({ error: "Write a thought using 1–3,000 characters." }, { status: 400 });
    const [thought] = await context.db.insert(thoughts).values({
      id: crypto.randomUUID(), body: input.data.body, authorId: context.user.userId,
    }).returning();
    return Response.json({ thought: { ...thought, authorName: context.user.displayName } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
