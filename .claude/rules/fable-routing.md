# Fable Routing — ENFORCED (while session model = Fable)

## Trigger

Active whenever the main conversation model is Fable 5. Self-deactivates when the
session model is anything else — then `never-opus-47.md` defaults resume.

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

- `never-opus-47.md` (amended: omit-model advice conditional on session model)
- `commit-only-your-own-changes.md`, `verification-protocol.md`
- Spec: `docs/superpowers/specs/2026-07-09-fable-routing-scaffolding-design.md`
