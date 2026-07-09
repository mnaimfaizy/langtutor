# E2E Playwright — reference

Companion to [SKILL.md](SKILL.md). Read when diagnosing a failure or extending stubs.

## Architecture that bites e2e

```
Browser  --fetch /api/*-->  Next route handler  --fetch-->  Mac (Ollama/Whisper) / NVIDIA
                ^
                |
     page.route can fulfill HERE only if the request
     is visible to Playwright (no controlling Service Worker)
```

Serwist (`app/sw.ts`) marks Mac-dependent APIs as **NetworkOnly**. A controlling SW
takes the fetch **before** Playwright routing → Next runs → live Mac. That is why
config sets `serviceWorkers: "block"` and `PwaProvider` disables registration under
`NEXT_PUBLIC_E2E=1` / `navigator.webdriver`.

Playwright's block stub replaces `navigator.serviceWorker.register` with a function
that returns `undefined`. Serwist then throws on `.waiting` unless `disable={true}`.
That unhandled rejection can stall App Router client navigations (looks like a hang
on the next `click` / `waitForURL`).

## Canonical files

| File | Role |
| ---- | ---- |
| `playwright.config.ts` | `serviceWorkers: "block"`, webServer `NEXT_PUBLIC_E2E=1`, auth project |
| `tests/e2e/fixtures.ts` | Extends `test` → `stubMacApis(page)` every test |
| `tests/e2e/stub-mac-apis.ts` | Default Mac stubs + `overridePathPlan` |
| `tests/e2e/auth.setup.ts` | Admin session → `AUTH_FILE`; also stubs Mac |
| `tests/e2e/auth-constants.ts` | `AUTH_FILE`, admin email/password |
| `app/pwa-provider.tsx` | Disables Serwist under e2e / webdriver |

## What `stubMacApis` covers

- `POST/GET` style browser calls: `/api/path/plan`, `/api/llm/{health,warmup,chat,embeddings}`,
  `/api/reading/{generate,questions}`, `/api/writing/{generate,feedback}`,
  `/api/stt/transcribe`, `/api/agent/research-word`
- Default plan: `{ plans: [] }` — enough for empty buffer / unit creation without LLM titles
- Shared bodies: `MOCK_PASSAGE`, `MOCK_PROMPT`, `MOCK_FEEDBACK`, `MOCK_EMBEDDING`

Not covered (stub in the spec when needed): `/api/audio/resolve`, `/api/image/resolve`,
lexicon (usually real WordNet), auth, test helpers.

## Path-plan override recipe

```ts
await setupWithSeed(page); // or goto /home until unit-0 exists
const unitId = Number(await page.getByTestId("unit-0").getAttribute("data-unit-id"));

await overridePathPlan(page, async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      plans: [{ unitId, title: "…", teacherNote: "…", targetVocab: […] }],
    }),
  });
});

await page.goto("/home"); // replenish + onAfterPlan UI refresh
await expect(page.getByTestId("unit-0").getByText("…")).toBeVisible();
```

Do **not** only `page.route` without `unroute` — LIFO races with the fixture stub.
`overridePathPlan` always unroutes first.

## Auth matrix

| Spec storageState | Default `request` | Safe for `/api/test/*`? |
| ----------------- | ----------------- | ------------------------ |
| Project default (`AUTH_FILE`) | Admin cookie | Yes |
| Cleared (`cookies: [], origins: []`) | Logged out | **No** — use admin `browser.newContext` |
| Manual kid context | N/A | Seed before kid work with admin context |

`requireUser()` on test routes redirects to `/login` when unauthenticated. Playwright
`request` may follow redirects and return HTML — always `expect(res.ok())`.

## Image / media e2e notes

- Pack words (`PICTURE_MATCH_OPTION_WORDS`, alphabet nouns in pack): continue to real
  `/api/image/resolve` (store hit; no NVIDIA if generator is lazy).
- Non-pack words: fulfill 502 in the spec to simulate unreachable ImageGenerator.
- Pending gate: `put-pending` then assert learner 404/empty img; admin Approve; reload;
  assert 200. Restore with `restore-pack` in `finally` via **admin** request.

## Extending stubs

When a new UI path calls a Mac-backed `app/api/*` route:

1. Add a default fulfill to `stubMacApis` (empty/safe payload).
2. Confirm the route handler does not eagerly connect to the Mac on cache hits.
3. Document any intentional override in the spec that needs a non-default body.
4. Run one affected e2e and grep the webServer log for the new route + `ECONNREFUSED`.

## Offline / SW-positive tests

Almost all specs should keep SW blocked. If a future test **must** exercise Serwist
caching, isolate it in its own file with an explicit comment, `serviceWorkers: "allow"`,
and do **not** rely on `page.route` for Mac APIs in that file — use server-side test
doubles or accept that those calls are out of scope.
