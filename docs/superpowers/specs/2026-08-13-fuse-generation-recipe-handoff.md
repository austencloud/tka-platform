# Fuse generation recipe and compact pairing handoff

## Mission

Finish the approved Fuse generation recipe and layout pass governed by
[`2026-08-13-fuse-generation-recipe-design.md`](./2026-08-13-fuse-generation-recipe-design.md).
The target is one responsive settings drawer with Path recipe and Pairing drill
pages, correct Level-bound orientations, richer one-hand LOOP generation, and a
compact pairing summary that returns space to the source and result workspaces.

## Done — verified

No implementation in this approved drawer-and-pairing scope has been committed.
The design decision and task list are recorded in the companion spec.

## Believed done — unverified

- None. Do not treat the existing uncommitted Fuse changes as complete solely
  because their focused checks passed earlier.

## In flight

The primary checkout is on `main` at the time of this handoff. It contains
uncommitted Fuse and sequence-engine work from the preceding generation pass,
including:

- shared Fuse Length, Level, and Max turns state and controls;
- turn allocation and materialization support in the sequence engine;
- generic and four-step one-hand LOOP generation work;
- Fuse animation, preview, saved-loop, VTG path, and responsive layout changes;
- focused Fuse and sequence-engine tests.

Those changes were previously exercised with focused suites: 34 Fuse tests
passed, the relevant engine/helper suites passed, the sequence-engine build and
TypeScript checks passed, and responsive browser checks covered phone,
landscape, tablet, desktop, and 4K. They remain uncommitted and need a fresh
verification pass after this approved redesign is implemented.

Relevant dirty paths observed before this handoff include:

- `src/lib/features/fuse/components/FuseGenerationControls.svelte`
- `src/lib/features/fuse/components/FuseSettingsDrawer.svelte`
- `src/lib/features/fuse/components/FuseWorkspaceHeader.svelte`
- `src/lib/features/fuse/components/FuseLayout.svelte`
- `src/lib/features/fuse/services/solo-loop-generator.ts`
- `src/lib/features/fuse/state/fuse-state.svelte.ts`
- `packages/sequence-engine/src/generation/turns/TurnAllocator.ts`
- `packages/sequence-engine/src/generation/turns/TurnMaterializer.ts`
- focused tests under `tests/unit/fuse/` and
  `packages/sequence-engine/tests/generation/turns/`

Preserve unrelated dirty files and reconcile with current contents before every
edit. Do not reset or replace the in-flight work.

## Loose ends (ranked)

1. Build the shared responsive Fuse settings drawer with Path recipe and Pairing
   drill pages. Desktop/4K opens from the right; mobile opens as a bottom sheet.
2. Move Basics into the recipe drawer and replace the header widgets with a
   compact recipe summary. Setting changes must not regenerate either path.
3. Share the Generate Style control presentation for prop continuity, hand
   continuity, and dash frequency while keeping Fuse state independent.
4. Add random-by-default start location, allowed orientation, and traversal
   direction controls to the recipe.
5. Extend one-hand generation and reusable sequence-engine scoring so both
   source Regenerate actions consume the same complete recipe.
6. Enforce the three-level orientation policy for every length: Level 1 and 2
   allow only In/Out; Level 3 also allows Clock/Counter; exclude interradials.
7. Give four-step flowers real variation in start location and clockwise versus
   counterclockwise traversal. Score authored candidates and use the generic solo
   generator when no valid authored candidate satisfies hard constraints.
8. Replace the tall inline pairing composer with Separate/Linked plus a compact
   relationship summary and Change link action.
9. Move driver, transform, live equation, Cancel, and Use this relationship into
   the Pairing drill page. Use a bounded, natural-width transform grid.
10. Add focused behavior tests, then complete the required responsive visual
    sweep and iterate on spacing, occlusion, and drawer composition.

## Decisions already made

- One Fuse-local recipe controls both Blue and Red Regenerate actions.
- The recipe does not reuse or mutate Generate's stored state.
- The Generate drawer and Style controls are the familiar interaction pattern;
  shared presentation should be reused instead of cloned.
- One Fuse drawer owns two destinations: Path recipe and Pairing.
- Header: title plus recipe summary only. Pairing gets its own compact bar.
- Desktop/4K: right drawer. Mobile: bottom sheet.
- Recipe Basics: Length, Level, Max turns.
- Recipe Style: Props, Hands, Dashes with Smooth/Mixed/Choppy or
  Low/Mixed/High choices.
- Starting conditions: location, orientation, and traversal direction, each
  random by default.
- Starting-condition and style selections are preferences beneath LOOP closure
  and Level validity.
- Fuse uses the current three-level Generate orientation policy. Level 1 and 2
  allow In/Out. Level 3 adds Clock/Counter. Interradials stay out.
- Four-step flowers must vary location and traversal direction instead of
  repeatedly following one canonical path.
- Existing paths stay visible until the user explicitly regenerates a source.
- Separate/Linked remains accessible without opening the drawer.
- Pairing changes remain drafts until Use this relationship is selected.

## Gotchas

- `GENERATED_FLOWER_START_ORIENTATIONS` currently admits all four
  In/Out/Clock/Counter orientations regardless of Level. Generic generation can
  also inherit an unrestricted template orientation. Fix both paths, not only
  the flower source.
- Reuse the policy in
  `src/lib/features/create/generate/domain/level-orientation-policy.ts`; do not
  establish a second definition of the three-level orientation rules.
- The broader nine-level curriculum assigns orientation milestones differently.
  This task follows the product's current three-level Fuse/Generate policy.
- Existing paired continuity constraints operate on two-hand pictographs. Fuse
  needs reusable single-motion scoring or an engine extension, not UI-side
  approximations.
- The authored four-step flower source may not contain a candidate for every
  preference combination. Preserve hard validity and fall back to generic solo
  generation when necessary.
- `FuseTransformPicker.svelte` currently stretches transform choices to the
  container width. Moving it into the drawer still requires a bounded grid.
- The repository has unrelated dirty work from other sessions. Commit and
  verify only explicit owned paths.
- A previous repository-wide `check:fast` reported 280 unrelated baseline
  errors. Use focused checks for the implementation, capture the baseline once,
  and do not attribute unrelated failures to Fuse.
- Port 5173 belongs to Austen's VS Code server. Do not start, stop, or restart
  it. Use the shared Chrome DevTools flow and exact viewport emulation for visual
  verification.
