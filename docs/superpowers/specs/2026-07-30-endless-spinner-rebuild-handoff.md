# Endless Spinner Rebuild — Handoff (2026-07-30)

## Mission

`/endless-spinner` was rebuilt ground-up per
[2026-07-29-endless-spinner-rebuild-design.md](2026-07-29-endless-spinner-rebuild-design.md)
(plan: `docs/superpowers/plans/2026-07-29-endless-spinner-rebuild.md`): Live
mode retired (its Cloud Functions writer was deleted from the deployed codebase
~2026-05-04; nothing could broadcast), Infinite made the canonical default,
canonical LOOP chips replace the hand-rolled mode-info panels, the StepStrip
read-ahead pattern replaces the always-on choreo grid (grid stays as a second
view), the transport was centered and de-developered, and the route was
promoted into production builds. Execution: Codex CLI ran plan Tasks 1–6,
Claude (Fable) ran the first visual sweep, Claude Opus 5 re-composed the
layout per viewport after Austen rejected the first sweep's results, then three
Austen-driven polish rounds landed on top.

## Done — verified

All on local `main`. Evidence commands were run 2026-07-29/30 against the tree
at `052b821eda`.

- **Live mode retired** — `c8ca4f731b` (16 files, −1,082 lines: broadcast
  repository/converter/schemas/models, `LiveModeInfo`, live branches in
  chaining orchestrator + playback state + session + toggle + page + tests).
  Evidence: `grep -rniE '"live"|broadcast'` over the spinner stack returns only
  `AnimationCanvas.svelte`'s unrelated live-render-vs-video mode; the two
  spinner suites pass (below).
- **LoopChips quartered icon swap** — `b38b6d87a7`. `rotationPeriod`/
  `inversionPeriod` props mirror `LOOPIconStrip` canon (`fa-arrows-spin`,
  `CheckerboardCircleIcon`); existing store consumers render unchanged
  (optional props). Evidence: fast-check 0 diagnostics on the file + 3
  consumers.
- **SpinnerNowPlaying replaces mode infos + stats** — `206686f3c6` (−655
  lines: `InfiniteModeInfo`, `LibraryModeInfo`, `SpinnerStatsBar` deleted).
  Chips driven by `LOOP_COMPONENT_MAP` via sequence `components`/`loopType`
  with generator-settings fallback. Metrics WRITES retained (repository calls
  in the generator); only the display died.
- **Centered transport, history replays** — `bf9a0ad709`. Three-zone grid,
  play dead-center; history rows replay via the previously-unused
  `hotSwapSequence` (verified live on SE: replay swaps the playing sequence).
- **Stage rebuild + per-viewport composition** — `899b448ce3` (Codex initial),
  `c3e348a000` (Fable sweep fixes), `3fe70d974f` + `49d8060f0c` (Opus 5
  recomposition + phone fixes). Final shape: side-by-side hero card + rail
  (chips / lane-or-grid / transport) on desktops and landscape mid-windows;
  stacked with centered strip foot on tablet portrait; full-bleed canvas +
  docked transport + fixed history sheet on phones; side-by-side on the fold.
  Route-owned `SpinnerStepLane` drives the shared `StepStrip` directly
  (see Gotchas for why not `PracticeLanePane`).
- **Production promotion** — `804f29acb9`: `landing` feature → `tier:
  "shipped"`, route removed from `DEV_ONLY_ROUTE_PATTERNS`. Evidence:
  `npm run build` PASS 2026-07-29; server bundle `du -sh
  .svelte-kit/output/server/` = 14 MB (< 25 MiB CF worker cap — Codex's
  "4,335 bytes" figure was the entry shim, disregard it).
- **Debug button + panel removed** — `58ee0a9d4f` (−317 lines,
  `EndlessSpinnerDebugPanel.svelte` deleted, copy-for-AI plumbing and 2 dead
  i18n keys with it). Evidence: repo-wide grep for the component = 0; SE frame
  shows a 4-button dock; `messages/en.json` parses.
