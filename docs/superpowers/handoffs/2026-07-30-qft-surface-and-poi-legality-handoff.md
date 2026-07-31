# QfT Surface + Poi Legality — Handoff (2026-07-30)

## Mission

Two threads, both live, both paused mid-brainstorm. They are related: the QfT
app is poi notation, and the poi-legality question is what decides which moves
that notation should be able to express.

1. **Fuse the QfT app's three modes into one surface.** Brainstorm in progress
   via `superpowers:brainstorming`. Design agreed verbally through several
   rounds; **no spec written**. Two questions open, both Austen's to answer.
2. **Poi legality.** `docs/reference/poi-legality.md` written and committed —
   all three prior attempts plus one new measurement. The next step is a
   dataset that does not exist yet.

**Do not skip to implementation on thread 1.** The brainstorming HARD-GATE
stands: design approved in conversation is not a spec, and the spec has not been
written or reviewed.

---

## Done — verified, on `origin/main`

### Poi legality (thread 2)

**`1b13462a88` — `docs/reference/poi-legality.md`.** Gathers the three attempts
(five symbolic rules, the reverted momentum simulator, the 784-cell curation)
and records a measurement nobody had taken:

> A cell in the curated matrix is illegal **iff either hand** is `anti-0-in`,
> `anti-0-out` or `pro-0-in`. **784 agree, 0 disagree.**

Consequences, all in the doc: legality there is per-hand not per-pair; the
by-eye curation and rules 2+3 of `poi-constraint-validator.ts` agree exactly;
the matrix reduces to the 0-turn boundary. The reproduce snippet is in the doc
and was run.

The doc also states plainly what has **no data**: the matrix judges steady-state
patterns only — no reversals, transitions, dashes or floats. 25 of 28 flowers
are legal, so the steady-state layer is *not* where poi is restricted.

### QfT layout (thread 1's prerequisite)

Six commits, 2026-07-29, all pushed. Each was verified with measured pane
overflow across the viewport set plus screenshots; none is speculative.

| Commit | What |
|---|---|
| `ff2dcadd64` | Notation reads as the published written form; docked-phone strip fixed; 3-button transport; layer glyph chips |
| `e625b70c61` | One full-bleed footer; stage takes leftover instead of a `vh` guess; route opted into the 4K root ramp |
| `2a683a7529` | Transport is the app's floor (was riding up onto the drawing); notation column count keyed to panel width |
| `bed58ac21e` | Stage reserves the chrome's **measured** height, so an open tray sits under the drawing — notation and the step it describes on screen together |
| `35ebdecaeb` | `fit` on Matrix + Knobs stages; two-column tier lowered 1440→1024 and its height floor 45rem→33rem; reading column centred; top-bar controls scale past 1680 |
| `d0c1a342f8` | Stage track `minmax(0, auto)` against a square box so drawing + reading column centre as one pair; **Charlie/Drex convention switcher removed, everything reads Drex** |

Final sweep: no pane overflow on either axis, all three modes, at 3840×2091,
2560, 1920, 1680, 1440, 1366, 1280, 1100, 1024 (at 768/700/1366 tall), 960×412,
1920×412, 820×1180, 768×1024, 560×1103, 375×667.

**Two known exceptions, both Matrix, both scrolling not clipping:** 67px at
960×412 (two twelve-chip axes plus a mode control exceed a 178px panel; closing
it means 26px flower previews or breaking the 44px touch floor), and 33–75px
between 660 and 700px of height.

### Environment

**`.mcp.json` `tka-domain-local` fixed** (local only — the file is gitignored).
It relied on a `cwd` field; Claude Code does not apply it, so the server was
spawned from the project root and died with `Cannot find module`, giving -32000
on every connect. Now an absolute path in `args`. Memory:
`reference_mcp_json_no_cwd`.

---

## Decisions made — do not re-litigate

**QfT surface (agreed in conversation, 2026-07-29/30):**

- **One mode**, not three. Guide / Knobs / Matrix collapse into a single surface
  with toggles inside it.
- **Both controls, bound** (Austen chose option C): the flower picker and the
  knobs edit the same per-hand state; touching either updates the other.
- **Per-step prop rates are the model.** `propRate[8]` replaces the scalar
  `downbeats × spinSign`. `propIndexAt` becomes a prefix sum plus a fractional
  remainder instead of `rate · u + phase`. The three pendulum functions
  (`pendulumIndexAt`, `tracePendulum`, `buildPendulum`) are **deleted**, not
  joined by a fourth.
- **Named patterns are the UI layer.** A pattern writes the array and declares
  its own controls. The model never learns the word "pendulum".
- **Direction convention: Drex only.** Switcher already removed in `d0c1a342f8`.
  `directionCharlie` stays in the model.

