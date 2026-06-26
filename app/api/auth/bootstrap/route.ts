import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE } from "@/lib/auth/constants";
import { getAuthProvider } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const BootstrapRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BootstrapRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    await getAuthProvider().createBootstrapAdmin(parsed.data.email, parsed.data.password);
    const { sessionId } = await getAuthProvider().signIn(parsed.data.email, parsed.data.password);

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bootstrap failed";
    return Response.json({ error: message }, { status: 409 });
  }
}
