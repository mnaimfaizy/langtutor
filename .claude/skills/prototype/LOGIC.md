# Logic Prototype

A tiny interactive terminal app that lets the user drive a state model by hand. Use this when the question is about **business logic, state transitions, or data shape** — the kind of thing that looks reasonable on paper but only feels wrong once you push it through real cases.

## When this is the right shape

- "I'm not sure if this state machine handles the edge case where X then Y."
- "Does this data model actually let me represent the case where..."
- "I want to feel out what the API should look like before writing it."
- Anything where the user wants to **press buttons and watch state change**.

If the question is "what should this look like" — wrong branch. Use [UI.md](UI.md).

## Process

### 1. State the question

Before writing code, write down what state model and what question you're prototyping. One paragraph, in a comment at the top of the file. A logic prototype that answers the wrong question is pure waste.

### 2. Pick the language

Use TypeScript/Node (the project's existing runtime). Match the project's existing conventions for tooling — don't add a new package manager or runtime just for the prototype.

### 3. Isolate the logic in a portable module

Put the actual logic — the bit that's answering the question — behind a small, pure interface that could be lifted out and dropped into the real codebase later. The TUI around it is throwaway; the logic module shouldn't be.

The right shape depends on the question:

- **A pure reducer** — `(state, action) => state`. Good when actions are discrete events and state is a single value.
- **A state machine** — explicit states and transitions. Good when "which actions are even legal right now" is part of the question.
- **A small set of pure functions** over a plain data type. Good when there's no implicit current state — just transformations.

Keep it pure: no I/O, no terminal code, no `console.log` for control flow. The TUI imports it and calls into it; nothing flows the other direction.

### 4. Build the smallest TUI that exposes the state

Build it as a **lightweight TUI** — on every tick, clear the screen and re-render the whole frame. The user should always see one stable view, not an ever-growing scrollback.

Each frame has two parts:

1. **Current state**, pretty-printed (one field per line, or formatted JSON).
2. **Keyboard shortcuts** listed at the bottom: `[a] add card  [r] rate again  [q] quit`.

Behaviour:

1. **Initialise state** — a single in-memory object. Render the first frame on start.
2. **Read one keystroke (or one line)** at a time, dispatch to a handler that mutates state.
3. **Re-render** the full frame after every action — don't append, replace.
4. **Loop until quit.**

### 5. Make it runnable in one command

Add a script to `package.json`. The user should run `pnpm run <prototype-name>` — never need to remember a path.

### 6. Hand it over + capture the answer

Give the user the run command. When the prototype has done its job, capture the answer (which design felt right) in a commit message, ADR, or GitHub issue before deleting the prototype.

## Anti-patterns

- **Don't add tests.** A prototype that needs tests is no longer a prototype.
- **Don't wire it to real IndexedDB.** Use an in-memory store.
- **Don't generalise.** No "what if we wanted to support X later."
- **Don't blur the logic and the TUI together.** The logic module must stay portable.
