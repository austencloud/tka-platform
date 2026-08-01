---
status: archived
value: 4
effort: M
remaining: ""
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-08-01
---
# Fable Parallel Dispatch — Tonight (2026-07-11, 9pm–12am)

> **Archived 2026-08-01:** This was a single-night coordination memo. Its
> three-hour window is over, and the 2026-07-25 triage ledger already records it
> as spent. Live work remains tracked by the referenced feature specs.

**Purpose:** three concurrent Fable 5 sessions for a 3-hour window, structured
around **Austen's attention**: one **hero session he actively drives**
(real-flow validation on real clips) plus two **zero-attention autonomous**
sessions in the background (core-types migration, shop go-live code). Disjoint
subsystems → safe to run at once. Paste one kickoff prompt per fresh session.
Supersedes the 07-03 dispatch index for this window.

## The attention model (why this split)

Real-flow validation is **interactive** — the harness is built, but validation
runs through the lab UI (upload → calibrate → notate → score); there is no
headless path (deliberately deferred). It's a collaborative loop: Austen drives
the UI and relays scorecards; Fable diagnoses failures and hardens the tracker.
That eats Austen's attention for the whole window.

So the other two sessions must need **none** of his attention. Core-types
migration and the shop code slice both run fully autonomous against tests. The
mandala facelift needs a taste checkpoint (his eyes), which would compete with
real-flow — so it drops to an **optional fill-in** he can glance at between
clips, not a core-three slot.

| Session | Subsystem | Value | Austen's attention |
|---|---|---|---|
| **A — Core-types migration** | `packages/` engine + step/motion types | 5 (backbone) | none (background) |
| **B — Shop go-live (code)** | `features/shop`, routes | 5 (revenue) | none until the live flip |
| **C — Real-flow validation** | `src/lib/…/prop-tracking` (lab) | 5 (the moonshot) | **primary — he drives the UI** |
| *(opt) — Mandala identity* | mandala rendering / palette | 5 (virality) | glances between clips |

## What Austen prepares for Agent C (real-flow)

Confirmed available tonight: **real videos he can upload and assign to a
sequence.** That's exactly the ground-truth format the harness accepts — the
`get_sequence_data` output of the performed sequence pastes in verbatim. Per
clip he needs: the video file + the sequence that was actually performed in it.
More clips across different sequences/types = a stronger validation signal.

## What's off the table (and why)

- **Correctness cluster (07-03)** — loop-detection, hand-arc reversal detector,
  content-hash V2 all **shipped**. Residual: `@tka/domain` rebuild + Flow Arts
  MCP restart to ship the loop-detector engine change (`reference_flow_arts_mcp_deploy`).
  ~10-min deploy chore, not Fable work — do it outside the window.
- **Practice judgment loop** — consumes real-flow's perception core; do real-flow
  first, Practice is a future window.

## Isolation plan (READ FIRST — three sessions, one repo)

Concurrent sessions share the working tree + git index; a bare commit in one
sweeps another's staged work (`commit-only-your-own-changes`). Both safeguards
required:

1. **Backgrounds (A, B) each get a git worktree**, off the same base:
   ```bash
   git fetch origin
   git worktree add ../tka-fable-A -b claude/fable-A-core-migration origin/main
   git worktree add ../tka-fable-B -b claude/fable-B-shop-golive      origin/main
   ```
2. **Real-flow (C) works in the MAIN tree** — because validation needs a live
   dev server and HMR to reflect tracker edits as Austen re-runs clips. Run its
   own server so it doesn't touch the user's :5173:
   ```bash
   vite --port 5174   # Agent C drives the lab here; HMR picks up its tracker edits
   ```
   C's files (`prop-tracking` lab) are disjoint from A (`packages/`) and B
   (`features/shop`), so the main tree holds only C's changes. Every commit still
   uses an explicit pathspec.

Merge order at the end: **A first** (B and C may consume the new types), then B
and C in either order.

## Standing guardrails (in every kickoff prompt)

