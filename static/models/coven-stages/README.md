# Coven stage GLBs

Drop optimized GLBs here (Blender → gltf-transform optimize, per
`.claude/rules/blender-first-3d-scenes.md`). Wire a stage to an effect by
setting `EffectMeta.stageModel` in
`src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`
to `/models/coven-stages/<file>.glb`. Unset → `CovenStation` keeps its original
stone-disc platform. First target: `template.glb` (shared template stage).
