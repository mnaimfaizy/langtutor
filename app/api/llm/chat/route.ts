import { z } from "zod";

import { getLLMClient } from "@/lib/llm/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

// The request body is untrusted external input → Zod-parse it at the boundary (hard rule #3).
const ChatRequest = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
});

/**
 * `POST /api/llm/chat` — same-origin proxy to the Mac for free-text chat. Returns
 * `{ text }`, or a `text/plain` token stream when `stream: true`. Structured
 * (schema-validated) generation is done server-side where the schema is defined; it is
 * intentionally not exposed over HTTP (a Zod schema can't cross the wire).
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

  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { messages, model, temperature, stream } = parsed.data;

  try {
    const client = await getLLMClient();

    if (stream) {
      const iterable = await client.streamChat(messages, { model, temperature });
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of iterable) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
      return new Response(body, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    const text = await client.chat(messages, { model, temperature });
    return Response.json({ text });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "LLM request failed" },
      { status: 502 },
    );
  }
}
