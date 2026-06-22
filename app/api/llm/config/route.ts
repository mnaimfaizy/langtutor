import { setRuntimeOverride } from "@/lib/llm/runtime-config";
import { LLMOverridesSchema } from "@/lib/llm/settings";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

/**
 * `POST /api/llm/config` — set the server-held LLM override (Mac endpoint + model names)
 * so server-side calls route to the user's chosen Ollama. The browser persists these in
 * IndexedDB and pushes them here on save and on app load (PLAN §3.2 / Phase 0.6).
 * Origin-guarded: state-changing + no auth.
 *
 * Residual risk (accepted — single-user, local, no-auth per PLAN §1): the override `baseURL`
 * is user-controlled and the server then fetches it (SSRF-shaped), and the override persists
 * process-wide until restart. The same-origin guard blocks cross-origin browser callers; full
 * mitigation (auth / endpoint allow-list) is deferred until the app gains multi-user/cloud or
 * leaves localhost. Tracked for the §3.5 security-review.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
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

  setRuntimeOverride(parsed.data);
  return Response.json({ ok: true });
}
