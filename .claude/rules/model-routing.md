# Model Routing Contract

Applies to every subagent, workflow, agent-team, or Codex dispatch.

- Pass an explicit `model` on every dispatch. A subagent must never inherit
  the session model by omission; the session model is usually the most
  expensive tier, and the subagent cannot see why it was chosen.
- Pick the cheapest tier that can finish the job: `haiku` for census, greps,
  and mechanical edits; `sonnet` for implementation, tests, and research
  summaries; `opus` for planning, debugging, and review. Use the session
  model for a subagent only when the task needs its judgment, and say why.
- Effort inherits the session level. Set `effort` in a custom agent's
  frontmatter only for a role that needs more, and re-run a failed task at a
  higher level instead of starting every task high.
- Delegate for context isolation (verbose tests, logs, greps, web research)
  or for genuinely independent coarse chunks. Do not fan out sequential,
  visual, or single-file work; naive fan-out costs three to six times more.
- Brief by file path, never by pasting content. Every subagent boots with the
  full instruction stack, so send one census first and one focused brief.
- Offload bulk second opinions and long reviews to Codex through
  `scripts/codex-ask.sh`; it draws on a separate quota. Set `CODEX_ASK_EFFORT`
  per task instead of defaulting to the highest level.
- Change model, MCP servers, and effort at session start, not mid-task; each
  change rewrites the whole cached prefix. Hand off and start fresh instead of
  resuming a session idle for more than an hour.
