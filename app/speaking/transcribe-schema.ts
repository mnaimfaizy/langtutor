import { z } from "zod";

export const TranscribeResponseSchema = z.object({ transcript: z.string() });
