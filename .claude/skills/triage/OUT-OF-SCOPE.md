# Out-of-Scope Knowledge Base

The `.out-of-scope/` directory stores persistent records of rejected feature requests. It serves two purposes:

1. **Institutional memory** — why a feature was rejected, so the reasoning isn't lost when the issue is closed
2. **Deduplication** — when a new issue comes in that matches a prior rejection, the skill can surface the previous decision instead of re-litigating it

## Directory structure

```
.out-of-scope/
├── cloud-sync.md
├── webllm-in-browser.md
└── oxford-api.md
```

One file per **concept**, not per issue. Multiple issues requesting the same thing are grouped under one file.

## File format

```markdown
# Cloud Sync / Multi-device

This project does not support cloud sync or multi-device data sharing in v1.

## Why this is out of scope

The app is single-user, local-first (locked decision #1 in docs/architecture.md). Adding cloud sync would require:

- A backend / Supabase / authentication
- A `SyncedRepository` implementation behind the `ContentRepository` seam
- Conflict resolution for concurrent edits

The `ContentRepository` seam is designed to support this eventually — a future `SyncedRepository` adapter would be the right approach. But v1 deliberately omits this to stay simple.

## Prior requests

- #42 — "Sync data between my laptop and desktop"
```

### Naming the file

Use a short, descriptive kebab-case name for the concept. The name should be recognizable enough that someone browsing the directory understands what was rejected without opening the file.

### Writing the reason

The reason should be substantive — not "we don't want this" but why. Good reasons reference:

- Locked decisions in `docs/architecture.md`
- Technical constraints
- Strategic decisions

The reason should be durable. Avoid referencing temporary circumstances ("we're too busy right now") — those aren't real rejections, they're deferrals.

## When to check `.out-of-scope/`

During triage (Step 1: Gather context), read all files in `.out-of-scope/`. When evaluating a new issue:

- Check if the request matches an existing out-of-scope concept
- Matching is by concept similarity, not keyword — "multi-device" matches `cloud-sync.md`
- If there's a match, surface it to the maintainer: "This is similar to `.out-of-scope/cloud-sync.md` — we rejected this before because [reason]. Do you still feel the same way?"

## When to write to `.out-of-scope/`

Only when an **enhancement** (not a bug) is _rejected_ as `wontfix`. Do **not** write here when something is closed because it's **already implemented**.

The flow:

1. Maintainer decides a feature request is out of scope
2. Check if a matching `.out-of-scope/` file already exists
3. If yes: append the new issue to the "Prior requests" list
4. If no: create a new file with the concept name, decision, reason, and first prior request
5. Post a comment on the issue explaining the decision and mentioning the `.out-of-scope/` file
6. Close the issue with the `wontfix` label
