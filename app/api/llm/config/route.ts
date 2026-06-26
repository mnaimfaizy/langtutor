import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { setRuntimeOverride } from "@/lib/llm/runtime-config";
import { LLMOverridesSchema } from "@/lib/llm/settings";
import { isSameOrigin } from "@/lib/server/origin";
import { isAllowedProxyTarget } from "@/lib/server/ssrf";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await resolveCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LLMOverridesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.baseURL !== undefined && !isAllowedProxyTarget(parsed.data.baseURL)) {
    return Response.json({ error: "baseURL must target a local network host" }, { status: 400 });
  }

  setRuntimeOverride(parsed.data);
  return Response.json({ ok: true });
}
