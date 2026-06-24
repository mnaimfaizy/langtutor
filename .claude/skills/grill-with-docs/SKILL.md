---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.
disable-model-invocation: true
---

# Grill with Docs

Run a relentless Socratic interview to sharpen the plan or design the user has described.

## Process

1. **Ask one question at a time.** Don't fire a list of questions — ask the single most important open question, wait for the answer, then ask the next.

2. **Record decisions as ADRs.** Each time the user makes a non-obvious design decision (a tradeoff, a constraint, a rejected alternative), capture it as a short ADR in `docs/adr/NNNN-title.md`:

   ```
   # ADR NNNN: Short title
   ## Status: Accepted
   ## Context
   ## Decision
   ## Consequences
   ```

3. **Build a glossary.** When a new domain term is introduced, add it to `docs/glossary.md` (create if missing):

   ```
   **Term** — definition in one sentence.
   ```

4. **Keep grilling until the design is solid.** Stop when:
   - All major tradeoffs have been surfaced and decided
   - The interface contracts are clear
   - The acceptance criteria could be written without further clarification

5. **Summarize at the end.** Produce a short summary of decisions made, ADRs written, and terms added to the glossary.
