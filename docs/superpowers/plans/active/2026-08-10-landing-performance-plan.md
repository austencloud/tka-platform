# Landing Page Performance — Phased Plan and Handoff

**Started:** 2026-08-10
**Owner:** rotating; each phase is self-contained
**Surface:** `/` on tkaflowarts.com (prerendered marketing landing)

---

## Why this exists

Austen loaded tkaflowarts.com and sat looking at a placeholder for ~30 seconds,
twice, on a gigabit connection. The page's headline metrics all said "fast" the
whole time. His bar, verbatim: *"I want it to look beautiful all the time and be
extremely fast all the time"* and *"I honestly never want anybody to have to
experience the simplified version unless they're in Antarctica on a Nokia."*

The trap this page sets, and the reason several sessions have misdiagnosed it:
**every standard metric is green while the page looks broken.** Measured on
production 2026-08-09, post-cache-fix:

| Metric | Value |
|---|---|
| LCP | 667 ms |
| DCL | 456 ms |
| `load` | 862 ms |
| CLS | 0.00 |

LCP is timing the headline *text*. The hero had not drawn a frame. Do not treat
a green Lighthouse-shaped number as evidence on this surface.

---

## Already shipped (do not redo)

| Change | Commit | Evidence |
|---|---|---|
| `_headers` caching rewrite | `cec0d4f566` | Repeat visit: 216/250 resources from cache (was ~0), blocking 304s 200→3, 250th request 12,890 ms→7,938 ms |
| Save-Data seeding, killed "Play live preview" for everyone | `cec0d4f566` | `PlayLivePreview=0` in prod HTML; pictograph data fetch 5,700 ms→2 ms |
| Hero `loadPriority="immediate"` | `08d725782e` | `hero:activate` now fires 662 ms after hydration, was a hard 2500 ms idle timeout |
| Landing performance marks | `3bdb619e1b` | Four marks resolve in-browser; `__tkaMarks()` |

---

## The instrument

`src/lib/shared/performance/landing-marks.ts`. Four `performance.mark` entries
on the path to a live hero, visible in a DevTools trace's Timings track:

- `hydrated` — set first thing in the root layout's `onMount`
- `hero:activate` — the hero decided to load its player
- `hero:player-loaded` — the player chunk imported and reported loaded
- `background:first-frame` — background canvas mounted

Read them anywhere with `__tkaMarks()` in the console. Extend the union type in
that file to add more; `markLanding` is idempotent per mark and SSR-safe.

**Baseline reading (dev server, 2026-08-10):**

```
hydrated                 1914 ms
hero:activate            2576 ms   (+662 after hydration)
background:first-frame   5075 ms
hero:player-loaded       6301 ms   (+3725 after activate)
```

Dev-server absolute values are inflated by unbundled module requests. The
*shape* is the finding: the player import now dominates.

---

## Standing constraints for every phase

1. **Chrome DevTools MCP only.** Austen's explicit instruction: *"use Devtools
   don't use your integrated browser to fix this."* Never `preview_start` /
   the in-app Browser pane for this work. Launch with
   `pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`.
2. **Never start, restart or stop :5173.** It is Austen's, via his Agent Hub
   button. If it is down, diagnose and ask him. `--host ::` means IPv6 — curl
   `https://[::1]:5173/`, not `localhost`.
3. **Scoped commits only:** `git commit -m "..." -- <explicit paths>`.
4. **Evidence in the same message as the claim.** A green typecheck is not
   evidence of a performance change; a mark reading or a trace is.
5. **PostHog stays on the landing path.** Austen overruled removing it:
   *"why I wanted to track all of the stuff that people do."* Timing changes
   only, never removal.
6. **No static pictograph substitute for the hero.** *"I don't want to see a
   fucking pictograph that's what the strip is underneath it."*

---

## Ledger

- [ ] **P0** Clean production baseline, signed-out
- [ ] **P1** Player chunk: 3.7 s activate→loaded
- [ ] **P2** The continuous long-task loop
- [x] **P3** Cheap certain deletions — 2 of 3 done, 1 reclassified
- [ ] **P4** Background adaptive-quality threshold (external package)
- [ ] **P5** Defer Firebase auth on landing
- [ ] **P6** Make the pre-live state look deliberate
- [ ] **P7** Extend instrumentation past the hero

---

## P0 — Clean production baseline, signed-out

**Gates P1 and P2.** Do this first; it decides how much the rest is worth.

