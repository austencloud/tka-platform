# Fable Parallel Dispatch — Tonight (2026-07-11, 9pm–12am)

**Purpose:** three self-contained Fable 5 sessions run in parallel across three
**disjoint** subsystems (core engine / visual rendering / commerce), each a
bounded ~3-hour slice. Paste one kickoff prompt per fresh session. No shared
conversation context assumed. Supersedes the 07-03 dispatch index for this
window (that set is spent — see "What's off the table").

## Why these three

Ranked by value-per-Fable-minute (reasoning that a cheaper model can't do),
filtered to work that is **live** (not blocked on a human/physical dependency)
and **file-disjoint** (safe to run concurrently).

| Agent | Subsystem | Value | Autonomy | Fable-fit |
|---|---|---|---|---|
| A — Core-types migration | `packages/` engine + step/motion types | 5 (backbone) | Full auto vs golden master | Invariant-preserving migration; compiler can't catch a wrong invariant |
| B — Mandala signature identity | mandala rendering / palette | 5 (virality) | Full auto build; **taste checkpoint** | Beauty on a rigorous substrate |
| C — Shop go-live (code slice) | `features/shop`, routes | 5 (revenue) | Full auto in test mode; human-gated flip deferred | Go-live arc architecture + Stripe/webhook reasoning |

**Swap option for C:** if Austen shoots a ground-truth real-flow clip tonight,
replace Agent C with **real-flow validation** — that finishes the moonshot
(`2026-07-03-fable-real-flow-notation-validation-design.md`, reasoning core
already green at 82/82; only the clip is missing). Higher close-out value than
shop, but only unlocks with the clip.

## What's off the table (and why)

- **Correctness cluster (07-03):** loop-detection, hand-arc reversal detector,
  content-hash V2 — all **shipped**. Residual: a `@tka/domain` rebuild + Flow
  Arts MCP restart to ship the loop-detector engine change to the MCP. That's a
  ~10-min deploy chore (`reference_flow_arts_mcp_deploy`), not Fable work — do it
  outside the window.
- **Real-flow / Practice:** real-flow's Fable reasoning is spent (07-05); it's
  blocked on a physical clip. Practice consumes real-flow's perception core, so
  it's downstream-blocked. Neither is an autonomous target tonight.

## Isolation plan (READ FIRST — three sessions, one repo)

Three concurrent Fable sessions share the working tree and the git index. A bare
`git commit` in one sweeps another's staged work (`commit-only-your-own-changes`).
Two safeguards, both required:

1. **One git worktree per agent**, all off the same base:
   ```bash
   git fetch origin
   git worktree add ../tka-fable-A -b claude/fable-A-core-migration origin/main
   git worktree add ../tka-fable-B -b claude/fable-B-mandala        origin/main
   git worktree add ../tka-fable-C -b claude/fable-C-shop-golive     origin/main
   ```
   Launch each Fable session in its own worktree dir. Separate trees → separate
   indexes → zero cross-contamination. (If you'd rather keep one tree: the
   subsystems are disjoint, but every commit MUST use an explicit pathspec —
   `git commit -m "…" -- <paths>` — never a bare commit.)
2. **Each agent commits only its own paths** with an explicit pathspec, every
   time. Stated in each kickoff prompt below.

Merge order at the end: A (core types) first — B and C may consume the new types
— then B and C in either order.

## Standing guardrails (baked into every kickoff prompt)

- **Sandwich the work** (`fable-routing`): Fable plans/architects/reviews; it
  dispatches Sonnet executors (`model: sonnet`, low effort) for mechanical edits
  — Fable does not hand-roll renames/boilerplate itself. Every dispatched
  executor call passes `model` and `effort` explicitly.
- **Verify with evidence** (`verification-protocol`): no "done" without test
  output, a runtime query, or a screenshot in the same turn.
- **Commit own changes only**, explicit pathspec (`commit-only-your-own-changes`).
- **Never hand-roll** — grep for existing primitives first (`never-hand-roll`).
- Keep a `- [ ]` ledger in the spec doc; it survives compaction.

---

## Agent A — Core-types migration (Step / Motion)

**Spec:** `2026-04-20-sequence-engine-unification-design.md` (Phase 1) +
`2026-07-03-fable-stepdata-motion-migration-remainder-design.md` (same
migration, invariant lens) + checkpoint package
`2026-07-05-stepdata-migration-checkpoint-package.md`.

**State:** Phase 0 done (`tka-types` pkg + `deriveReversals`). Migration analysis
+ guardrail slice done 07-05. **Open:** migrate the 22 engine files from
`SequenceStep`/`MotionData` to `Step`/`Motion`, preserving identity/derivation
invariants across the corpus.

**Bounded 3h slice:**
1. **Build the golden master first** — capture 200+ sequences (decks, recent
   Firestore writes, period-2/period-4 LOOPs across all types, REWOUND,
   high-turn, bridge-inserted), serialize each engine output to canonical JSON.
   This is the parity net; the migration is only safe against it.
2. Migrate the 22 engine files; re-run every input through the golden master;
   assert byte-identical serialized output. Any diff is a regression — stop and
   diagnose, don't paper over.
3. Stop at the **checkpoint** before touching the 231 app files (Phase 2) or any
   Firestore backfill — those are separate, prod-adjacent, and out of tonight's
   slice.

**Autonomy:** full auto through the engine migration + golden-master proof;
checkpoint before Phase 2 / any prod migration.

---

## Agent B — Mandala signature identity

**Spec:** `2026-07-03-fable-mandala-signature-identity-design.md` (+ roadmap
`2026-05-25-mandala-roadmap.md`).

**State:** substrate is production-grade; Phase 1 of the roadmap done. Output is
"correct but generic-neon." This is the gallery-tier facelift — the most
shareable/viral asset in the app.

**Bounded 3h slice (the "signature identity" facelift):**
1. **Art-grade palette system** — curated, named palettes beyond bright-neon,
   plus optional paper/texture/background treatments.
2. **Present palette/composition options to Austen early** (first ~30 min) —
   taste is his call (`show-visuals-not-prose`: render the real component on a
   test page, don't describe). Then build the chosen direction full-auto.
3. Composition/format polish per the spec's task list, no layout shift.

**Autonomy:** full auto to build; **checkpoint on aesthetic direction** — needs
either a palette vibe from Austen up front, or Austen at the keyboard for the
early options checkpoint. If neither, the agent builds the palette *system* +
presents options and pauses.

**Pre-clear:** a one-line palette/vibe steer from Austen (e.g. "muted gallery /
jewel tones / monochrome ink") lets this run near-autonomously.

---

## Agent C — Shop go-live (code slice, test mode)

**Spec:** `2026-06-26-shop-operations-go-live-design.md` (depends on
`2026-06-23-shop-spin-up-design.md`, whose build half is shipped + verified
2026-06-24).

**State:** build/visibility half done. The operate-the-store half is not: Stripe
Tax, pre-order layer, webhook handler for `checkout.session.completed`, product
art, live flip.

**Bounded 3h slice (everything doable in test mode, no live keys):**
1. Webhook **handler code** for `checkout.session.completed` (email, shipping
   address, item, total, `status: "paid"`) + order write.
2. Pre-order layer + Stripe Tax integration code (steps C/D — the spec says both
   can land in test mode ahead of the live flip).
3. Verify the full checkout arc in **test mode** with a `rk_test` key.

**Human-gated, explicitly deferred to Austen (do NOT block on these):** register
webhook events in the Stripe Dashboard, produce product art, and the live flip
(step F). The agent stops at the test-mode-verified boundary.

**Autonomy:** full auto on code + test-mode verification; hard stop before any
live/prod flip.

---

## The two things only Austen can pre-clear

1. **Real-flow clip?** If you'll shoot/provide a ground-truth clip tonight,
   Agent C becomes real-flow validation (finish the moonshot) instead of shop.
2. **Mandala palette vibe?** One line up front makes Agent B autonomous;
   otherwise it presents options and waits for you.

## Kickoff prompts

Paste one per fresh Fable session (in that agent's worktree). Each is
self-contained.

**Agent A:**
> You are Fable, running the core-types migration. Read
> `docs/superpowers/specs/active/2026-04-20-sequence-engine-unification-design.md`
> (Phase 1), `docs/superpowers/specs/active/2026-07-03-fable-stepdata-motion-migration-remainder-design.md`,
> and `docs/superpowers/specs/active/2026-07-05-stepdata-migration-checkpoint-package.md`.
> Execute the bounded slice in `docs/superpowers/specs/active/2026-07-11-fable-parallel-dispatch-tonight.md`
> § "Agent A": build the 200+ golden-master corpus first, then migrate the 22
> engine files, proving byte-identical serialized output. Sandwich: you plan +
> review, dispatch Sonnet executors for mechanical edits. Commit own changes
> only, explicit pathspec. Stop at the checkpoint before Phase 2 / any prod
> migration. Verify with test output before any "done."

**Agent B:**
> You are Fable, running the mandala signature-identity facelift. Read
> `docs/superpowers/specs/active/2026-07-03-fable-mandala-signature-identity-design.md`
> and `docs/superpowers/specs/active/2026-05-25-mandala-roadmap.md`. Execute the
> bounded slice in `docs/superpowers/specs/active/2026-07-11-fable-parallel-dispatch-tonight.md`
> § "Agent B": build the art-grade palette system, present curated
> palette/composition options rendered on a real test page (show, don't
> describe) for aesthetic sign-off, then build the chosen direction full-auto.
> No layout shift. Grep for existing mandala/palette primitives before creating
> any. Commit own changes only, explicit pathspec. Verify visually before "done."

**Agent C:**
> You are Fable, running the shop go-live code slice. Read
> `docs/superpowers/specs/active/2026-06-26-shop-operations-go-live-design.md`
> and `docs/superpowers/specs/active/2026-06-23-shop-spin-up-design.md`. Execute
> the bounded slice in `docs/superpowers/specs/active/2026-07-11-fable-parallel-dispatch-tonight.md`
> § "Agent C": build the `checkout.session.completed` webhook handler + order
> write, the pre-order layer, and Stripe Tax integration — all in test mode with
> a `rk_test` key. Do NOT touch live keys, product art, dashboard webhook
> registration, or the live flip; stop at the test-mode-verified boundary.
> Sandwich: you architect + review, Sonnet executors implement. Commit own
> changes only, explicit pathspec. Verify the checkout arc in test mode before
> "done."
