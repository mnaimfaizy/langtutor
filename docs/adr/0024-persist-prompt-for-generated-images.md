# ADR 0024: Persist generation prompt only for generated images

## Status: Accepted

## Context

ADR 0023 requires the admin UI to show the prior prompt before override. The
`media_assets` table does not currently store prompts. Curated-pack images were
not produced by our prompt template.

## Decision

- For **`source: "generated"`** image assets, persist the effective prompt used
  for that generation on the asset row (new nullable field, e.g. `prompt`).
- For **`source: "curated-pack"`** (and any non-generated image), `prompt` stays
  null; the admin UI shows the **default kid-illustration template** for that
  word as the editable starting point.
- On regenerate with override or default, write the prompt actually sent to the
  image provider onto the new pending generated row.

## Consequences

- Schema migration for `media_assets.prompt` (or equivalent) in SQLite + Postgres.
- Admin preview/list can display last used prompt for generated rows.
- Existing generated rows without a stored prompt fall back to the default
  template until regenerated once.
