"use client";

import { useState } from "react";

import { ComprehensionQsSchema } from "@/lib/content/comprehension";
import type { ComprehensionQuestion } from "@/lib/content/comprehension";
import type { Cefr } from "@/lib/db";
import { createListeningComprehensionErrorEvent } from "@/lib/diagnostics";
import { getContentRepository } from "@/lib/registry";
import { Button } from "@/ui/button";

type QuizPhase = "idle" | "loading" | "answering" | "result" | "error";

interface Props {
  title: string;
  body: string;
  level: Cefr;
}

export function ListeningComprehensionQuiz({ title, body, level }: Props) {
  const [phase, setPhase] = useState<QuizPhase>("idle");
  const [questions, setQuestions] = useState<ComprehensionQuestion[]>([]);
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [score, setScore] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  async function loadQuestions() {
    setPhase("loading");
    try {
      const res = await fetch("/api/reading/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, level }),
      });
      if (!res.ok) throw new Error("Failed");
      const data: unknown = await res.json();
      const parsed = ComprehensionQsSchema.safeParse(data);
      if (!parsed.success) throw new Error("Invalid response");
      setQuestions(parsed.data.questions);
      setSelected(new Array<number | null>(parsed.data.questions.length).fill(null));
      setPhase("answering");
    } catch {
      setPhase("error");
    }
  }

  async function handleSubmit() {
    const repo = getContentRepository();
    const now = new Date();
    let correct = 0;
    let wrong = 0;
    try {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]!;
        const s = selected[i];
        if (s === q.answerIndex) {
          correct++;
        } else if (s !== null) {
          wrong++;
          await repo.addErrorEvent(
            createListeningComprehensionErrorEvent({
              question: q.question,
              category: q.category,
              cefr: level,
              now,
            }),
          );
        }
      }
    } catch {
      // Partial write failure — show result with however many events were logged.
    }
    setScore(correct);
    setWrongCount(wrong);
    setPhase("result");
  }

  function select(questionIdx: number, optionIdx: number) {
    setSelected((prev) => {
      const next = [...prev];
      next[questionIdx] = optionIdx;
      return next;
    });
  }

  if (phase === "idle") {
    return (
      <div className="mt-8" data-testid="listening-quiz-idle">
        <Button variant="secondary" size="md" onClick={() => void loadQuestions()}>
          Take comprehension quiz
        </Button>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="mt-8">
        <p className="text-muted text-sm">Generating questions…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mt-8">
        <p className="text-danger text-sm">Could not generate questions.</p>
        <Button variant="secondary" size="md" className="mt-3" onClick={() => setPhase("idle")}>
          Try again
        </Button>
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="mt-8 space-y-4" data-testid="listening-quiz-result">
        <p className="text-foreground font-semibold" data-testid="listening-quiz-score">
          {score}/{questions.length} correct
        </p>
        {wrongCount > 0 && (
          <p className="text-muted text-sm" data-testid="listening-quiz-mistakes">
            {wrongCount} mistake{wrongCount > 1 ? "s" : ""} logged for review.
          </p>
        )}
        {questions.map((q, i) => (
          <div key={i} className="border-border rounded-xl border p-4">
            <p className="text-foreground mb-2 text-sm font-medium">{q.question}</p>
            <ul className="space-y-1">
              {q.options.map((opt, j) => (
                <li
                  key={j}
                  className={`rounded px-2 py-1 text-xs ${
                    j === q.answerIndex
                      ? "text-success font-semibold"
                      : j === selected[i] && selected[i] !== q.answerIndex
                        ? "text-danger line-through"
                        : "text-muted"
                  }`}
                >
                  {opt}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  // answering phase
  const allAnswered = selected.every((s) => s !== null);
  return (
    <div className="mt-8 space-y-6" data-testid="listening-quiz-answering">
      {questions.map((q, i) => (
        <div key={i} className="border-border rounded-xl border p-4">
          <p className="text-foreground mb-3 text-sm font-medium" data-testid={`lq-question-${i}`}>
            {q.question}
          </p>
          <ul className="space-y-2">
            {q.options.map((opt, j) => (
              <li key={j}>
                <button
                  data-testid={`lq-option-${i}-${j}`}
                  onClick={() => select(i, j)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selected[i] === j
                      ? "border-accent text-foreground bg-accent/10"
                      : "border-border text-muted hover:border-accent/50"
                  }`}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Button
        size="md"
        disabled={!allAnswered}
        onClick={() => void handleSubmit()}
        data-testid="btn-submit-listening-quiz"
      >
        Submit answers
      </Button>
    </div>
  );
}
