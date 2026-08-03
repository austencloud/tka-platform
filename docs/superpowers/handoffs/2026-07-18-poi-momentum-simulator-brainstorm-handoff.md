# Poi Momentum Simulator — Brainstorm Handoff (2026-07-18)

## Mission

Turn poi move-legality from **5 hand-authored symbolic rules** into something
grounded in real physics. Austen's thesis (his own domain theory — this cannot
come from MCP, poi is not canonical TKA yet): **poi legality is governed by
momentum continuity.** A move is poi-legal only if it continues a physically
achievable momentum from the previous move, and "achievable" is set by physics —
a poi is a **tethered mass under gravity**, so hand speed determines what the
head can do. His worked example: an **extension** (head held at full reach) is
impossible below a minimum hand speed, because the cord needs enough rotational
momentum to stay taut against gravity — a constraint the abstract kinetic
alphabet does not have.

The open proposal: **build a reliable 2D simulation of a tethered prop under
gravity** to live-test whether specific poi patterns are physically performable,
with momentum calibrated to real gravity. This doc hands off a **brainstorm in
progress** (via `superpowers:brainstorming`) — **no design spec written yet.**
We paused at the first clarifying question. Continuing on Austen's laptop with
Abel.

Existing (incomplete) design spec for the current symbolic filter:
[2026-07-17-poi-legal-composer-filtering-design.md](file:///E:/tka-platform/docs/superpowers/specs/active/2026-07-17-poi-legal-composer-filtering-design.md)
— its own "open questions" already admit the 5 rules are a first-pass model.

---

## Done — verified

Poi prop now renders **club-style** (gripped at the knob, ball sticks out from
the hand point in the orientation direction, ~half a staff's reach on one side)
instead of staff-style (centered on the hand point), and is classified as a
small unilateral prop.

- **Commit `69a530ab48`** (on `origin/main` — confirmed with
  `git branch -r --contains 69a530ab48` → `origin/main`). 7 files:
  - `static/images/props/pictograph/poi.svg` — knob (grip, r8) at **exact
    viewBox center (150,75)** of `0 0 300 150`; cord + ball (r30) extend +x only,
    ball at `cx270` reaching edge x300 → grip-to-edge reach = 150 = viewBox
    width/2 (club's per-side ratio). `fill:none` mirror path on −x for
    bbox-consumer parity.
  - `"poi"` added to `SMALL_UNILATERAL_PROPS` in all 3 **live** copies
    (`src/lib/shared/pictograph/prop/domain/enums/prop-classification.ts`,
    `src/lib/shared/render/core/constants/prop-classification.ts`,
    `packages/render-core/src/constants/prop-classification.ts`) + test
    (`src/lib/shared/render/core/__tests__/prop-classification.test.ts`) +
    `prop-type.ts` + `.claude/agents/prop-positioning-expert.md`.
- **Evidence:**
  - Anchor mechanism read from source, not assumed:
    `PropSvgLoader.parsePropSvg` (`src/lib/shared/pictograph/prop/services/prop-svg-loader.ts:243-267`)
    anchors every prop at raw `viewBox width/2, height/2` — `#centerPoint` is an
    arrow-only convention, never read for props. So grip-at-center =
    grip-on-hand-point, provably.
  - Classification drives **beta-offset only, no render scale**
    (`isSmallProp`/`isBigProp` are dead code, zero call sites) — so "half-size
    like a club" is 100% the SVG geometry above, correct.
  - `curl -sk https://127.0.0.1:5173/images/props/pictograph/poi.svg` → HTTP 200,
    `image/svg+xml`, real `<svg>` (not the SPA HTML fallback that masks 404s).
  - `npx vitest run` on the 3 targeted files → 21/21 passed.
    `npm run check:fast` → 30 pre-existing errors, **none** in touched files
    (grepped log for `prop-classification`/`poi` → 0 hits).
  - Runtime: `isUnilateralProp('poi')` / `isUnilateralProp('POI')` → `true`;
    `getBetaOffsetSize('poi')` → 21.11 (default bucket).
- **User sign-off on the look:** Austen, 2026-07-18 — *"It looks good enough for
  me right now."* (This is his eyeball approval; the aesthetic is accepted.)

Earlier poi activation work (all on `origin/main`, verified in prior session):
- `ec0fc72129` — created the missing render asset
  `static/images/props/pictograph/poi.svg` (root cause of "poi selected but
  doesn't draw") + the approved simplified button glyph
  `static/images/props/buttons/poi.svg`.
- `5a2fc53fe6` — `PictographPreparer` no longer caches a color's result when its
  prop asset failed to load (cache-poisoning fix).
- `63b11fb5b5` — prop-positioning-expert doc: render-asset loading section.

---

## Believed done — unverified

- **poi beta behavior at overlap (both hands on the same point).** poi is now
  in `SMALL_UNILATERAL_PROPS`, so its Gate-5 beta-offset skip matches
  club/contactball. Whether that is *correct* for poi is a **structural-analogy
  judgment, not an MCP-grounded fact** — the Flow Arts MCP has **no** poi entry
  (`get_term_definition("poi")` / `get_domain_topic("poi")` both returned
  nothing; expected, "Poi Lab is planned, not built"). Verify against Austen /
  real poi practice before trusting poi at beta. Flagged in
  `.claude/agents/prop-positioning-expert.md`.

---

## In flight

Nothing uncommitted that is mine. The brainstorm state lives entirely in this
doc. Working on `main` directly (per `worktree-workflow.md` — worktree mandate
reversed 2026-07-18). Shared checkout, many concurrent sessions — other
sessions' work is in the tree; do not touch it. Commit scoped.

---

## Loose ends (ranked) — where the next agent starts

**#1 — Answer the paused brainstorm Question 1: is "poi-legal" binary or a
tempo envelope?** The three framings on the table (my recommendation: **C**):

- **(A) Pure tempo envelope** — nearly every move has a minimum-tempo (hand
  speed) floor; below it the cord goes slack and the move collapses. Output =
  "min BPM," not yes/no.
- **(B) Mostly categorical** — legality is move-to-move momentum compatibility
  (spin/direction/orientation continuity); tempo secondary.
- **(C) Two separable layers** — categorical ("can B follow A *at all*?", e.g.
  spin reversal needs a stall beat) **+** physical ("at what tempo does the cord
  stay taut?"). Sim answers both, reported separately.

I lean **C**: it's the only framing that holds *both* the extension floor
(physical) and the spin-reversal stall (categorical) without forcing one to
explain the other. **Austen has not answered yet** — get his read first; it
defines what "legal" means and reshapes the whole build.

**#2 — Then Question 2: what is the sim's *job*?** Options to put to him:
(a) an **offline research instrument** that *derives* better rules — production
composer filter stays fast + symbolic, sim informs the rules; (b) the sim **is**
the runtime validator (run physics to check feasibility live); (c)
understand-first exploration, rules later. His message leans (a)/(c) ("if we
could construct a reliable 2D simulation… that might reveal a lot").

**#3 — Then design the 2D simulator.** Reuse target is decided by the recon
below — do NOT hand-roll a solver:
- **`src/lib/shared/3d/environments/scenes/ocean/runtime/fauna/jellyfish/jellyfish-verlet.ts`**
  — a working, dependency-free position-Verlet solver. Already has:
  `createPointConstraint` (pin = the **hand**), `createDistanceConstraint` with
  **min/max** (set min=0 → **tension-only cord**, the key mechanism),
  per-particle inverse mass, pluggable `addForce` (add constant gravity),
  `tick(delta)`. A poi = `pin(hand) + tension-tether + point-mass(head) +
  gravity`. It's 3D; zero the z-axis for 2D. Currently applies **no** gravity
  (animates via oscillating constraint lengths).
- Contrast against the existing **kinematic** path math in
  `src/lib/shared/mandala/services/mandala-geometry-calculator.ts` (that's how
  props move *today* — pure angle interpolation, no forces; the sim must
  reproduce or diverge from it deliberately).
- **Calibration problem (Austen's "we'd figure it out somehow"):** TKA has no
  absolute time; real gravity (9.81 m/s²) + real tether length (~0.5–0.9 m) do.
  So feasibility depends on **absolute tempo** (BPM → hand speed in m/s). The
  honest sim output is a **minimum BPM** per transition/sequence, not a binary
  flag. This is the calibration to nail: map (beat duration, tether length) →
  real hand speed, compare centripetal demand vs gravity for cord tautness.

**#4 — Continue the brainstorming skill to a design doc**, then
`superpowers:writing-plans`. (We are at brainstorming step 3, "ask clarifying
questions." Do NOT skip to implementation — the brainstorming HARD-GATE stands.)

---

## Decisions already made (do not re-litigate)

- **poi renders club-style, gripped at the knob, ball sticks out** — approved
  2026-07-18 ("looks good enough for me right now"). Do not revert to
  staff-style or re-open the glyph (it went through ~5 rounds already).
- **poi classified `SMALL_UNILATERAL_PROPS`** — landed in `69a530ab48`.
- **The button glyph `static/images/props/buttons/poi.svg` is final** — approved;
  only the *render* asset's anchor/scale was in scope. Leave the button.
- **The physics reframe (tension-only cord → tempo-dependent feasibility) is my
  framing, NOT yet Austen's ratified decision.** He said "all good questions"
  and deferred to the laptop session. Treat it as a strong hypothesis to
  confirm at loose-end #1, not settled canon.

---

## Gotchas (things the next agent cannot derive from the code)

- **MCP has zero poi canon.** Poi is not canonical TKA (Poi Lab planned, not
  built — `src/routes/(public)/notation/poi/+page.svelte` says so). All poi
  *theory* comes from Austen's brain; do NOT fabricate poi facts or "poi
  community lore" (see `no-fabrication.md`, `feedback_no_fabricated_community_lore`).
  MCP is still authority for general TKA (letters/VTG/positions).
- **The current 5 rules are wrong/incomplete by Austen's own account** — "it
  didn't really get it right." Do not treat `poi-constraint-validator.ts` as
  ground truth; it's the thing we're trying to replace/ground.
- **The physical mechanism behind the extension floor is cord *tension*, not
  "speed."** A tether only *pulls*. Enough momentum → taut → extended. Too slow →
  gravity wins at the top of the circle → cord slack → head falls. Model the
  cord as a **tension-only max-length constraint** (Verlet distance constraint,
  min=0) + gravity and this emerges for free — no rule tuning.
- **Feasibility is tempo-dependent** — a sequence can be illegal at 60 BPM,
  legal at 180 BPM. A binary legal/illegal filter is likely the wrong shape.
  Settle loose-end #1 before building any filter.
- **Two unrelated "poi" trees are NOT legality:** `src/lib/features/poi/` and
  `src/lib/shared/poi/` are LED / POV-strip-pattern hardware/animation code. All
  move-legality lives in **`src/lib/features/levels/poi-lab/`**.
- **"Continuity" is overloaded** — the general option-picker reversal filter
  (`option-picker-state.svelte.ts:115-129` + `reversal-checker.ts`) is distinct
  from the poi spin-reversal rule (`poi-constraint-validator.ts:84-100`). The
  poi filter runs *after* the reversal filter.
- **The composer poi filter is dark-gated:** `isPoiComposerFilterEnabled()` =
  `import.meta.env.DEV || isAdmin()`. Prod treats poi as planned.
- **Two other real physics substrates exist** if 3D/rigid-body is ever wanted:
  **Rapier3D** (`src/lib/shared/3d/physics/rapier-world.ts`, gravity + rope/
  spherical joints, but wired only to the walking avatar) and a stubbed miniplex
  ECS physics (`procedural-engine/core/systems.ts`, TODO, unused). Verlet is the
  lighter, better fit for a 2D poi sim.
- `:5173` is Austen's dev server — read-only `curl` only, never restart/kill it.

---

## Fast orientation for the fresh agent

1. Read this doc top to bottom.
2. Read `poi-constraint-validator.ts` + `poi-gravity-orientation-deriver.ts`
   (the whole current legality model, ~150 lines).
3. Skim `jellyfish-verlet.ts` constraint/force API (the reuse target).
4. Re-invoke `superpowers:brainstorming`, resume at loose-end #1, ask Austen
   Question 1. Do not write code before a design is approved.
