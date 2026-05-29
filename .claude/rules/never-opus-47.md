# Never Opus 4.7 for Subagents — ENFORCED

## The Rule

Never dispatch any subagent (Agent / Task tool / Workflow agent) on **Opus 4.7**. Austen (2026-05-28): *"Never, I mean NEVER EVER EVER use 4.7. It's garbage... trash trash trash."*

Acceptable subagent models: **Opus 4.8**, **Opus 4.6**, or **Sonnet** (Haiku for trivial mechanical work).

## Why

4.7 regressed hard versus 4.6/4.8 on the exact behaviors this project depends on: autonomy, not playing dumb, not hallucinating, finishing the task. Austen would rather pay for 4.8 or drop to Sonnet than receive 4.7 output.

## How to apply

The Agent tool's `model` param only accepts `sonnet` / `opus` / `haiku` — no version. Bare `opus` can resolve to 4.7. Therefore:

- **For capable-model subagent work, OMIT the `model` param entirely.** The agent then inherits the main-loop model (the resolved session model, currently Opus 4.8). This is the default-correct choice.
- Explicit `model: "sonnet"` is fine for standard/mechanical tasks. `model: "haiku"` for trivial ones.
- **NEVER pass `model: "opus"` explicitly** unless you have confirmed it maps to 4.8/4.6, not 4.7. When unsure, omit.

## Forbidden

- `Agent({ model: "opus", ... })` when the resolved opus could be 4.7
- Selecting 4.7 in any model picker for delegated work

## Related

- Memory: `feedback_never_opus_47.md`
