/** Client-side validation for deck card definition/examples edits. */

export type CardEditValidation = { ok: true; definition: string } | { ok: false; message: string };

export function validateCardDefinition(definition: string): CardEditValidation {
  const trimmed = definition.trim();
  if (!trimmed) {
    return { ok: false, message: "Definition cannot be empty." };
  }
  return { ok: true, definition: trimmed };
}

/** One example per line; blank lines are dropped. */
export function parseExamplesText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function formatExamplesText(examples: string[]): string {
  return examples.join("\n");
}
