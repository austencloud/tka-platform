# Rules Modernization for Fable 5 / Opus 5 — Audit + Applied Changes

- **Date:** 2026-08-02
- **Status:** Applied. Every change is a scoped commit on `main`; nothing here repeals a policy — form changed, constraints did not.
- **Trigger:** Austen's directive to audit whether the rules corpus is over-hand-holding modern models, plus the open task from the 2026-07-25 tuning session ("a trim pass over `.claude/rules/` was proposed but NOT done").

## The governing evidence

Anthropic's official guidance ([Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)):

> "Skills developed for prior models are often too prescriptive for Claude Fable 5 and can degrade output quality. Review and consider removing older instructions if default performance is better."

Two other findings shaped the pass:

1. **A short steer now equals an enumerated list.** "Instruction-following is improved enough that you can steer most behaviors with a brief instruction rather than enumerating each behavior by name." So the giant Forbidden-pattern tables, silent turn-end checklists, and repeated threat framing are pure cost — in always-loaded context tokens AND in output quality.
2. **Several old rules are now redundant with the harness itself.** Fable 5's system prompt already contains the autonomous-operation, evidence-grounded-reporting, and don't-stop-early instructions nearly verbatim. Rules restating them add nothing.

## The sorting principle

A rule earns its length by encoding things no model can know:

- **Project facts** (canonical primitives, paths, pipelines, the 1680 seam, port ownership) — KEEP, these are the real value of the corpus.
- **User preferences** (no checkboxes, terminology, humor workflow) — KEEP.
- **Multi-agent safety** (shared index, resource budget, no stash) — KEEP; these exist because of the 10-parallel-session environment, not model weakness.
- **Behavioral babysitting** (STOP-and-think scaffolds, forbidden-phrase enumerations, self-check rituals, incident transcripts as filler) — CONDENSE to constraint + one-line why.

## Applied changes

### Rules rewritten (constraint preserved, scaffolding removed)

| File | Before → After (approx.) | What was cut |
|---|---|---|
| `autonomy-and-completeness.md` | 95 → 20 lines | Forbidden-pattern table, self-check ritual, cost-model table — now largely native Fable 5 behavior + system prompt. Kept: standing context permission, the four legitimate blockers. |
| `never-hand-roll.md` | 160 → 45 | Redundant example tables, subagent/spec-writer sub-sections. Kept: two-search discipline, 3-term-minimum, justification gate, 80/60% thresholds. |
| `no-fabrication.md` | 100 → 25 | Turn-end silent checklist (also a show-your-thinking-adjacent pattern the migration guide says to strip), what-counts tables. Kept: four buckets + paths + explicit-retraction norm. |
| `verification-protocol.md` | 50 → 20 | Forbidden-phrase list. Kept: evidence-in-same-message, visual→screenshot routing, the "prove it or say you're guessing" test. |
| `no-assumption-without-evidence.md` | 50 → 17 | Claims/evidence table. Kept: direct-check requirement + the permanent backgroundType-vs-3D-scene distinction. |
| `research-before-building.md` | 45 → 14 | Confidence-percentage thresholds. Kept: search-before-infrastructure, one-failed-attempt-then-research, the senior-dev test. |
| `primitive-discovery.md` | 55 → 20 | Duplication of never-hand-roll. Kept: consumer-parent discovery, service/module routing to skills. |
| `brainstorming-gate.md` | 30 → 13 | Kept intact as policy — this is Austen's workflow preference, not model babysitting. |
| `mcp-ground-truth.md` | 60 → 30 | Preamble/forbidden lists. Kept: full tool-routing table, MCP-down = stop. |
| `expert-routing.md` | 70 → 40 | Kept both tables + knowledge-flows-back obligation. |
| `commit-only-your-own-changes.md` | 85 → 28 | Forbidden table. Kept: pathspec pattern, shared-index cause (`0ec96666`), no-history-rewrite recovery. |
| `fast-iteration-loop.md` | 90 → 45 | Narrative. Kept: command table, capture-once-grep-many, when-full-check, the verified-2026-07-21 "don't re-optimize the build" facts. |
| `CLAUDE.md` | "Do Your Own Job" + "Answer Your Own Questions" merged to one short section | Banned-phrase lists + stale "model 4.7 has regressed" note. |

### Deliberately left alone (canon-dense or recent-and-deliberate)

`4k-native-layout`, `no-layout-shift`, `chip-primitives`, `crossfade-primitive`,
`sequence-viewer-shell`, `simplified-word-display`, `tka-domain`,
`sequence-generation`, `blender-first-3d-scenes`, `effects-earn-their-slot`,
`component-test-discipline`, `verify-at-canonical-source`,
`visualization-routing`, `no-checkboxes`, `clickables-look-like-buttons`,
`clickable-links`, `worktree-workflow`, `resource-budget`, `fable-routing`,
`visual-verification-mandatory`.

Rationale: these are mostly project facts (primitive paths, viewport tables,
pipeline steps, terminology canon) — exactly what a model cannot infer — or
were written in July 2026 already knowing this model family
(`visual-verification-mandatory`, `fable-routing`, `resource-budget`). Their
residual verbosity is mostly tables agents actually consult.

### Harness cleanup

- **Deleted `.claude/hooks/post-edit-typecheck.cjs`** — dead code: registered
  nowhere (`PostToolUse: []` in settings.json), and if it were ever wired up it
  would run a full cold `svelte-check` after every single edit, contradicting
  `fast-iteration-loop.md` and `resource-budget.md`.
- **Deleted `.claude/config.json`** — inert legacy file: not a filename Claude
  Code loads (live config is `.claude/settings*.json` + root `.mcp.json`), and
  it wired Playwright MCP (torn out per global CLAUDE.md), a filesystem server
  pointed at a nonexistent user profile (`C:\Users\auste\`), and six other npx
  servers none of which appear in any live session. Its only effect was
  misleading future agents into thinking Playwright is available.
- **Live hooks confirmed correct and kept:** `git-safety-check` (Bash +
  PowerShell), `dev-server-guard`, `bulk-replace-guard`, `pre-commit-check`.
  Mechanical enforcement of multi-agent safety is the RIGHT layer for these —
  hooks don't consume context and can't be rationalized around.

## Flagged for Austen (not changed)

1. **`settings.local.json` hygiene.** It still allowlists `mcp__playwright__*`
   (dead) and contains two literal Cloudflare API tokens embedded in old
   `Bash(...)` allow entries (lines ~423–424). The file is auto-accumulated
   and local-only, but those tokens should be rotated and the entries pruned.
2. **Skills and agent files** were scoped out of this pass: they load
   on-demand, so their prescriptiveness costs nothing until invoked, and the
   migration guide notes Fable 5 "does a good job of updating skills on the
   fly." A later organic pass (fix-on-touch, per `component-test-discipline`'s
   own philosophy) beats a sweep.
3. **Global `~/.claude/CLAUDE.md`** says worktrees are the default while this
   repo's `worktree-workflow.md` mandates main-only. Not actually a conflict —
   the global file explicitly defers to project rules and cites this one — but
   worth knowing the global text reads opposite on first glance.