Today's two data sets have different biases and neither is a first-time
visitor. The production trace was captured **signed-in** (Austen's avatar is
visible in his screenshots), which adds the entire Firebase path a new visitor
never pays. The mark readings came from the **dev server**.

**Do:**
1. Wait for the marks commit to reach production (Cloudflare builds on push to
   `main`; the GitHub "Deploy Pages (gated)" action only fires a webhook).
   Confirm with a cache-busted `curl` for a fingerprint of the new bundle.
2. Open a **signed-out** page in an isolated browser context.
3. `performance_start_trace` with `reload: true`, `autoStop: true`.
4. Read `__tkaMarks()` and record all four values.
5. Repeat signed-in for the delta.

**Evidence:** both mark sets in the plan file, appended to the table above.

**Decides:** if signed-out `hero:player-loaded` is already under ~1.5 s, P5
drops to cosmetic and P1 shrinks. If it is still seconds, P1 is the whole job.

---

## P1 — The player chunk (largest known gap)

`hero:activate` → `hero:player-loaded` = **3,725 ms**. Larger than everything
fixed so far combined. Nobody had measured it before 2026-08-10.

`InlineAnimationPlayer` is a media-viewer component built for the full app, not
for a marketing hero. The hypothesis — **unverified, verify before acting** —
is that it pulls the animation engine, effects registry and prop geometry in as
one graph, and that `chrome: "minimal"` is a render flag that trims no bundle.

**Step 1 findings (2026-08-10, static analysis — chunk not yet weighed):**

The graph is leaner than assumed. `InlineAnimationPlayer` has 16 static
imports; `AnimatorCanvas` has 28. **The effects runtime is NOT in this chunk** —
`effect-registry` is imported only by the effects-panel components, and
`AnimatorCanvas`'s `fire-types` / `led-types` / `tip-effect-types` are all
`import type`, so they erase at build. Do not repeat the claim that the hero
drags in the effects system; it does not.

What IS statically imported, and therefore in the chunk no matter what
`chrome: "minimal"` does at render time:

| Pulled in | Does the hero use it? |
|---|---|
| `UnifiedTimeline` | No |
| `CanvasContextMenuHost` + context-menu types | No |
| `BpmChips` (via the player) | No |
| `sequence-difficulty-calculator` (value import) | No |
| `WordHeader`, `SequenceProgressBar` | No |

`chrome: "minimal"` is a render flag, not a bundle boundary — confirmed. That
is the case for a hero-weight entry point, and it is a smaller, better-defined
carve than "split the animation engine".

**Do, in order:**
1. Weigh the chunk before cutting. `list_network_requests` filtered to the
   player chunk on a production load: transfer size, decoded size, and what it
   pulls in after. The static graph above says *what* is in it, not *how much*
   any of it costs. Needs a green CI first (see the deploy trap below).
2. If the graph is bloated: carve a hero-weight entry — play a sequence,
   minimal chrome, no effects panel, no export, no practice.
3. Independently of 2: `<link rel="modulepreload">` the player chunk so the
   fetch overlaps hydration instead of queueing behind it. This is worth doing
   even if the chunk turns out to be lean, and is much cheaper than 2.

**Evidence:** `hero:player-loaded` before/after on production, signed-out.

**Watch:** `src/lib/shared/landing/components/SequenceHeroDemo.svelte:308` is
the `LazyMount` boundary. Its comment block explains why it is deliberately
**not** keyed on sequence id — do not "fix" that; keying it remounts the player
on every attract-act sequence change.

---

## P2 — The continuous long-task loop

Measured on production: **123 long tasks, 10,978 ms total blocking, first at
690 ms, last at 183,445 ms.** 50–120 ms blocked every second, indefinitely —
not a load-time cost, a permanent one. This is why `requestIdleCallback` never
fires promptly and why anything scheduled politely never runs.

Attribution came back `unknown:window`, so **the culprit is not identified.**
Do not assume it is the background.

**Do:**
1. Trace with the background disabled as the control. That single A/B answers
   the biggest open question on this page.
2. If it is not the background, bisect by disabling the attract act
   (`hero-act.svelte.ts`), then the marquee, then PostHog's recorder.
3. Note each frame of the background loop is ~10–12 ms — *under* the 50 ms
   long-task threshold, so background cost is invisible to long-task analysis
   and will not show up in step 1's task list. Measure fps, not tasks, for it.

**Known prior measurement** (`reference_background_loop_perf_tax`, /choreo
2026-07-05, controlled, same run and focus): **41 fps with the backgrounds rAF
loop vs 60 fps / 0 dropped frames with it starved.** ~10–12 ms JS per frame,
60–70% of a 16 ms budget.

