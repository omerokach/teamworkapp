import { getAuth } from "../../../../lib/auth/server";
import { allowedEmail, normalizeEmail, sameOrigin } from "../../../../lib/access";

type Context = { params: Promise<{ path: string[] }> };
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: Context) {
  const path = (await context.params).path.join("/");
  if (path !== "get-session") return Response.json({ error: "Not found" }, { status: 404 });
  return getAuth().handler().GET(request, context);
}
export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const path = (await context.params).path.join("/");
  if (!["email-otp/send-verification-otp", "sign-in/email-otp", "sign-out"].includes(path)) {
    return Response.json({ error: "This operation is not available." }, { status: 403 });
  }
  if (path !== "sign-out") {
    const body = await request.clone().json().catch(() => null) as { email?: unknown; type?: unknown } | null;
    if (typeof body?.email !== "string" || !(await allowedEmail(normalizeEmail(body.email)))) {
      return Response.json({ error: "This workspace is invitation-only. Ask the owner to invite your email address." }, { status: 403 });
    }
    if (path === "email-otp/send-verification-otp" && body?.type !== "sign-in") {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
  }
  return getAuth().handler().POST(request, context);
}
