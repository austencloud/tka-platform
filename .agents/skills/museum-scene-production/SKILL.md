---
name: museum-scene-production
description: Use when producing museum scenes through approval gates, including floor plans, sightline proof, Blender grayboxes, registered visual targets, interaction slices, or runtime integration; when rebuilding a room; or when prose and loose concept art do not produce a clear spatial picture.
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Museum Scene Production

Develop one museum scene through evidence-backed gates without letting any
artifact replace its owner.

## Start

1. Load and follow the `museum` skill. Read the tracker before museum docs and
   record explicit user decisions there.
2. Read `references/gate-contracts.md` in full.
3. Read `references/visual-bridge.md` when prose or loose concept art does not
   give the user a clear picture of the room.
4. Search existing scene plans, validators, review routes, Blender contracts,
   and build scripts. State whether this work reuses, extends, or composes each
   owner before creating shared behavior.
5. After implementation approval, copy both templates from `assets/` into the
   scene's spec directory. For read-only requests, stop after the gate plan.

`references/process-review-ledger.md` and its linked reviews are historical
audit records. Do not load them during normal production or treat their model
names and pending-review language as an active gate.

## Run the Gates

Complete Gate 0 internally. Make Gate 1 the first user-facing artifact.

0. Prove current canon, room shell, transitions, roster, exact sequence sources,
   and conflicts. Use Flow Arts MCP for every TKA fact. Capture actual live loops;
   never substitute a newly generated valid variation for the museum sequence.
1. Present a measured floor plan, vertical section, numbered route, sightlines,
   hero visibility, interaction zones, and final view.
2. Present a playable Blender graybox built from the approved plan contract.
3. Present visual targets registered to approved graybox cameras.
4. Present one production-quality slice with its complete interaction.
5. Present the scene integrated with adjacent museum spaces.
6. Present the final acceptance walk and regression evidence.

Do not start work from a later gate. Record an explicit approval for the named
gate before advancing. Praise, curiosity, or "nice" is not approval. Rejection
returns the scene to that gate without discarding its evidence.

## Enforce the Contract

Keep one `scene-gates.json` beside the scene spec. Treat it as an evidence index,
not a second source of creative or spatial truth. Update references and hashes;
do not copy geometry or domain data into it.

Run:

```powershell
node .agents/skills/museum-scene-production/scripts/validate-scene-gates.mjs <scene-gates.json>
```

The validator MUST pass before presenting any gate as ready or approved.

## Visual Bridge Rule

When the user cannot simulate the space mentally, stop adding descriptive prose.
Produce the cheapest missing spatial artifact: diagram, section, route strip,
registered camera view, or playable blockout. Ask the user to describe what they
believe happens next; a correct read is part of approval.

## Scope

Use this skill to govern scene production. Do not use it for isolated prop edits,
copy changes, or code fixes that do not change a room's spatial experience.

Exit only when the requested gate has evidence, the manifest validates, and the
user has approved it when that gate requires human judgment.
