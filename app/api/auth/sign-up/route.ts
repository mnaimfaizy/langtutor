import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE } from "@/lib/auth/constants";
import { getAuthProvider } from "@/lib/auth/server";
import { signUpWithExperienceMode } from "@/lib/auth/sign-up-with-mode";
import { getContentRepositoryForUserId } from "@/lib/db/server";

export const dynamic = "force-dynamic";

const SignUpRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  experienceMode: z.enum(["adult", "kid"]),
});

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SignUpRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const { sessionId } = await signUpWithExperienceMode(
      parsed.data,
      getAuthProvider(),
      getContentRepositoryForUserId,
    );

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
    const message = err instanceof Error ? err.message : "Sign-up failed";
    return Response.json({ error: message }, { status: 409 });
  }
}