**Measurement gotcha:** Chrome throttles rAF for occluded windows while
`visibilityState` stays `"visible"`. fps readings require the page actually in
front. Long-task and trace-attribution numbers stay valid under occlusion.

---

## P3 — Cheap certain deletions

Independent of everything else. Any session can take these; they need no
baseline and carry no risk.

- [x] **Self-host the guide cover fonts.** Done, `bcf7aa0ef2`. Verified on the
      landing page: zero requests to googleapis/gstatic, face loads as
      `Cormorant Garamond|italic|500`, cover renders unchanged. Vendored under
      `static/fonts/cormorant/` with its OFL license, matching how Fraunces is
      already handled — no new dependency, no lockfile churn in a shared
      checkout. Note Fraunces was **already** self-hosted at the exact italic
      700 face the cover uses, so half that request had always been redundant.
- [x] **Compress the pictograph dataframes.** Done, `2ee23c602d`. **Much bigger
      than scoped:** the app fetches *all four* dataframes and every one shipped
      uncompressed — **449 KB of transfer that compresses to ~45 KB**, with
      Skewed alone at 368 KB. The plan originally said "33 KB", which was one
      file. Cause: Cloudflare only auto-compresses content types on its
      allowlist; `text/csv` is not on it, `application/json` is. Serving them as
      `text/plain` fixes it, and costs nothing — `csv-loader.ts` reads every
      response with `.text()` and never inspects content type.
- [~] **`arrow-split-manifest.json`** — reclassified, do NOT delete the loader.
      It is the seam for the parked arrow-tip-z-promotion project, and the
      manifest is populated by a manual splitter tool. The 404 is genuinely just
      one wasted request.
      **A hypothesis worth recording as dead:** it is listed in the SW precache
      manifest (`generate-svg-precache-manifest.cjs:110`), which looked like it
      could explain the `sw.js:244` pending flood in Austen's screenshots. It
      cannot — `static/sw.js:78` states outright that a stray 404 must never
      fail install, and `precacheSvgAssets` is written to tolerate it. **The
      pending flood has a different, still-unidentified cause.** Worth folding
      into P2.
      Still unexplained: the file is tracked in git, not ignored, not touched by
      `trim-deploy-assets.js`, and `dash.svg` in the same directory serves 200 —
      yet this one file 404s. Low value, but genuinely odd.

---

## P4 — Background adaptive-quality threshold

**Correct a belief first:** adaptive quality is **already on**.
`AdaptiveQualityManager` defaults `enabled` to `true` (line 52) and
`BackgroundController` constructs it unconditionally with a ceiling and no
options (line 287). `setAdaptiveQuality(true)` from the app is a **no-op**. A
previous session nearly shipped it as a fix.

The real defect is the threshold:

```
downgradeThresholdFps = 30    // AdaptiveQualityManager.js:53
upgradeThresholdFps   = 55
downgradeSustainMs    = 3000
```

The measured tax is **41 fps** — above 30, so it never fires. A background that
halves the frame rate sits permanently inside the "acceptable" band.

**Do:** raise the downgrade threshold to ~50 and consider starting at `low`,
letting the existing upgrade path (55 fps sustained 10 s) climb once the page
is quiet.

**Where:** `E:\shared-packages` (`@austencloud/backgrounds`), then publish and
bump. **Not reachable from the app** — the controller passes no options.

**Do NOT** work around it by calling `controller.setQuality('low')` from
`BackgroundHost`. The manager's internal `currentQuality` stays at the ceiling,
so it will never call `setQuality` again and the background sticks at low
forever. That desync was considered and rejected on 2026-08-10.

---

## P5 — Defer Firebase auth on landing

Approved by Austen: *"we don't need to authenticate everything on Firebase we
can say authenticating."* A visible "authenticating" state on the avatar is
acceptable.

Measured on production, signed-in:

| Request | At | Cost |
|---|---|---|
| `accounts:lookup` | 1.33 s | 301 ms |
| `securetoken` refresh | 3.9 s | 354 ms |
| Firestore channels | 4.8 s+ | 424 ms each |

**Scope honestly:** this only affects signed-in visitors. A first-time visitor
never pays it. It is real, and it is also the item most likely to *feel* like
progress while doing nothing for the audience the page exists for. Sequence it
after P1 unless P0 shows otherwise.

---

## P6 — Make the pre-live state look deliberate