- **Sandwich** (`fable-routing`): Fable plans/reviews; dispatches Sonnet
  executors (`model: sonnet`, explicit `effort`) for mechanical edits — Fable
  doesn't hand-roll renames/boilerplate.
- **Verify with evidence** (`verification-protocol`, `no-assumption-without-evidence`):
  no "done"/"works" without test output, a runtime query, or a scorecard in the
  same turn.
- **MCP-ground every TKA domain claim** (`mcp-ground-truth`) — especially C,
  which reconciles CV output against canonical semantics.
- **Commit own changes only**, explicit pathspec.
- **Never hand-roll** — grep for existing primitives first.
- Keep a `- [ ]` ledger in the spec doc (survives compaction).

---

## Agent A — Core-types migration (Step / Motion) · autonomous

**Spec:** `2026-04-20-sequence-engine-unification-design.md` (Phase 1) +
`2026-07-03-fable-stepdata-motion-migration-remainder-design.md` +
`2026-07-05-stepdata-migration-checkpoint-package.md`.

**State:** Phase 0 done (`tka-types` pkg + `deriveReversals`); analysis +
guardrail slice done 07-05. **Open:** migrate the 22 engine files from
`SequenceStep`/`MotionData` to `Step`/`Motion`, preserving identity/derivation
invariants.

**Bounded 3h slice:**
1. **Golden master first** — capture 200+ sequences (decks, recent Firestore
   writes, period-2/period-4 LOOPs across all types, REWOUND, high-turn,
   bridge-inserted); serialize each engine output to canonical JSON.
2. Migrate the 22 engine files; re-run every input; assert byte-identical
   output. Any diff is a regression — diagnose, don't paper over.
3. **Stop at the checkpoint** before the 231 app files (Phase 2) or any
   Firestore backfill.

**Autonomy:** full auto through engine migration + golden-master proof.

---

## Agent B — Shop go-live (code slice, test mode) · autonomous

**Spec:** `2026-06-26-shop-operations-go-live-design.md` (build half of
`2026-06-23-shop-spin-up-design.md` shipped + verified 2026-06-24).

**State:** build/visibility half done. Operate-the-store half open: Stripe Tax,
pre-order layer, `checkout.session.completed` webhook handler, product art, live
flip.

**Bounded 3h slice (all in test mode, `rk_test` key):**
1. Webhook **handler code** for `checkout.session.completed` (email, shipping
   address, item, total, `status: "paid"`) + order write.
2. Pre-order layer + Stripe Tax integration code.
3. Verify the checkout arc in test mode.

**Human-gated, deferred to Austen (do NOT block):** dashboard webhook
registration, product art, live flip (step F). Stop at the test-mode-verified
boundary.

**Autonomy:** full auto on code + test-mode verification; hard stop before any
live/prod flip.

---

## Agent C — Real-flow validation (THE MOONSHOT) · Austen drives

**Spec:** `2026-07-03-fable-real-flow-notation-validation-design.md` (read the
"How to run the validation when the clip arrives" section — the exact UI steps).

**State:** entire harness shipped 07-05 (82/82 tests): validation harness +
Needleman-Wunsch scorecard + camera-mirror tripwire, tracker hardening
(connected-component segmentation, 2×2 Hungarian correspondence + CV prediction,
out-of-plane confidence, MCP-grounded sign conventions), and the
`NotationReviewPanel` correction UI. **Open (the whole point):** prove it on
*real* footage and harden where reality breaks the synthetic assumptions.

**The loop (collaborative):**
1. Austen: LED Notation tab (on :5174) → upload clip → draw box → Start Tracking
   → review phase → calibrate (set center, set radius, sample blue, sample red)
   → **Notate Flow** → paste the performed sequence as ground truth → **Score
   against ground truth**.
2. Austen relays the scorecard (overall + per-field accuracy, per-beat diffs,
   insertions/deletions, low-confidence beats, **mirror verdict**) to Fable.
