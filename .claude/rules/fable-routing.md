# Fable Routing — ENFORCED (while session model = Fable)

## Trigger

Active whenever the main conversation model is Fable 5. Self-deactivates when the
session model is anything else — then default subagent routing resumes (omit
`model` to inherit the session model; explicit `sonnet`/`haiku` for mechanical work).

## The Problem This Solves

Subagent model resolution: `CLAUDE_CODE_SUBAGENT_MODEL` env var → per-invocation
`model` param → agent frontmatter → **main conversation model**. With the session
on Fable, any dispatch that omits `model` spawns a Fable subagent at ~2x Opus
cost, draining limits roughly twice as fast. Documented community failure mode:
an orchestrator fanned out Fable workers and exhausted a weekly limit in ~27
minutes. Anthropic's benchmark of the tiered pattern: Fable orchestrates +
cheaper models execute = ~96% of the performance at ~46% of the cost.

## The Sandwich (canonical workflow)

1. **Explore** — Sonnet/Haiku subagents, `effort: low`: map files, gather
   evidence, inventory call sites.
2. **Plan** — Fable (main loop): architecture, decomposition, risk ordering.
3. **Execute** — Sonnet subagents: implementation per plan.
4. **Review** — Fable (main loop): diff review, edge cases, ship judgment.

Fable never performs mechanical edits itself (renames, sweeps, formatting,
boilerplate). Its leverage is holding the whole picture; spend it there.

## Dispatch Rules

- **Every `Agent` call and every Workflow `agent()` call passes `model`
  explicitly.** Omitting `model` (→ inherits Fable) is allowed only when the
  subtask itself is deliberately Fable-tier: multi-file architectural reasoning,
  gnarly debugging other models loop on, cross-cutting synthesis.
- **Effort explicit too:** `low` for gathering/grep/format/mechanical; default
  for implementation; `max` only for the single hardest verify/judge stage.
  Effort drives the cost multiplier at least as much as model choice.
- **Bounded fan-outs:** no unbounded loops spawning Fable agents. Ledger + count
  known before dispatch.

## Executor Discipline (include in every executor prompt)

1. Re-read the plan file at the start of each phase — executors drift from the
   plan; the plan doc is authority, not the executor's memory.
2. Prove completion with tool output (test run, grep, build) — completion claims
   without evidence are rejected per `verification-protocol.md`.
3. Commit with explicit pathspec per `commit-only-your-own-changes.md`.

## Workflow Cost Discipline (ultracode included)

Lessons from the 2026-07-25 Creators design run (2.8M subagent tokens + two
aborted runs). These bind every Workflow invocation, including ultracode
sessions — ultracode licenses orchestration, not waste.

1. **Census before launch.** Any workflow whose plan depends on data state
   (Firestore counts, file inventories, catalog sizes) runs the cheap query
   FIRST, in the main loop. Both aborted runs died on wrong census
   assumptions a 30-second query would have caught.
2. **Shared context by file path, never by paste.** Write the recon
   digest/spec once to disk; every downstream agent prompt says
   `Read <path>` instead of embedding it. The 2.8M was mostly one digest
   pasted into 8 prompts plus judges re-reading all 4 full concepts.
   Downstream agents read the digest and ONLY the artifacts they judge —
   never "all of the above" by default.
3. **Explicit `model` + `effort` on every workflow `agent()` call** — same
   rule as Agent dispatches above. `haiku`/`effort: low` for greps and
   mechanical stages, `sonnet` for implementation, session model only for
   the single hardest judge/synthesis stage. Spot-check one dispatch's
   actual model before a large fan-out — subagent model routing has
   resolved to the parent model in the wild
   (anthropics/claude-code#43869).
4. **Panels scale to the decision, not the pattern library.** Judge panels,
   N-concept tournaments, and adversarial verify passes are for wide-open
   design decisions only. Executing a written spec/design doc = one Sonnet
   executor per phase, zero fan-out. Default sizes when a panel IS
   warranted: 2 concepts and one judge pass, not 4 concepts × 3 lenses
   each re-reading everything.

## Ledger Discipline

Any multi-wave dispatch keeps a checkbox ledger (`- [ ]` per requirement) in the
plan/spec doc. Ledger survives compaction; conversation context does not. Mark
`- [x]` done, `- [~] deferred` with reason.

## Classifier Hygiene

Fable runs safety classifiers that fall back to Opus 4.8 **and stay there**.
- Neutral phrasing in subagent prompts; no all-caps demands ("NON NEGOTIABLE"
  reads as manipulation to injection defenses).
- Security-flavored work phrased defensively ("defensive review of auth
  boundaries, input validation"), never offensively.
- If flagged: rephrase in a fresh session; retrying the same prompt re-trips it.

## Forbidden

- `Agent`/`agent()` dispatch without explicit `model` for non-Fable-tier work.
- Fable doing mechanical edits inline that a Sonnet executor could do from a plan.
- `effort: max` on gathering or mechanical stages.
- Adding a new `.claude/agents/*.md` without a `model:` frontmatter pin.

## Related

- `commit-only-your-own-changes.md`, `verification-protocol.md`
- Spec: `docs/superpowers/specs/2026-07-09-fable-routing-scaffolding-design.md`
