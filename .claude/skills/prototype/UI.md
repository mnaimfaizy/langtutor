# UI Prototype

Generate **several radically different UI variations** on a single route, switchable from a floating bottom bar. The user flips between variants in the browser, picks one (or steals bits from each), then throws the rest away.

If the question is about logic/state rather than what something looks like — wrong branch. Use [LOGIC.md](LOGIC.md).

## When this is the right shape

- "What should this page look like?"
- "I want to see a few options for this layout before committing."
- "Try a different layout for the settings screen."

## Two sub-shapes — strongly prefer sub-shape A

A UI prototype is much easier to judge when it's **butting up against the rest of the app** — real header, real data, real density. Default to sub-shape A whenever there's a plausible existing page to host the variants.

### Sub-shape A — adjustment to an existing page (preferred)

The route already exists. Variants are rendered **on the same route**, gated by a `?variant=` URL search param. The existing data fetching and Next.js layout all stay — only the rendering swaps.

### Sub-shape B — a new page (last resort)

Only use this when the thing being prototyped genuinely has no existing page to live inside. Create a throwaway route following the project's routing convention. Name it obviously as a prototype (e.g. include "prototype" in the path).

Before committing to sub-shape B, sanity-check: is there really no existing page this could be embedded in?

## Process

### 1. State the question and pick N

Default to **3 variants**. More than 5 stops being radically different and starts being noise.

### 2. Generate radically different variants

Hold each one to:

- The page's purpose and the data it has access to.
- This project's component library (`ui/` wrappers over Base UI, Tailwind v4 tokens).
- A clear exported component name, e.g. `VariantA`, `VariantB`, `VariantC`.

Variants must be **structurally different** — different layout, different information hierarchy, different primary affordance. Three slightly-tweaked card grids is not a UI prototype.

### 3. Wire them together

```tsx
// pseudo-code — adapt to Next.js App Router
const variant = searchParams.get("variant") ?? "A";
return (
  <>
    {variant === "A" && <VariantA {...data} />}
    {variant === "B" && <VariantB {...data} />}
    {variant === "C" && <VariantC {...data} />}
    <PrototypeSwitcher variants={["A", "B", "C"]} current={variant} />
  </>
);
```

### 4. Build the floating switcher

A small fixed-position bar at the bottom-centre of the screen with three pieces:

- **Left arrow** — cycles to the previous variant (wraps around).
- **Variant label** — shows the current variant key.
- **Right arrow** — cycles forward (wraps around).

Behaviour:

- Clicking an arrow updates the URL search param via `router.replace` so the variant is shareable.
- Keyboard: `←` and `→` arrow keys also cycle. Don't intercept arrow keys when an `<input>`, `<textarea>`, or `[contenteditable]` is focused.
- Visually distinct from the page (high-contrast pill, subtle shadow) so it's obviously not part of the design being evaluated.
- Hidden in production builds — gate on `process.env.NODE_ENV !== 'production'`.

### 5. Capture the answer and clean up

Once a variant has won:

- **Sub-shape A** — delete the losing variants and the switcher; fold the winner into the existing page.
- **Sub-shape B** — promote the winning variant to a real route, delete the throwaway route and the switcher.

Don't leave variant components or the switcher lying around. They rot fast and confuse the next reader.

## Anti-patterns

- **Variants that differ only in colour or copy.** That's a tweak, not a prototype.
- **Sharing too much code between variants.** A shared header is fine; a shared layout defeats the point.
- **Wiring variants to real mutations.** Read-only prototypes only.
- **Promoting the prototype directly to production.** Rewrite it properly when you fold it in.