Austen: *"Why do we have this placeholder this placeholder is garbage I hate
how the placeholders look."* The ghost `G G G G` letters read as a broken
render, not as loading.

The fix is not a better skeleton. Even at 500 ms something is on screen first,
so make that something a real, cheap thing: the finished composition with the
stage simply at rest. No ghost glyphs, no shimmer.

**Constraints:** no static pictograph substitute (the strip below owns that).
Reserve the stage footprint exactly as today — `no-layout-shift.md` applies,
and the current placeholder does hold a constant footprint. Do not regress that
while making it prettier.

**Evidence:** screenshots at all seven viewports in
`visual-verification-mandatory.md`, taken and read, not handed to Austen.

---

## P7 — Extend instrumentation past the hero

The hero is instrumented; the rest of the page is not. P2's mystery loop may
well live below the fold.

- [ ] `launchpad:tiles-live`, plus a per-tile mark
- [ ] A mark at the attract act's first generated sequence
- [ ] Give PostHog a later slot, not a smaller one — 443 ms of main thread plus
      a 42 ms forced reflow from the session recorder, currently competing with
      the hero. Same data, later start. **Never remove it.**
- [ ] Investigate the 134-request burst at 1–2 s. Each is only 2–8 ms now that
      caching is fixed, but 134 of them still costs scheduling. Likely
      pictograph cells or arrow SVGs that could be sprited or batched.

---

## Handoff notes for a fresh session

**Reproduce the baseline in three calls:**

```bash
pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank
```

then `new_page` (background: true) on the target URL, then
`evaluate_script` returning `window.__tkaMarks()`.

**Traps that have already cost sessions time:**

- `performance.getEntriesByType('resource')` **caps at 250 entries.** It cannot
  give you a total request count. Treat every number from it as a lower bound.
- **In-page polling is structurally blind here.** Tool round-trip latency is
  ~10 s; two attempts to poll the early load window arrived at 8,954 ms and
  10,253 ms, by which time everything had resolved. Use
  `performance_start_trace` and buffered `PerformanceObserver`, or the marks.
- `performance_stop_trace` **requires `pageId`.**
- A DevTools trace is **browser-wide**. Firestore channels from another tab were
  once attributed to this page and nearly got the wrong system blamed. Confirm
  with `list_network_requests` scoped to the page before blaming a subsystem.
- Cloudflare edge can serve stale responses mid-rollout. Verify deploys with
  cache-busting query params before concluding a deploy failed.
- **Nothing reaches production while CI is red, and the failure is silent.**
  Cloudflare's own auto-deploy for the production branch is turned **OFF**
  (`.github/workflows/pages-deploy.yml`). The only path is the deploy hook,
  fired by `Deploy Pages (gated)`, which runs on `workflow_run` completion of
  `Web App CI` and proceeds only `if workflow_run.conclusion == 'success'`.
  A red suite means the deploy job reports **`skipped`** — not `failure` — so
  a casual glance at the run list looks fine while production is frozen.
  **Check `gh run list` for a green `Web App CI` before polling production for
  anything.** On 2026-08-10 this cost 15 minutes of polling a build that was
  never going to start, on a red suite owned by an unrelated session.
- The gated action only fires a webhook; Cloudflare builds separately, so
  there is still a lag after CI goes green. A poll started before the webhook
  fires will report a false timeout.
- `workflow_dispatch` can force a deploy past the gate. That ships `main` with
  a red suite, which is the exact thing the gate exists to prevent — it is
  Austen's call, never an agent's.

**Files that matter:**

| Path | Role |
|---|---|
| `src/lib/shared/performance/landing-marks.ts` | The instrument |
| `src/lib/shared/landing/components/SequenceHeroDemo.svelte` | Hero, `LazyMount` boundary, activation policy |
| `src/lib/shared/landing/components/HomeHero.svelte` | Passes `loadPriority="immediate"` |
| `src/lib/actions/activate-when-near.ts` | The idle/immediate scheduling split |
| `src/lib/shared/background/shared/components/BackgroundHost.svelte` | Background mount, resolution cap |
| `src/lib/shared/landing/data/hero-act.svelte.ts` | The attract act |
| `tests/unit/landing-constrained-performance-contract.test.ts` | Locks these decisions against silent regression |
| `_headers` | Cache policy, with the reasoning inline |

**The contract test is load-bearing.** It exists because every one of these
regressions still compiles and still looks fine on a fast desktop. If it fails,
fix the source — do not loosen the test.
