---
name: ship
description: Use when a feature needs readiness assessment before shipping to users
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Ship Readiness Check

When explicitly invoked, treat the text after `$ship` as `<arguments>`. Expected shape: `<feature-name>`.

**Args:** `<arguments>` (required: feature/module name, e.g., "museum", "compose", "settings/visibility")

## Purpose

Answer: "Can a real user use this feature end-to-end without hitting a wall?"

This is NOT `$audit` (code quality) or `$release` (packaging). This checks whether buttons work, flows complete, and nothing is stubbed out.

## Phase 1: Resolve Feature Scope

Map the argument to actual files:

1. Check `src/lib/features/<arguments>/` for feature directory
2. Check module definitions in `src/lib/shared/navigation/config/module-definitions.ts`
3. Check `moduleLoaders` in `src/lib/shared/modules/ModuleRenderer.svelte`
4. Check service getters in `src/lib/shared/` (colocated `get*.ts` files)

If the feature can't be resolved, tell the user and ask for clarification.

## Phase 2: Structural Scan

Read the feature's full file tree. Build a map of:

- **Components** -- all .svelte files, their parent-child import relationships
- **Event handlers** -- onclick, onsubmit, dispatch, callback props
- **Services** -- classes consumed via singleton getters (`getServiceName()`) or direct import
- **Navigation** -- module definition entry, tab definitions, route config
- **Data flow** -- what loads data (loaders, fetchers, Firebase calls), what renders it

Use file listing, repository search, and targeted reads. Be thorough. Read every component file.

## Phase 3: Infer User Flows

From the structural scan, construct user flows as numbered step sequences:

```
Flow 1: [Name]
  Step 1: User does X -> Component Y handles it
  Step 2: Component Y calls Z -> Result renders in W
  ...

Flow 2: [Name]
  ...
```

Think from the user's perspective. What would they do first? What would they try next? What's the intended journey?

## Phase 4: Confirm Flows with User

Present the inferred flows. Ask:

"Here's what I see this feature doing. Is this right? Anything I'm missing or anything that's not in scope yet?"

Ask the user directly if there are clear options, or open-ended if the flows need discussion. Wait for confirmation before proceeding.

The user may:
- Add flows you missed
- Remove flows that aren't in scope
- Correct your understanding
- Confirm as-is

## Phases 5-8: Analysis & Reporting

See `phases-reference.md` for:
- 6-dimension code-level gap analysis checklist (dead ends, missing states, flow continuity, integration wiring, data pipeline, visual completeness)
- Visual inspection walkthrough protocol
- Gap report template (blocker / broken / incomplete severities)
- Transition to implementation plan via `writing-plans` skill
