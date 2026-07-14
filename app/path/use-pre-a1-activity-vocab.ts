/**
 * Pre-A1 activity vocab source: learner unit, admin shared-template preview, or none.
 */
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { normalizeSharedPathTargetVocab } from "@/lib/path/shared-path-media-readiness";
import { getContentRepository } from "@/lib/registry";

import { useEmbeddedActivity } from "@/app/path/embedded";

export type PreA1ActivityVocabMode = "unit" | "preview" | "none";

export type PreA1ActivityVocabState =
  | { status: "loading"; mode: PreA1ActivityVocabMode }
  | {
      status: "ready";
      mode: PreA1ActivityVocabMode;
      words: string[];
      /** Present in preview mode for back-link chrome. */
      previewTemplateId?: string;
      unitId?: number;
      activityIndex?: number;
    };

/**
 * Resolves target vocab for the current activity route:
 * - `?previewTemplate=` (admin try-out) → shared catalog template vocab
 * - `?unit=&activity=` → learner unit vocab
 * - otherwise → empty words (bundled hardcoded rounds)
 */
export function usePreA1ActivityVocab(): PreA1ActivityVocabState {
  const searchParams = useSearchParams();
  const embedded = useEmbeddedActivity();
  const previewTemplateId = searchParams.get("previewTemplate")?.trim() || null;
  const unitId = embedded?.unitId ?? null;
  const activityIndex = embedded?.activityIndex ?? null;

  const [state, setState] = useState<PreA1ActivityVocabState>(() => {
    if (previewTemplateId || unitId !== null) {
      return { status: "loading", mode: previewTemplateId ? "preview" : "unit" };
    }
    return { status: "ready", mode: "none", words: [] };
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (previewTemplateId) {
        try {
          const repo = getContentRepository();
          const templates = await repo.querySharedPathUnitTemplates({ tier: "pre-A1" });
          const template = templates.find((t) => t.id === previewTemplateId);
          if (cancelled) return;
          setState({
            status: "ready",
            mode: "preview",
            words: normalizeSharedPathTargetVocab(template?.targetVocab ?? []),
            previewTemplateId,
          });
        } catch {
          if (!cancelled) {
            setState({
              status: "ready",
              mode: "preview",
              words: [],
              previewTemplateId,
            });
          }
        }
        return;
      }

      if (unitId !== null && activityIndex !== null) {
        try {
          const repo = getContentRepository();
          const units = await repo.getUnits();
          const unit = units.find((u) => u.id === unitId);
          if (cancelled) return;
          setState({
            status: "ready",
            mode: "unit",
            words: normalizeSharedPathTargetVocab(unit?.targetVocab ?? []),
            unitId,
            activityIndex,
          });
        } catch {
          if (!cancelled) {
            setState({
              status: "ready",
              mode: "unit",
              words: [],
              unitId,
              activityIndex,
            });
          }
        }
        return;
      }

      if (!cancelled) {
        setState({ status: "ready", mode: "none", words: [] });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [previewTemplateId, unitId, activityIndex]);

  return state;
}
