# Flow Arts Composer Agent Instructions

This file is the always-loaded project entry point. Keep stable policy here;
keep detailed, domain-specific rules in `.claude/rules/` and durable architecture
in `docs/architecture/`. Do not add incident histories, tool inventories, model
versions, machine setup notes, or duplicated rule text to this file.

## Working Agreement

- Classify the request before acting. Investigation, assessment, explanation,
  brainstorming, and recommendations are read-only unless Austen explicitly
  asks for a change. A direct request to build, fix, rewrite, or implement is
  approval for that stated scope.
- Answer questions the repository or available tools can answer. Ask Austen only
  for a material product choice, user-only credential or interaction, destructive
  action outside the approved workflow, or a genuine blocker.
- Stay within scope. Do not turn an approved change into adjacent cleanup.
- Preserve unrelated and in-flight work. Never revert or overwrite changes you
  do not own.
- Report evidence, not predictions. If verification is impossible, state what
  failed, what you tried, and what remains unverified. Do not hand routine checks
  back to Austen.

## Worktrees and Git

- Every modifying task uses one dedicated Git worktree based on `main`. The
  primary checkout at `E:/tka-platform` is read-only except for final integration
  or when Austen explicitly requests direct work there.
- If a modifying task starts in the primary checkout, move it with Codex Handoff
  or create one repository-adjacent task worktree before editing. Never nest or
  repurpose worktrees.
- Create a unique `codex/<task-slug>` branch before committing. Check status
  before editing and before each commit.
- Stage and commit only task-owned paths. Never use `git add -A`, `git add .`,
  `git add -u`, a bare `git commit`, or destructive reset/checkout commands.
- Implementation approval covers proportionate verification, scoped commits,
  guarded local integration, and cleanup. Finish from the primary checkout with
  `npm run wt:finish -- <branch> --route /real-route` for visual work or
  `npm run wt:finish -- <branch> --nonvisual` otherwise.
- If an integration gate fails, leave the branch and worktree intact and report
  the exact conflict. Never delete a dirty worktree or another task's branch.

Read `.claude/rules/worktree-workflow.md` and
`.claude/rules/commit-only-your-own-changes.md` before modifying repository
files.

## Verification

- Run the relevant checks yourself and fix task-caused failures. Do not absorb
  unrelated pre-existing failures into the task.
- Match evidence to the claim: tests or runtime queries for behavior, build
  output for build integrity, and observed screenshots for appearance.
- Visual changes that affect size, position, count, structure, responsiveness,
  or a reported visual defect require browser inspection. Copy-only changes and
  equivalent token swaps do not.
- Verifying a localhost visual diff in the dedicated agent browser has standing
  permission. Do not ask first. Mutating external data, acting in Austen's own
  signed-in session, purchases, messages, or destructive browser actions still
  require explicit approval.
- Use `scripts/launch-chrome-debug.ps1`, one task-owned background tab, per-page
  viewport emulation, and the required viewport set from the canonical rule.
  Close only the task-owned tab and clear its emulation afterward.

Read `.claude/rules/verification-protocol.md`,
`.claude/rules/visual-verification-mandatory.md`, and
`.claude/rules/resource-budget.md` before their matching work.

## Shared Development Environment

- Port 5173 is Austen's HTTPS/2 dev server. Never start, stop, restart, replace,
  or kill it. Diagnose it without changing it.
- Because it binds IPv6, probe it with
  `curl.exe -k -g "https://[::1]:5173/"`; `curl localhost:5173` is not a valid
  health check.
- If a task needs its own server, use a free non-5173 port after the resource
  gate and stop that server in the same turn.
- Use PowerShell for Windows process work. Never run bare `find` or query Windows
  processes from Git Bash.

Read `.claude/rules/never-start-the-dev-server.md`,
`.claude/rules/fast-iteration-loop.md`, and `.claude/rules/resource-budget.md`
before starting heavy checks or local services.

## TKA Domain and Generation

- Treat the Flow Arts MCP server as ground truth for TKA letters, positions,
  pictographs, VTG, transitions, terminology, and sequence feasibility. Use a
  current-turn MCP result for user-facing domain claims.
- Use the appropriate Flow Arts MCP generation or viewing tool for pictographs
  and sequences. Never recreate TKA rendering with scripts, inline code, or
  guessed data.
- If the MCP server is unavailable, stop the domain-dependent portion and report
  the missing capability. Do not substitute model memory.
- Named-word generation may include a tagline, but do not modify
  `mcp-server/src/core/humor-profile.json` unless Austen explicitly asks to save
  the choice as training data.
- Effect previews use the production LOOP generator and policy. Do not use short
  hand-authored fixtures or playback resets.

Read `.claude/rules/mcp-ground-truth.md`, `.claude/rules/tka-domain.md`,
`.claude/rules/verify-at-canonical-source.md`, and
`.claude/rules/sequence-generation.md` for domain work.

## Architecture and Product Quality

- Search by meaning before creating a new component, service, utility, or
  renderer. Reuse, extend, or compose the canonical owner instead of building a
  parallel implementation.
- For UI work, read `docs/architecture/visual-design-canon.md` and the matching
  design rules. Structural movement uses the shared reduced-motion-aware motion
  system; accidental layout shift is prevented.
- Before locomotion, gait, foot-contact, retargeting, terrain, or motion-matching
  work, read `.claude/rules/locomotion.md` and
  `docs/architecture/locomotion-research-canon.md`.
- For marketing, interface, and documentation copy, follow
  `docs/reference/ai-writing-guide.md`. Verify that every described feature
  exists.

Before non-trivial work, inspect `.claude/rules/` and read the files whose names
match the task. `.claude/rules/never-hand-roll.md` is the general ownership
rule; feature-specific rules take precedence within their domain.