**Poi domain facts (Austen's, this session):**

- **Rotation is not a symmetry for poi.** TKA is rotation/reflection invariant
  because gravity is irrelevant to it. QfT is poi notation and gravity means
  everything, so a reversal at 4 and 8 is not "the same move rotated" — it does
  not exist. Any code treating the compass as rotatable is wrong for
  gravity-bound patterns.
- **Reversals sit at 2 and 6** (the horizontal) with the hand path continuous
  either way.
- **Every flower is momentum-performable.** The whole VTG set and shape matrix
  were enumerated *because* they are performable on momentum-based props. Do not
  frame flowers as "not momentum moves" — an earlier framing in this session did
  and was corrected.
- **The extendulum**, defined by worked example: follows an extension's hand path
  (continuous hand circle) but reverses the prop's spin at the left and right
  edges, running extended through one half and pendulum-inverted through the
  other, tip dragging across the centre. Its prop-rate array is **identical to
  the pendulum's**; the only difference is hand radius (0 vs 1).

---

## Loose ends, ranked — where the next agent starts

### #1 — Two open questions on the QfT surface. Ask Austen; do not decide.

1. **Is extended-through-the-top a real poi move**, or does the swing family have
   one form (extended through the bottom, inverted through the top, as in the
   worked example)? This decides whether "which half extends" is a parameter.
2. **Do the presets stay as two labelled sets** — the eight canonical moves,
   the matrix — or become one flat library? The two-set version keeps the
   provenance visible, which is most of what the page argues.

### #2 — Then write the spec.

Target: `docs/superpowers/specs/2026-07-30-qft-one-surface-design.md`. It must
cover, at minimum:

- The per-hand unit: `{ radius, handDirection, propRate[8], propPhase }`.
- The reversal-position rule as a **validity check on the array**, not a
  hand-set flag. A constant-sign array has no reversals and its orientation is
  free (`handPhase` is a real control); a sign-changing array must change sign
  at 2 and 6, and `handPhase` is not offered. Derived, so it cannot be set wrong.
- How the eight guide moves and the matrix cells both become presets over the
  same representation.
- The hands toggle (one / two) and where VTG timing appears — it is a
  relationship, so it exists only when there are two hands.
- What is lost: downbeats = 8 disappears if the flower picker is the only ratio
  control, since `TURN_VALUES` tops out at 3 turns = 7 rotations. Nothing in the
  guide or the matrix uses 8.

Then `superpowers:writing-plans`. Not before.

### #3 — Poi: collect the transition dataset.

The θ hypothesis (`poi-legality.md` §5) cannot be tested against the 784 flowers
— they contain no reversals, so it passes them trivially. What is needed is
reversal moves judged the way the matrix was judged. The curation surface
already exists: `src/routes/test/poi-matrix/` with a dev-only save endpoint that
writes JSON into the working tree.

Open before building it: what is the unit being judged? A pair of patterns and
the transition between them? A single move containing a reversal? That is a
design question and belongs in brainstorming, not in code.

### #4 — The poi builder Austen wants.

Stated goal, 2026-07-30: a builder that only works for poi, so that the answer
to "how does TKA work for poi?" is a thing people can use rather than a
paragraph. Not specced. Depends on #3 for anything beyond the steady-state
blacklist, which is already known and is three flowers.

---

## Gotchas the next agent cannot derive from the code

- **MCP has zero poi canon.** `get_term_definition("poi")` → not found, verified
  2026-07-30 on `tka-domain-local`. `"pendulum"` and `"extendulum"` are also not
  in the TKA glossary — pendulum is Cushing's word from the 2011 QfT source,
  extendulum is Austen's. All poi theory comes from Austen. Do not fabricate poi
  facts (`no-fabrication.md`, `feedback_no_fabricated_community_lore`).
- **The momentum simulator was built and reverted** as unusable — `47402bab2c`.
  Do not propose it again without reading why it failed.
- **The five symbolic rules are not ground truth**, but two of them are exactly
  right (2 and 3, confirmed against 784 judgments). Rule 5 is the wrong one — it
  forbids spin reversal outright, and the extendulum is a performed reversal.
- **`:5173` is Austen's dev server.** Never `npm run dev`, never kill it. `:5175`
  was this session's agent server (`vite --port 5175`); check whether it is still
  running before spawning another (`resource-budget.md`).
- **Chrome's saved page zoom breaks viewport work.** The reused
  `~/.claude/chrome-profile` reports `devicePixelRatio 0.9`, and `Control+0` over
  CDP does not reset it. Either launch a fresh `--user-data-dir`, or compensate:
  request `resize_page(w × 0.9, h × 0.9)` to get a `w × h` CSS viewport. Verify
  with `innerWidth` before trusting any measurement.
- **An iframe harness is the reliable way to test many viewports.** The Chrome
  window floors at ~500px wide, so 375 cannot be reached by resizing. Load the
  route in a sized iframe — media and container queries key off the iframe box.
  Measure inside it via `contentDocument`.
- **`svelte-check` errors in this repo are usually not yours.** Several other
  sessions are editing the same tree. Grep the log for your own files before
  reacting to a non-zero exit.
- **Commit with an explicit pathspec.** The index is shared. Also: backticks in
  a `git commit -m` heredoc get eaten by bash command substitution — `d0c1a342f8`
  lost three identifiers from its body that way.

---

## Fast orientation

1. This doc.
2. `docs/reference/poi-legality.md` — the whole poi picture, one file.
3. `src/lib/shared/notation/qft/qft-model.ts` — `propIndexAt`, `propRate`,
   `PENDULUM_PATH`, and both direction rules. ~300 lines, and it is the thing
   the redesign changes.
4. `src/routes/notation/qft/+page.svelte` — the three modes as they stand.
5. Re-invoke `superpowers:brainstorming`, resume at loose end #1, ask Austen the
   two questions. Do not write code before a spec is approved.