- **Fresh-sequence beat** — `0ffbc95ab8`. Lane/grid crossfade + chips keyed on
  `sequenceSwapCount` (also fixes the chips key: generated sequences have no
  `id`, so the old key never changed); one-shot 640ms accent pulse overlay on
  the stage (absolute, reduced-motion-gated). Evidence: mid-animation
  `getComputedStyle` sampled opacity 0.42 at ~400ms post-skip, settled 0 by
  700ms; word/lane content confirmed swapped.
- **Landscape mid-window tier + centered focus cell** — `2cf6dc2172`. The
  side-by-side tier also fires for 601–1049px landscape windows
  (`orientation: portrait` guard keeps real tablets stacked); stacked foot is
  center-anchored so the playing step sits under the canvas (measured 188 vs
  page center 187 on SE). At 904×783: 455px drawing, scroll 904/783 exact.
- **Stage card hugs its drawing** — `052b821eda`. Card width =
  `min(row height − 53px header band, width left beside rail)` via cqw custom
  props, height follows width. Measured: 1920 → card 927×980 / drawing
  904×904; 904×783 → 472×525 / 455; fold → 265×318 / 248. Bands went from
  ~150px to the ~11px built-in inset.
- **Test/check state** — animation-engine suite: 23 files / 210 tests PASS
  with `--config tests/config/vitest.config.ts` (2026-07-29); the two spinner
  suites 13/13 after every later commit. Full `npm run check` (2026-07-29,
  post-`804f29acb9`): **0 errors**, 5 warnings all in unrelated files.
  Docs: spec `b25193b683`, plan `502e84663a` (+amendment), old 4K-audit
  handoff marked superseded `7f4b39bc2b`.

## Believed done — unverified

- **Production behavior of the promoted route.** The prod build passes and the
  worker fits, but nobody has loaded `/endless-spinner` from an actual
  production deploy (nothing is pushed — see In flight).
