---
name: concepts
description: Use when building, reviewing, or planning any Learn tab concept lesson, or when discussing curriculum design, lesson interactivity, or concept progression
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Concept Lesson Development

When explicitly invoked, treat the text after `$concepts` as `<arguments>`. Expected shape: `[status|next|<concept-id>|philosophy|redesign]`.

Build and track the 28 interactive concept lessons in the Learn tab.

## Philosophy & Patterns

See `interaction-reference.md` in this directory for:
- The 8 interaction principles (non-negotiable)
- The Fire Jam Test for lesson copy
- Ranked interaction patterns table
- Anti-patterns table
- Lesson architecture patterns
- Science behind the philosophy

**Read interaction-reference.md before designing any lesson.**

---

## Usage

- `$concepts` — Show status dashboard of all 28 concepts
- `$concepts status` — Same as above
- `$concepts next` — What concept to build next + design guidance
- `$concepts <id>` — Deep dive on a specific concept (status, design notes, issues)
- `$concepts philosophy` — Display the full interaction philosophy
- `$concepts redesign <id>` — Plan a redesign for an existing concept

## Arguments

<arguments> - Command and optional concept ID

## Instructions

### Before Anything: Load Status

**Step 0 (mandatory):**

1. Read `docs/learn/concept-status.md` for current status of all concepts
2. Read the relevant concept definition from `src/lib/features/learn/domain/concepts.ts`
3. If working on a specific concept, read its experience component

### For no arguments or "status":

Display a dashboard: all 28 concepts grouped by category, each with status and brief description.

Statuses: `NOT STARTED` | `IN PROGRESS` | `BUILT` (not yet reviewed) | `REDESIGN` (needs changes) | `CONFIRMED` (user-tested and approved) | `BLOCKED`

**CONFIRMED requires:** The user physically interacted with the lesson and approved it. Code review alone does not count.

After showing dashboard, suggest what to work on next.

### For "next":

1. Find the highest-priority unfinished concept (curriculum order)
2. Present a design brief: what it teaches, which interaction patterns fit, concrete mechanic proposal, visual feedback, how wrong answers teach
3. Ask for user input before proceeding

### For a concept ID (e.g., "hand-positions"):

1. Show full status for that concept
2. If BUILT or REDESIGN: identify which philosophy principles it violates and propose fixes
3. If NOT STARTED: propose an interaction design using the ranked patterns
4. Show any design notes from `docs/learn/concept-status.md`

### For "philosophy":

Print the 8 principles and the interaction pattern ranking table. Useful for onboarding new sessions.

### For "redesign <id>":

1. Read the existing experience component thoroughly
2. Audit against all 8 philosophy principles — which does it violate?
3. Check which interaction patterns it uses vs. which would be better
4. Propose a concrete redesign with:
   - What changes (specific components/mechanics)
   - What stays (what already works)
   - Why this redesign better serves the philosophy
5. Wait for user approval before any implementation
