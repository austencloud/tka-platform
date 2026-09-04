# Worktree Retirement Audit

**Audit window:** 2026-09-03 through 2026-09-04
**Starting `main`:** `5d68facd1ee8a07078d2c29f2cfdf41bff8eda86`
**Post-cleanup snapshot of `main`:** `294a0b868ef9d37dd53d7a403142952976f37ac6`

## Outcome

The cleanup retired registrations and branches only when their disposition was supported by Git ancestry, patch equivalence, a superseding implementation, or an explicit archival checkpoint. Live worktrees and worktrees needing a product decision were left intact.

The primary checkout's pre-existing changes to `scripts/audit-frame-budget.mjs` and `docs/superpowers/specs/flow-fest-sim/austen-site-markers.json` were not touched.

## Retired Registered Worktrees

| Worktree | Disposition | Preservation |
| --- | --- | --- |
| `.claude/worktrees/nice-hofstadter-19fcd9` | Merged | Detached tip was an ancestor of `main` |
| `tka-platform-composer-multiview-copy` | Superseded | Copy-only change was replaced by the later Composer copy pass on `main` |
| `tka-platform-fuse-recipe-stage` | Abandoned as superseded | Seven dirty paths were checkpointed at `406e4f0660`; branch retained |
| `tka-platform-left-right-rock-solid` | Retired pending selective reconciliation | Clean branch retained at `5ae8d33578` |
| `tka-platform-rational-ratio-theory-atlas` | Merged | Tip was an ancestor of `main` |
| `tka-platform-walk-lab-terminal-step` | Failed research prototype | Nineteen research commits retained at `3a18f72fff`; six temporary roots containing 935 files were discarded |
| `tka-platform-worktrees/3d-zero-jank-startup` | Partially superseded | Untracked design moved to the backlog; merged branch deleted |
| `worktrees/tka-platform/bg-cycle` | Merged | Tip was an ancestor of `main` |
| `worktrees/tka-platform/renderloop-stall` | Merged | Tip was an ancestor of `main` |
| `tka-platform-performer-direct-manipulation-2026` | Retired pending selective reconciliation | Thirteen dirty paths were checkpointed at `d839972788`; branch retained |
| `tka-platform-portrait-director` | Retired pending selective reconciliation | Fourteen untracked paths were checkpointed at `9fbaa6396d`; branch retained as the Screen Take prototype |

The retained 3D startup design is [2026-08-30-3d-scene-zero-jank-startup-design.md](../specs/backlog/2026-08-30-3d-scene-zero-jank-startup-design.md).

## Deleted Merged or Superseded Branches

The following branch tips were verified as ancestors of `main` immediately before deletion:

- `claude/bg-cycle`
- `claude/nice-hofstadter-19fcd9`
- `claude/renderloop-stall`
- `codex/3d-viewer-progressive-design`
- `codex/3d-zero-jank-startup`
- `codex/canonical-hand-colors`
- `codex/ember-set`
- `codex/flow-fest-entrance-reference`
- `codex/flow-fest-sim`
- `codex/grip-separation-fallback`
- `codex/rational-ratio-theory-atlas`
- `codex/wrist-calibrated-length`
- `codex/wrist-side-clearance`
- `codex/wrist-world-clearance`
- `worktree-agent-a2a538507ed4f06e3`

`codex/composer-multiview-copy` was deleted as an explicitly accepted superseded branch at `a223456a50`.

## Preserved Branches Without Worktrees

| Branch | Tip | Reason retained |
| --- | --- | --- |
| `codex/fuse-recipe-stage` | `406e4f0660` | Archival record of the superseded recipe-stage design and implementation |
| `codex/left-right-rock-solid` | `5ae8d33578` | Nine unique commits need selective reconciliation against current locomotion architecture |
| `codex/walk-lab-terminal-step` | `3a18f72fff` | Nineteen research commits document rejected and fail-closed locomotion experiments |
| `codex/performer-direct-manipulation-2026` | `d839972788` | The Place-mode and drag-guide prototype needs selective reconciliation against current 3D interaction owners |
| `codex/portrait-director` | `9fbaa6396d` | The page-capture and portrait-camera prototype will become a Post Studio Screen Take source, not a parallel Director product |
| `codex/museum-scene-decomposition` | `c08da4c927` | Contains one large museum decomposition commit not present on `main` |

## Filesystem Quarantine

Thirty-six unregistered directory copies were moved, without recursive deletion, to:

`E:\_tka-worktree-quarantine\2026-09-03-worktree-retirement`

This includes 25 merge/direct-landed residues, six superseded residues, the empty release-stabilization directory, the standalone Ceremony clone, and four directories Git unregistered but could not fully remove on Windows. The standalone `tka-platform-wt-sequence-viewer-transitions.node_modules-junction` was unlinked after verifying that its target was `E:\tka-platform\node_modules`; the target remained intact.

The quarantine is recoverable. It may contain nested dependency junctions, so it must not be recursively deleted until those links are audited and unlinked. `E:\tka-platform-ember-geology-sources` was deliberately excluded because it was the live source cache for ongoing Ember geology work.

## Worktrees Protected as Live or In Flight

At the post-cleanup snapshot, the following worktrees remained registered and were not modified:

- `tka-platform-create-frontdoor-scale`
- `tka-platform-fuse-hierarchy`
- `tka-platform-grants-2026`
- `tka-platform-hand-position-continuity`
- `tka-platform-moon-handoff-final`
- `tka-platform-pictograph-foundations`
- `worktrees/tka-platform/ember-followup`
- `worktrees/tka-platform/grip-goals`
- `worktrees/tka-platform/option-raf`
- `worktrees/tka-platform/tunnel-pixel-cascade`

## Product Decisions Still Required

### Performer workspace multi-selection

`codex/performer-workspace-fill` contains four commits absent from `main` plus five dirty paths. Its central product choice is a multi-performer editing workspace, while current `main` follows the later single-selected-performer interaction model. Decide whether multi-selection is still desired before reconciling or retiring this branch.

## Accepted Follow-up Reconciliation

- Reconcile the unique left/right locomotion work against the current planner, animator, terminal-transition, and foot-contact owners. Do not merge the stale branch wholesale.
- Reconcile the unique performer Place-mode and drag-guide work against the current 3D interaction owners. Do not merge the stale branch wholesale.
- Reconcile the unique Portrait Director page capture and camera work as a Screen Take acquisition flow for Post Studio. Post Studio remains the 9:16 composition owner, and the shared frame capturer and background encoder remain the output owners. Do not merge the standalone Director shell or route.
- After each reconciliation is verified on current `main`, delete its archival branch.
