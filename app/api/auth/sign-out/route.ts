import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";
import { getAuthProvider } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    await getAuthProvider().signOut(sessionId);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
