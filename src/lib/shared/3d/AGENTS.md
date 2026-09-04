# Shared 3D Contract

This file applies under `src/lib/shared/3d/`. The current user request and
higher-level `AGENTS.md` files remain higher priority.

- Search current owners before adding scene boot, renderer, interaction,
  locomotion, animation, effect, or prop behavior. Extend one owner rather than
  creating a feature-local parallel stack.
- Static scene geometry and set dressing use the established Blender-to-GLB
  pipeline. Runtime geometry is reserved for behavior that is genuinely
  dynamic or parametric.
- Before locomotion, gait timing, foot contact, stops, turns, crossed stepping,
  retargeting, terrain traversal, or motion matching, read
  `.claude/rules/locomotion.md` and
  `docs/architecture/locomotion-research-canon.md`.
- Keep research, adopted architecture, prototypes, shipped behavior, and live
  visual proof distinct. A design document or fixture is not runtime evidence.
- Do not import or ship motion datasets until commercial use, modification,
  redistribution, attribution, performer, media, code, and model rights are
  recorded.
- Verify changed 3D behavior in the real surface and on every affected rig.
  Measure the claimed behavior and inspect visible contact, continuity,
  interpenetration, camera composition, and reduced-motion behavior.

Use `.claude/rules/blender-first-3d-scenes.md` for scene assets and search
`docs/architecture/canonical-capabilities.md` with `rg` for current behavior
owners.
