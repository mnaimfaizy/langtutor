---
name: e2e-playwright
description: >-
  Write or fix Playwright e2e specs for Lang-Tutor without hitting the live Mac
  (Ollama/Whisper), without Serwist bypassing page.route, and without unauthenticated
  test helpers. Use when creating/editing tests/e2e/**, debugging flaky or hanging
  e2e, seeing ECONNREFUSED to the Mac, NVIDIA_NIM errors in e2e, or "page closed"
  mid-navigation.
---

# E2E Playwright (Lang-Tutor)

E2e must be **deterministic and Mac-free**. Live Ollama/Whisper, Serwist NetworkOnly,
and unauthenticated `request` fixtures are the usual sources of hangs and flakes.

## Non-negotiables

1. **Import `{ test, expect }` from `./fixtures`**, never from `@playwright/test`
   (except `auth.setup.ts`, which calls `stubMacApis` itself).
2. **Never call the live Mac.** Mac-facing routes are stubbed by `stubMacApis` in
   `tests/e2e/fixtures.ts`. Do not remove those stubs "to be more realistic."
3. **Service workers stay blocked.** `playwright.config.ts` sets `serviceWorkers: "block"`.
   Serwist is also disabled under e2e via `app/pwa-provider.tsx` (`NEXT_PUBLIC_E2E=1` /
   `navigator.webdriver`). Do not re-enable the SW for ordinary specs.
4. **`browser.newContext()` does not inherit config `use`.** Always pass
   `serviceWorkers: "block"` and call `stubMacApis(page)` on every new page.
5. **Auth-gated test APIs need an authed caller.** If the spec uses
   `test.use({ storageState: { cookies: [], origins: [] } })`, the default `request`
   fixture is logged out — seed via an admin context (`AUTH_FILE`) instead.

## Workflow (create or edit a spec)

Copy and track:

```
E2E checklist:
- [ ] 1. Import from ./fixtures
- [ ] 2. Reset / seed correctly (auth-aware)
- [ ] 3. Stub Mac (fixture or stubMacApis on new pages)
- [ ] 4. Manual contexts: serviceWorkers + stubMacApis + any beforeEach routes
- [ ] 5. Path-plan overrides use overridePathPlan after unit-0 exists
- [ ] 6. Run the single spec; confirm no [api/llm/*] Mac errors in webServer log
- [ ] 7. Assert behavior, not implementation timing
```

### 1. Imports

```ts
import { type Page, expect, test } from "./fixtures";
import { MOCK_PASSAGE, overridePathPlan, stubMacApis } from "./stub-mac-apis";
```

Reuse `MOCK_*` from `stub-mac-apis.ts`. Do not redefine local passage/prompt/feedback
mocks unless the test needs a deliberate variant.

### 2. Reset and seed

- Prefer `request.post("/api/test/reset")` in `beforeEach` when the default project
  `storageState` (admin) is active.
- If the file clears storage for kid signup, **do not** use that unauthenticated
  `request` for `/api/test/media-asset`, `/api/test/reset`, etc. Open a short-lived
  admin context:

```ts
const seed = await browser.newContext({
  storageState: AUTH_FILE,
  serviceWorkers: "block",
});
try {
  const page = await seed.newPage();
  const res = await page.request.post("/api/test/media-asset", {
    data: { action: "put-pending", key: "apple" },
  });
  expect(res.ok()).toBe(true); // never ignore seed failures
} finally {
  await seed.close();
}
```

### 3. Mac stubs

Default fixture already stubs: path/plan, llm/*, reading/*, writing/*, stt, agent.

- **Override plan:** `await overridePathPlan(page, handler)` (unroutes first).
  Land on `/home` so `unit-0` exists, then override, then `goto("/home")` again so
  replenish picks up the canned plan.
- **Extra routes** (audio/image): register with `page.route` after stubs; Playwright
  is LIFO so later handlers win for the same pattern.

### 4. Manual contexts / extra pages

Every `browser.newContext` / `newPage` outside the fixture:

```ts
const ctx = await browser.newContext({
  storageState: AUTH_FILE, // or empty for kid signup
  serviceWorkers: "block",
});
const page = await ctx.newPage();
await stubMacApis(page);
// Re-apply any file-level beforeEach routes (audio/image) — they do NOT carry over.
```

### 5. Server seams that page.route cannot fake

`page.route` only intercepts **browser** traffic. If a route handler eagerly constructs
a Mac/NVIDIA client before a store hit, e2e still blows up. Prefer lazy factories
(see `resolveWordImage(repo, () => getImageGenerator(), …)`). When adding a new
Mac/cloud-backed API used from the UI, either:

- stub it in `stubMacApis`, **and**
- ensure the route does not require live credentials on cache hits.

### 6. Verify isolation

Run the one spec:

```bash
pnpm exec playwright test tests/e2e/<file>.spec.ts -g "<title>" --reporter=list
```

**Pass criteria:** green assertions **and** webServer log has no
`ECONNREFUSED` / `[api/llm/health]` / Ollama `listModels` stack traces for that run.

## Diagnosis map (symptom → cause → fix)

| Symptom | Likely cause | Fix |
| -------- | ------------ | --- |
| `[api/llm/health]` / `ECONNREFUSED …:1234` | SW or missing stub; request reached Next → Mac | Confirm `serviceWorkers: "block"`, `PwaProvider` disable, `stubMacApis` on that page |
| Hang on click / `page has been closed` mid-onboarding | Serwist crash on blocked `register()` (`.waiting`) | Keep SW blocked **and** Serwist `disable` under e2e |
| `unit-0` title never becomes canned plan | Empty-plan stub won; override too late / no second `/home` | `overridePathPlan` after unit exists, then `goto("/home")` |
| No Approve button though "apple" visible | `put-pending` never ran (unauthed request) | Seed with admin `AUTH_FILE` context; `expect(res.ok())` |
| Image resolve 502 / `NVIDIA_NIM_API_KEY` in e2e | Generator constructed before store lookup | Lazy `() => getImageGenerator()`; stub non-pack words if testing unreachable generator |
| Stub ignored on `freshPage` / `kidPage` | New context without fixture | `stubMacApis` + `serviceWorkers: "block"` + re-route audio/image |

Longer narrative and examples: [reference.md](reference.md).

## Anti-patterns

- Importing `test` from `@playwright/test` in a feature spec (skips Mac stubs).
- Ad-hoc `page.route("**/api/llm/health")` in one file while others rely on the fixture —
  extend `stubMacApis` instead.
- Assuming `beforeEach` routes apply to `browser.newPage()` pages.
- Using `page.route` to "mock" server-only work that never goes through the browser.
- Hitting real Mac "just for this one test" — use canned payloads.
- Ignoring non-OK responses from `/api/test/*` seed helpers.

## Related

- `seam-discipline` — no client → Mac; Zod at boundaries.
- `diagnosing-bugs` — when the failure is not an e2e-isolation issue.
- `stack-conventions` — app/UI patterns the specs drive.