- **Reduced-motion**: code-verified only (Crossfade primitive + pulse gate +
  StepStrip's own handling). DevTools MCP emulation doesn't expose
  `prefers-reduced-motion` toggling in this setup.
- **Non-English locales**: ~30 new `landing_spinner_*` keys exist in
  `messages/en.json` only; other locales fall back to English until the
  translation pipeline runs.

## In flight

Nothing uncommitted from this work — `git status` spinner paths are clean.
**Nothing is pushed.** Local `main` carries the full chain above plus other
sessions' commits; `git push` publishes ALL of it and auto-deploys production
via CF Pages (`reference_cf_pages_deploy_topology`). Pushing is Austen's call.

## Loose ends (ranked)

1. **Push + production smoke test.** After Austen authorizes the push, load
   `/endless-spinner` on production, confirm the footer "Endless LOOPs" link
   resolves, both modes generate, and the route's assets serve.
2. **Live-pipeline corpse in Firestore.** `liveBroadcast/*` documents and
   their rules block (`firestore.rules` ~1400-1410) are now orphaned — the
   whole client is deleted. Optional cleanup: drop the rules block and the
   stale docs.
3. **Translations** for the new keys via the local-LLM pipeline
   (`project_local_llm_translation`).
4. **`SpinnerMetricsRepository` counter hygiene**: verification sessions
   incremented the global "ever generated" counter (~15+ times across
   2026-07-28/30). Harmless, but if the number is ever surfaced again, know it
   contains agent noise.
5. **StepStrip transient overlap** during its 250ms slide (scale applies
   instantly while the track eases) — inherent to the shared component, visible
   in both orientations, clean at rest. Fix belongs in `StepStrip` if it ever
   bothers anyone.

## Decisions already made (don't re-litigate)

- **Live mode: retired, not parked** (Austen, 2026-07-29, option "Retire it").
  If live returns it starts from a fresh spec with a real writer.
- **Route ships to production; Infinite is the default; Library stays;
  StepStrip is the primary view with the grid as a toggle** (same AskUser
  round, 2026-07-29).
- **Per-viewport composition over one stretched layout** (Austen, 2026-07-29:
  "if you try to use the same layout on both it's inevitably going to look
  poor on one of them").
- **No Debug button in production** (Austen, 2026-07-30: "Take out the debug
  button and related components") — do not re-add a dev panel to this route.
- **The stage card must hug the drawing** (Austen, 2026-07-30) — reverted
  Opus's "player frame absorbs surplus" judgment call. Don't reintroduce
  letterboxing.
- **Grid view on desktop is a dense 2-column mini-map beside the hero**
  (Opus 5 judgment call, reviewed): one rail width serves both views so the
  canvas never moves on toggle. The wide-card-field alternative was tried and
  looked worse.
- Stats bar, step counts, "Notation" header, "Generated at": deleted by
  design (Austen, 2026-07-29 feedback). Don't resurrect.

## Gotchas

- **`StepStrip` fill-height collapses to ~1px in auto-height containers**, and
  its focus cell caps at HALF the container height by design;
  `PracticeLanePane` force-enables fill-height at ≥768px/landscape (Practice's
  seam). That's why the route owns `SpinnerStepLane` instead. Memory:
  `reference_stepstrip_fillheight_container`.
- **AnimatorCanvas collapses to 0×0 if its card's height is `auto` or comes
  from a flex line** — the card needs definite width AND height (measured
  twice; comments in the page CSS).
- **A `%` inside a CSS custom property re-resolves per usage property** — used
  in a `height` calc it resolves against container height. The shared
  `--card-w` uses `cqw` (with `container-type: inline-size` on
  `.animation-area`) for exactly this reason. Also: container units can't be
  used in the container's own properties, and `container-type: size` zeroes
  intrinsic sizing — both dead ends already tried.
- **Specificity trap**: base rules like `.animation-area.grid-view
  .playback-pane` (3 classes) beat single-class overrides inside media tiers;
  the tiers match specificity deliberately.
- **`sequence.word` is empty for generated sequences** — the page derives
  `displayWord` from step letters. And deep-`$state` proxies broke the
  generator's WeakMap identity lookup until `$state.raw`
  (`reference_svelte5_state_proxy_identity`, commit `6277d794a2`).
- **svelte-fast-check keeps a stale cache** (`.fast-check/`): after deleting a
  component it kept reporting the dead file's diagnostics until its
  `maps/tsx/warnings` artifacts were removed. Its "converting" errors on
  loop-labeler/generate-cards files are tool artifacts, not code errors.
- **vitest 4 needs `--config tests/config/vitest.config.ts`** (jsdom setup) —
  bare runs fail 7 tests spuriously; `--reporter=basic` no longer exists.
- **Verification rig**: own Chrome on :9222 with
  `--force-device-scale-factor=1`; the profile runs 90% zoom, so
  `resize_page` needs ×0.9 compensation (verify `innerWidth`), or use
  `emulate` viewport strings (`"375x667x2,mobile,touch"`), which force a page
  reload when toggling mobile flags. The app boots through a splash — poll for
  `.canvas-container canvas` before measuring.
- **Codex CLI** (`codex exec --dangerously-bypass-approvals-and-sandbox`)
  hangs forever reading stdin unless launched with `< /dev/null`. One run hit
  Windows `0xC0000142` process-spawn failures near the end and misreported its
  own committed work as uncommitted — audit its reports against `git log`.
- The layout tier map (all in `+page.svelte` CSS): base = stacked (phones);
  `601–1049 portrait` = tablet stack with height-budgeted canvas;
  `≥1050, or ≥601 landscape ≥601 tall` = side-by-side; `≥700 wide ≤600 tall` =
  fold side-by-side; `≥2600` = strip-view column rebalance; `≤600` = docked
  transport + fixed history sheet. `--stage-h` is measured on
  `.animation-area` and feeds `--rail-w`/`--card-w`.