3. Fable diagnoses the failures and **hardens the tracker** — MCP-grounding
   every TKA-semantics decision, never trusting the classifier's current output
   as truth. If "likely mirrored" fires, wire the ScreenToGrid mirror toggle.
4. Repeat across clips. Fable decides: **is v1 single-camera wall-plane
   shippable, or does sign/correspondence fragility force the multi-view path?**

**Autonomy:** full auto on code hardening; **checkpoint** = the real clips and
scorecards only Austen can produce. No "works on real video" claim without a
diff against a real, labeled clip. Keep the 82 tests green; add real-clip
regression fixtures as they're captured.

**Why this is the crown jewel:** it finishes the differentiator moonshot *and*
builds the perception core the Practice loop later extends. "TKA that perceives
reality."

---

## Optional fill-in — Mandala signature identity

Run only if Austen has attention to spare between clips (it needs a taste
checkpoint). **Spec:** `2026-07-03-fable-mandala-signature-identity-design.md`.
Build the art-grade palette system, present curated palette/composition options
on a real test page (show, don't describe), then build the chosen direction.
A one-line vibe up front ("muted gallery / jewel tones / monochrome ink") makes
it near-autonomous.

## Kickoff prompts

Paste one per fresh Fable session.

**Agent A (worktree ../tka-fable-A):**
> You are Fable, running the core-types migration. Read
> `docs/superpowers/specs/active/2026-04-20-sequence-engine-unification-design.md`
> (Phase 1), `docs/superpowers/specs/active/2026-07-03-fable-stepdata-motion-migration-remainder-design.md`,
> and `docs/superpowers/specs/active/2026-07-05-stepdata-migration-checkpoint-package.md`.
> Execute § "Agent A" of
> `docs/superpowers/specs/active/2026-07-11-fable-parallel-dispatch-tonight.md`:
> build the 200+ golden-master corpus first, then migrate the 22 engine files,
> proving byte-identical serialized output. You plan + review; dispatch Sonnet
> executors for mechanical edits. Commit own changes only, explicit pathspec.
> Stop at the checkpoint before Phase 2 / any prod migration. Verify with test
> output before any "done."

**Agent B (worktree ../tka-fable-B):**
> You are Fable, running the shop go-live code slice. Read
> `docs/superpowers/specs/active/2026-06-26-shop-operations-go-live-design.md`
> and `docs/superpowers/specs/active/2026-06-23-shop-spin-up-design.md`. Execute
> § "Agent B" of
> `docs/superpowers/specs/active/2026-07-11-fable-parallel-dispatch-tonight.md`:
> build the `checkout.session.completed` webhook handler + order write, the
> pre-order layer, and Stripe Tax integration — all in test mode with a
> `rk_test` key. Do NOT touch live keys, product art, dashboard webhook
> registration, or the live flip; stop at the test-mode-verified boundary. You
> architect + review; Sonnet executors implement. Commit own changes only,
> explicit pathspec. Verify the checkout arc in test mode before "done."

**Agent C (main tree, own dev server `vite --port 5174`):**
> You are Fable, running real-flow validation — the moonshot close-out. Read
> `docs/superpowers/specs/active/2026-07-03-fable-real-flow-notation-validation-design.md`
> in full (especially "How to run the validation when the clip arrives") and
> § "Agent C" of
> `docs/superpowers/specs/active/2026-07-11-fable-parallel-dispatch-tonight.md`.
> I (Austen) will drive the LED Notation lab UI on https://localhost:5174 —
> upload each clip, calibrate, Notate Flow, paste the performed sequence as
> ground truth, and relay you the scorecard (including the mirror verdict). Your
> job: diagnose each failure and harden the tracker, MCP-grounding every TKA
> semantics decision (never trust the classifier's current output as truth). If
> "likely mirrored" fires, wire the ScreenToGrid mirror toggle. Keep the 82
> tests green; add real-clip regression fixtures as we capture them. Do not claim
> it works on real video without a scorecard diff against a real clip in the same
> turn. Decide whether v1 single-camera is shippable or the fragility forces the
> multi-view path. Commit own changes only, explicit pathspec.
