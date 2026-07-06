"use client";

import type { WerAlignment, WerResult } from "@/lib/diagnostics/wer";
import { Card } from "./card";
import { cn } from "./cn";

function werColor(wer: number): string {
  if (wer <= 0.2) return "text-success";
  if (wer <= 0.5) return "text-warning";
  return "text-danger";
}

export function AlignmentToken({ token }: { token: WerAlignment }) {
  if (token.type === "correct") {
    return <span className="text-foreground">{token.ref}</span>;
  }
  if (token.type === "substitution") {
    return (
      <span>
        <s className="text-danger">{token.ref}</s>{" "}
        <span className="text-warning font-medium">({token.hyp})</span>
      </span>
    );
  }
  if (token.type === "deletion") {
    return <span className="bg-danger/10 text-danger rounded px-0.5 text-sm">[{token.ref}]</span>;
  }
  return <span className="bg-warning/10 text-warning rounded px-0.5 text-sm">+{token.hyp}</span>;
}

interface WerDisplayProps {
  result: WerResult;
  scoreLabel?: string;
  referenceBody?: string;
}

export function WerDisplay({ result, scoreLabel = "Score", referenceBody }: WerDisplayProps) {
  const pct = isFinite(result.wer) ? Math.round(result.wer * 100) : 100;
  return (
    <div data-testid="wer-result" className="mt-8 space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-muted text-xs font-medium tracking-wider uppercase">{scoreLabel}</p>
            <p
              data-testid="wer-score"
              className={cn("mt-1 text-4xl font-bold", werColor(result.wer))}
            >
              {100 - pct}
              <span className="text-muted text-lg font-normal">%</span>
            </p>
            <p className="text-muted mt-1 text-xs">accuracy ({pct}% word error rate)</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted text-xs font-medium tracking-wider uppercase">Errors</p>
            <p className="text-foreground mt-1">
              {result.substitutions}S · {result.deletions}D · {result.insertions}I
            </p>
          </div>
        </div>
      </Card>

      {result.alignment.length > 0 && (
        <Card>
          <p className="text-foreground mb-3 text-xs font-medium tracking-wider uppercase">
            Alignment
          </p>
          <p className="text-foreground text-sm leading-8">
            {result.alignment.map((token, i) => (
              <span key={i}>
                {i > 0 && " "}
                <AlignmentToken token={token} />
              </span>
            ))}
          </p>
          <p className="text-muted mt-3 text-xs">
            <span className="text-danger">red strikethrough</span> = wrong word (yours in brackets)
            · <span className="text-danger">[red]</span> = missed word ·{" "}
            <span className="text-warning">+orange</span> = extra word
          </p>
        </Card>
      )}

      {referenceBody && (
        <details className="border-border bg-card rounded-xl border p-4">
          <summary className="text-muted cursor-pointer text-sm select-none">
            Show reference text
          </summary>
          <p className="text-foreground mt-3 text-sm leading-8 whitespace-pre-wrap">
            {referenceBody}
          </p>
        </details>
      )}
    </div>
  );
}
