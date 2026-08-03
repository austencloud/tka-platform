# Halved Pictograph → Guide — Handoff (2026-07-15)

**For:** the next agent (Fable 5, on another machine) picking up the halved-pictograph
pipeline and its first consumer, the Level-2 guide turn-lesson pages.
**From:** the Opus session that shipped Phase 1 + Phase 2a and stood up the visual
proof page.
**Status:** Phase 1 ✅ and Phase 2a ✅ are **fully committed and pushed on `main`**
— nothing of mine is dangling. Phase 2b (visual tuning, needs Austen's eye) is
next; Phase 3 (guide rewire + the tiny-render fix) follows. Nothing is blocked.

> Read this whole file first, then the durable topic memory
> `C:\Users\Austen\.claude\projects\E--tka-platform\memory\project_halved_pictograph.md`
> and the design spec
> `docs/superpowers/specs/2026-07-14-halved-pictograph-pipeline-design.md`
> (its §11 ledger is the authoritative task list — this handoff points into it).

---

## 0. TL;DR — where we are

| Phase | What | State |
|---|---|---|
| 1 | Halfway-orientation algebra (the keystone) | ✅ shipped — engine-grounded, t=1 invariant PASSED 2464 real comparisons, 0 mismatches |
| 2a | Half-motion arrow pipeline plumbing (segment discriminator, `_half` assets, pure rotation) | ✅ shipped — 31/31 tests, 7-motion `poseAt` oracle exact, 0 new tsc errors |
| **2b** | **Visual tuning of the 4 seed glyphs** | **← NEXT. Needs Austen's eye on the proof page.** |
| 3 | `buildHalvedStep` + `showArrow` prop + rewire the 3 Level-2 turn pages to real pictographs (kills the tiny-render bug) | not started |
| 4 | Product UX (halve-any-pictograph surface) | deferred / out of scope here |

The whole point of the project: the Level-2 turn pages **render tiny today** because
they bake a lifted staff+arrow drawing onto a bare hand-dot grid instead of a real
pictograph. Phase 3 is the payoff that fixes that. Phases 1/2a built the machinery
to make Phase 3 correct.

---

## 1. The proof surface + how to bring it up on the new machine

Phase 2b is reviewed on the test route:

- **Route:** `src/routes/test/half-arrows/+page.svelte`
- **Local URL (home machine, primary checkout HTTPS vite):**
  [localhost:5173/test/half-arrows](https://localhost:5173/test/half-arrows)

It renders each of the 4 `_half` arrows (`pro`/`anti`/`dash`/`static`) placed by the
**real** positioning pipeline over a diamond grid. Pipeline rotation is oracle-exact
for all 7 guide motions; the **glyph art is native orientation** — no per-glyph
rotational offset, no pixel nudges yet. That's exactly what Phase 2b tunes.

### If reviewing remotely (repro of what this session did)

The primary checkout serves HTTPS/h2 on `:5173` (cert at `.cert/dev-cert.pem` +
`dev-key.pem`). `curl` in the shell **cannot** verify h2-https origins (no `--http2`
support → returns `000`); use node's `http2` client to probe instead, or just open a
browser.

To expose it publicly with a throwaway Cloudflare quick tunnel (what got Austen a URL
while remote), two traps must be avoided — both cost this session real time:

1. **IPv6 trap.** `cloudflared --url https://localhost:PORT` resolves `localhost` to
   `::1` (IPv6) first. Vite binds `host: 0.0.0.0` (IPv4 only). On a busy box another
   process may answer `::1:PORT` and 404. **Point the tunnel at `127.0.0.1`, never
   `localhost`.**
2. **Config-pollution trap.** `cloudflared` auto-loads `~/.cloudflared/config.yml`
   (the named `tka-dev` tunnel), whose catch-all ingress is `service: http_status:404`.
   A bare `--url` tunnel inherits it and every path 404s from the Cloudflare edge
   (`Server: cloudflare`, `CF-Ray` present, origin never hit). **Force an empty
   config to run a pure quick tunnel:**

```bash
printf '# empty\n' > /tmp/empty-cf.yml
cloudflared tunnel --config 'C:\path\to\empty-cf.yml' --url https://127.0.0.1:5173 --no-tls-verify
# grab the https://<slug>.trycloudflare.com URL from the log
```

`.trycloudflare.com` and `dev.tkaflowarts.com` are both already in vite's
`allowedHosts` (`vite.config.ts`), so no host-allow edit is needed.

---

## 2. Cleanup items ("what got left rough") — do these

None of my committed code has a known correctness bug (31/31 green, oracle exact).
The rough edges are **intentional deferrals** and **infra**, listed honestly:

1. **The guide is still broken the way the project set out to fix it.** The 3 Level-2
   turn pages still render tiny via `LiftedTurnFrame`. That's Phase 3 — the headline
   cleanup. See §5.
2. **The 4 `_half` glyphs are visually untuned** (native orientation, `0` adjustment
   baseline). Correct position + rotation, but the art may point the wrong way or sit
   off-center until Phase 2b nudges them. See §4.
3. **`dev.tkaflowarts.com` infra note (Austen owns this config — do not change it
   remotely).** The named `tka-dev` tunnel (`~/.cloudflared/config.yml`, id
   `45e069fb…`) routes `dev.tkaflowarts.com → https://localhost:5173` with
   `noTLSVerify: true`. It 502s whenever `:5173` answers **HTTP** instead of HTTPS
   (e.g. a worktree vite with no cert). On the home machine, if `:5173` is the primary
   checkout's HTTPS vite, `dev.tkaflowarts.com` should Just Work — verify in a browser
   before assuming it's broken. If it 502s, the fix is one of: (a) ensure `:5173` is the
   cert-bearing primary checkout, or (b) point the ingress at `http://localhost:5173`.
   Either is Austen's call.
4. **Ephemeral runtime from the remote session is gone.** The `:5177` vite and quick
   tunnel this session spawned die with the session. The new machine starts fresh —
   just bring up the primary `:5173` and open the local URL.

---

## 3. ⚠️ Parallel-session hazard — DO NOT TOUCH

A **different, concurrent session** is mid-flight on the Level-1 guide "card stage"
work (`project_guide_card_stage`). As of this writing the shared working tree has
**their uncommitted edits**:

```
 M src/lib/features/choreo-card/components/ChoreoCard.svelte
 M src/routes/(public)/guide/level-1/_components/FlowFrame.svelte
 M src/routes/(public)/guide/level-1/_components/GuideCardStage.svelte
?? docs/superpowers/specs/2026-07-15-guide-card-stage-handoff.md   (their handoff)
?? docs/superpowers/specs/.claims/2026-07-03-fable-real-flow-notation-validation-design.md.lock  (a Fable claim lock, not ours)
```

Also phantom deletions of `static/guide/level-1/images/**` (case-collision artifacts,
see commit `64252bab67` / `d9ddf07e0d`) — **not ours, leave them.**

**Rules (`.claude/rules/commit-only-your-own-changes.md`):** never `git add -A/./-u`,
never a bare `git commit`, always scope commits with an explicit pathspec, and never
revert/stage another session's files. My work lives in `level-2` + `src/lib/shared/
pictograph`; theirs is `level-1` + `choreo-card`. Stay in your lane.

---

## 4. Phase 2b — visual tuning (needs Austen's eye; NOT started)

Task ledger (mirrors spec §11):

- [ ] Screenshot-review `/test/half-arrows` against the guide artboards; confirm each
      glyph's placement + rotation fidelity per motion type.
- [ ] **Per-glyph rotational-reference offset** — if a hand-drawn glyph's "head"
      reference differs from the canonical `0`, add a per-glyph offset. Do it at the
      asset/normalization layer, not by corrupting the pure rotation math.
- [ ] **Authored `_half` pixel nudges** — add a sibling `_half` default-tier
      placement bucket (`default_diamond_{pro,anti,dash,static}_half_placements.json`
      + key-generator recognition). Swap the orchestrator's `0` adjustment baseline
      for the real lookup. **Do NOT extend the hardcoded `motionTypes` array** — the
      segment path is a sibling bucket, not a new motion type.
- [ ] Audit which resolver actually runs live: `getArrowSvgPath` vs `getArrowPath`
      (both got the `_half` branch; confirm the render path).

**Key files (all committed):**
- `src/lib/shared/pictograph/arrow/positioning/calculation/services/segment-rotation.ts`
  — pure rotation from Phase 1's `orientationToStaffAngle` bijection. **Do not import
  the animation-engine here** (would create a `pictograph → animation-engine →
  pictograph` cycle). Tuning happens elsewhere.
- `static/images/arrows/{pro,anti,dash,static}_half/from_radial/*_half.svg` — the 4
  seed glyphs.
- `scripts/extract-half-glyphs.mjs` — re-extractor (pulls glyph subpath 1 from
  `LIFTED_TURN_FRAMES`); re-run if the source art changes.

Glyphs are **turn-invariant** (turns rotate, they don't redraw) → 4 assets, not a
per-turn family. Don't author per-turn variants.

---

## 5. Phase 3 — render integration + toggle + guide rewire (the payoff)

Task ledger (mirrors spec §11):

- [ ] **`buildHalvedStep(step: StepData, t = 0.5): StepData | null`** — compose a real
      pictograph of the halfway state: set each motion's `segment: {t0, t1}`, and set
      `endOrientation` to the Phase 1 halfway orientation
      (`calculateOrientationAt(input, t)`). Returns `null` for off-lattice
      (quarter-turn / thirds) → caller falls back to a visual `poseArrow`.
- [ ] **Thread `showArrow` as a real prop** from `PictographContainer` →
      `PictographRenderer`. `ArrowSvg.svelte` already honors `showArrow`, but
      `PictographRenderer.svelte` hardcodes it `true` (~lines 414 / 433 / 454).
      Default stays `true` (no behavior change for existing callers).
- [ ] **Rewire the 3 turn pages** to real pictographs:
      - `src/routes/(public)/guide/level-2/_pages/TurnsPage.svelte`
      - `src/routes/(public)/guide/level-2/_pages/TwoTurnsDashStaticPage.svelte`
      - `src/routes/(public)/guide/level-2/_pages/TwoTurnsShiftsPage.svelte`
      halfway frames → `buildHalvedStep(step, 0.5)` → real pictograph with the correct
      halfway orientation + the half-arrow. On-lattice halves + quarters → pipeline;
      thirds/off-lattice → visual `poseArrow`.
- [ ] **Remove `LiftedTurnFrame`** (`src/routes/(public)/guide/level-2/_components/
      LiftedTurnFrame.svelte`) once the pages render real pictographs. The lifted
      glyphs already live on as the `_half` assets, so
      `src/routes/(public)/guide/level-2/_data/lifted-turn-arrows.ts` can retire after
      the extractor is no longer needed. Keep the interim lift in place until the
      rewire lands, then delete.
- [ ] **Screenshot proof** the tiny-bug is gone (verification-protocol: real
      before/after, not a "should be fixed" claim).
- [ ] **Turn-page contract test** asserting the pages render real pictographs, not
      `LiftedTurnFrame` (same discipline as `sequence-viewer-shell-contract.test.ts`).

---

## 6. Fable routing (this handoff will be executed by Fable 5)

`.claude/rules/fable-routing.md` is active while the session model is Fable. Use the
sandwich: **explore** with Sonnet/Haiku (`effort: low`) to map call sites; **plan** on
Fable (the main loop); **execute** the mechanical edits (asset nudges, prop threading,
page rewires) with Sonnet subagents from the plan; **review** the diff on Fable. Pass
`model` explicitly on every dispatch — omitting it spawns a Fable subagent at ~2× cost.
Executors: re-read the spec ledger each phase, prove completion with tool output,
commit with an explicit pathspec.

---

## 7. File + commit inventory

**Phase 2a commits (all on `main`):** `60d038d6a3` (MotionData.segment) ·
`2337be4a27` (`_half` path both resolvers) · `e69351e92a` (location→endLocation) ·
`30d5a28955` + `d0a66ce3a1` (segment-rotation pure + dedup) · `e9153fe3ce` +
`8880f67e1f` (orchestrator guard + type fix) · `795408d7f6` (4 seed glyphs) ·
`1a6dc27e2c` (7-motion oracle + dash-center fix + `/test/half-arrows`).
Ledger update: `c274830f31`. Plan: `b6c4d0ddea`.

**Phase 2a source files (committed):**
- `src/lib/shared/pictograph/shared/domain/models/motion-data.ts` — `segment?` field
- `src/lib/shared/pictograph/arrow/rendering/services/arrow-path-resolver.ts` — `_half` dir
- `src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-location-calculator.ts` — half branch
- `src/lib/shared/pictograph/arrow/positioning/calculation/services/segment-rotation.ts` — pure rotation (NEW)
- `src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-rotation-calculator.ts` — half branch
- `src/lib/shared/pictograph/arrow/orchestration/services/arrow-positioning-orchestrator.ts` — `0` baseline guard
- `src/lib/shared/pictograph/arrow/positioning/__tests__/half-arrow-pipeline.test.ts` — 7-motion oracle
- `src/routes/test/half-arrows/+page.svelte` — proof surface
- `scripts/extract-half-glyphs.mjs` + `static/images/arrows/*_half/from_radial/*_half.svg`

**Docs:** spec `docs/superpowers/specs/2026-07-14-halved-pictograph-pipeline-design.md`
· plan `docs/superpowers/plans/2026-07-14-halved-pictograph-phase-2-arrow-identity.md`
· phase-1 plan `docs/superpowers/plans/2026-07-14-halved-pictograph-phase-1-orientation-algebra.md`.

---

## 8. First moves on the new machine

1. Bring up the primary checkout on `:5173`, open
   [localhost:5173/test/half-arrows](https://localhost:5173/test/half-arrows).
2. Have Austen eyeball the 4 glyphs. Capture his notes → that IS the Phase 2b input.
3. Apply Phase 2b nudges (§4), re-screenshot, confirm.
4. Then Phase 3 (§5): `buildHalvedStep` → `showArrow` prop → rewire the 3 turn pages →
   delete `LiftedTurnFrame` → screenshot the tiny-bug gone → contract test.
5. Update the spec §11 ledger + `project_halved_pictograph.md` memory as you go.
