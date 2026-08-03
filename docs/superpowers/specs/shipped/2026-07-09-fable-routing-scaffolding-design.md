# Fable Routing Scaffolding — Design

**Date:** 2026-07-09
**Status:** Approved (Austen, this session)
**Window:** Fable 5 available on subscription through ~2026-07-12. This scaffolding maximizes its value while present and degrades gracefully after.

## Problem

Session model is now Fable 5. Subagent model resolution order is: `CLAUDE_CODE_SUBAGENT_MODEL` env var → per-invocation `model` param → agent frontmatter `model` → **main conversation model**. Any dispatch that omits `model` therefore spawns a *Fable* subagent. Fable costs ~2x Opus output and drains subscription limits roughly twice as fast; community-documented failure mode is an orchestrator fanning out dozens of Fable workers and exhausting a weekly limit in under half an hour. Meanwhile Anthropic's own benchmark of the tiered pattern (Fable orchestrates, cheaper models execute) shows ~96% of the performance at ~46% of the cost.

Existing guidance (`never-opus-47.md`: "omit model → inherit main-loop model") was written when the main loop was Opus 4.8 and is now actively dangerous.

## Design

### 1. New rule: `.claude/rules/fable-routing.md`

Active while the session model is Fable. Contents:

- **The sandwich:** Explore (Sonnet/Haiku, low effort) → Plan (Fable, main loop) → Execute (Sonnet) → Review (Fable). Fable never performs mechanical edits itself.
- **Explicit model on every dispatch:** every `Agent` call and every Workflow `agent()` call passes `model` (and `effort`) explicitly. Omitting `model` is allowed only when the subtask itself is deliberately Fable-tier.
- **Effort table:** `low` for gathering/grep/format; session default for implementation; `max` reserved for the hardest verify/judge stages only. Effort drives the cost multiplier at least as much as model choice.
- **Executor discipline:** executors re-read the plan file at each phase (guards against plan drift — every model wants to be the planner), prove completion with tool output, and commit with explicit pathspec per `commit-only-your-own-changes.md`.
- **Ledger discipline:** any multi-wave dispatch keeps a checkbox ledger in the plan doc. The ledger survives compaction; conversation context does not.
- **Classifier hygiene:** neutral phrasing in prompts (no all-caps demands — reads as manipulation to injection defenses); security-flavored work phrased defensively ("defensive review of auth boundaries", not "exploit"). A flagged session falls back to Opus 4.8 and stays there; rephrase in a fresh session rather than retrying.
- **Sunset:** when Fable leaves subscription access, the rule self-deactivates (its trigger condition is "session model = Fable"); `never-opus-47.md` defaults resume.

### 2. Amend `never-opus-47.md`

Replace the unconditional "omit model → inherits main-loop model, default-correct" advice with: omit only when inheriting the session model is *intended*. While the session model is Fable, non-Fable-tier work gets explicit `sonnet`/`haiku` (see `fable-routing.md`).

### 3. Agent frontmatter

- Pin `model: sonnet` on `deck-release-expert.md` (the only unpinned agent; currently inherits Fable).
- All other agents already pinned (sonnet ×7, haiku ×1). Positioning experts stay `sonnet`; the orchestrator escalates per-invocation with `model: "fable"` when a diagnosis genuinely needs it.
- Verified `CLAUDE_CODE_SUBAGENT_MODEL` is unset (it would silently override all pins).

### 4. Deliberately skipped

- **Spawn-guard / stop-guard hooks** (fable5-orchestrator plugin pattern): deterministic, but heavy infra for a ~3-day window. Advisory rule + ledger-in-plan covers the two failure points. Per `component-test-discipline.md`: don't widen infra doors for their own sake.
- **Rewriting existing all-caps rule files:** classifier risk noted in the rule; a wholesale tone rewrite of `.claude/rules/` is out of scope and unproven need.

### 5. First dispatch under this scaffolding

StepData→Step migration waves W0→W2 (approved by Austen this session), per `docs/superpowers/specs/active/2026-07-05-stepdata-migration-checkpoint-package.md`: Fable plans/reviews, Sonnet executes, `npm run test:render-parity` (360/360 baseline) as the proof gate per wave, checkbox ledger in the checkpoint package.

## Sources

- [Wavect: Coding with Claude Fable 5](https://wavect.io/blog/coding-with-claude-fable-5/) — sandwich pattern, effort calibration, classifier pitfalls
- [MCP.Directory: Fable 5 routing guide](https://mcp.directory/blog/fable-5-claude-code-model-routing-guide-2026) — resolution order, env var override, cost guidance
- [fable5-orchestrator plugin](https://github.com/Rylaa/fable5-orchestrator) — ledger + guard-hook pattern (adopted ledger, skipped hooks)
- [Data Science Dojo: Fable orchestrator workflow](https://datasciencedojo.com/blog/claude-code-fable-5-orchestrator-workflow/) — cost split evidence
