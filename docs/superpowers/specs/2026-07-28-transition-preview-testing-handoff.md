# Transition Preview in Construct — Testing Handoff (2026-07-28)

## Mission

Finish verifying the "preview changed transitions inside Construct" feature so
its feedback item can honestly move from in-review to completed. The code
shipped on 2026-07-24 but Austen has not finished testing it in the app, and it
was deliberately **held out of the v0.31.0 release notes** for that reason
(2026-07-28). There is no design spec for this work — the authoritative
requirements live in the feedback items below. Austen judged this needs a
dedicated session, not a subagent.

Requirements source (fetch with `node scripts/fetch-feedback.js <id>`):

- `nCV6dMShYtH37TCTQKuQ` — "Preview changed transitions inside Construct"
  (in-review, high priority). Contains the full acceptance criteria.
- Parent: `sAQl5lXLuEaAGGDlVRqa` — "Make Construct visible, direct, and
  instantly playable for new users" (in-review). Nicholas Leonardi's
  first-session notes that spawned the whole Construct batch.

## Done — verified

- Implementation committed: `23b9489a5e` "feat(create): preview changed
  transitions in context" (2026-07-24, on main, pushed). 15 files, +860/−117.
  Core files: `src/lib/features/create/domain/changed-transition-playback.ts`,
  `.../sequence-actions/DurationPreviewWorkspace.svelte` (generalized),
  `CreationWorkspaceArea.svelte`, `panel-coordination-state.svelte.ts`.
- Sibling committed: `1189b8249e` "feat(create): add guided option audition"
  (same date, same push).
- Unit tests pass as of 2026-07-28:
  `npx vitest run tests/unit/create/changed-transition-playback.test.ts tests/unit/create/changed-transition-panel-state.test.ts`
  → 2 files, 9/9 passed (987ms).
- A component test exists but was not run in this session:
  `DurationPreviewWorkspace.svelte.test.ts` (browser-mode, non-blocking CI job).

## Believed done — unverified

Everything user-facing. The acceptance criteria in `nCV6dMShYtH37TCTQKuQ` that
nobody has confirmed on a real screen:

1. Append plays preceding beat → new final beat; middle replacement plays
   preceding + replacement + following beat.
2. A new option restarts the same contextual preview without resizing the
   workspace or forcing a drawer close.
3. Stop / return-to-grid without discarding the edit.
4. No history entries or extra autosaves from preview activity.
5. p95 ≤ 250ms warm from option activation to first changed frame; cold loads
   show feedback within one rendered frame.
6. Reduced-motion: changed beat stays visible, manual Play instead of autoplay.
7. No overlapping audio / stale playback when trials change quickly.

## In flight

Nothing for this feature. (The dirty files in the main checkout on 2026-07-28
are another session's endless-spinner 4K pass plus notation-playable test-route
work — unrelated; do not touch.)

## Loose ends (ranked)

1. Runtime-verify criteria 1–4 in Construct (guest path is enough: Create →
   Construct, build a few beats, append and mid-replace). Chrome DevTools MCP,
   own instance, per `visual-verification-mandatory.md`.
2. Measure criterion 5 (250ms p95 warm) — `performance.mark` via
   `evaluate_script`, not eyeballing.
3. Verify criteria 6–7 (reduced-motion emulation; rapid option-switch spam).
4. If all pass: move `nCV6dMShYtH37TCTQKuQ` to completed and announce in the
   NEXT release (it was excluded from v0.31.0). If any fail: file the deltas on
   the feedback item and fix.
5. Same session should decide whether sibling in-review items from the same
   split (`TqkImObi` start-pose builder, `ufG2ov5G` guided first sessions,
   `sAQl5lXL` parent) get the same treatment — they shipped in the same batch
   and are equally untested.

## Decisions already made

- Austen, 2026-07-28: not thoroughly tested → hold it out of the v0.31.0
  release notes; needs "an entire session, maybe with a handoff of the current
  state" — this doc is that handoff. Do not re-announce before verification.
- The feature reuses `DurationPreviewWorkspace` + AnimatorCanvas rather than a
  new preview surface (per the feedback item's own design constraints).

## Gotchas

- The feedback item is the spec. Searching `docs/superpowers/specs/` for
  "transition"/"audition"/"duration" finds only unrelated specs — don't burn
  time hunting for a design doc that doesn't exist (verified 2026-07-28).
- Preview playback must NOT create undo history or autosaves — the tests cover
  the state layer (`changed-transition-panel-state.test.ts`) but not the full
  orchestrator path in the browser.
- `motion-autoplay-policy.ts` gained reduced-motion handling in the same
  commit; verify with actual `prefers-reduced-motion` emulation, not code
  reading.
