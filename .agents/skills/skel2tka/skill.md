---
name: skel2tka
description: Use when working on or checking status of the video-to-TKA notation pipeline
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Skel2TKA Pipeline

Development tracking for the video-to-TKA notation pipeline.

## Usage

- `$skel2tka` - Show phase status overview
- `$skel2tka status` - Same as above
- `$skel2tka phase <N>` - Show details for a specific phase

## Phase Definitions

| Phase | Name | Status | Gate |
|-------|------|--------|------|
| 0 | Infrastructure & Tooling | **active** | Overlay renders on Phase 1 data, frame scrubber works |
| 1 | Hand Tracking (Enhancement) | **active** | User accepts output for a test video via verification panel |
| 2 | Prop Endpoint Detection | locked | User confirms endpoint markers match actual staff positions |
| 3 | Rotation & Orientation | locked | User confirms turn count and direction match performance |
| 4 | Motion Classification | locked | User confirms motion type labels match TKA terminology |
| 5 | Sequence Assembly | locked | Side-by-side video + notation card match |
| 6 | AI Model Training | locked | 500+ verified training pairs collected |

## Instructions

### If no argument or "status":

Display the phase table above. For each active phase, show:
- What's been completed
- What remains
- Verification gate criteria

### If "phase <N>":

Show detailed breakdown of that phase:
- Architecture decisions
- Files involved (existing + planned)
- Verification criteria
- Dependencies on prior phases

## Key Architecture Rules

1. **Every phase produces visual output** a human can verify
2. **Every verification = training data** saved for future AI models
3. **Interfaces first** — future implementations swap in without rewrites
4. **Browser-first** — all processing runs client-side (server-ready via interfaces)
5. **Double staves only** — TKA's canonical prop

## File Locations

- Config: `config/skel2tka-dev.config.js`
- Feature root: `src/lib/features/skel2tka/`
- Service getters: colocated `get*.ts` files in `src/lib/shared/` for skel2tka services
