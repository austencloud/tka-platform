# Adaptive Scene Control Workspace Implementation Plan

**Design:** `docs/superpowers/specs/active/2026-08-21-adaptive-scene-control-workspace-design.md`

- [x] Add and test the measured presentation resolver.
- [x] Convert the scene rail to a controlled top-level tool rail.
- [x] Add the shared desktop inspector host and performer content composition.
- [x] Add compact performer and scene drill-down pages.
- [x] Compose the rail, inspector, and compact action bar in one workspace.
- [x] Reserve canvas width only for an open wide dock.
- [x] Integrate the production split viewer, standalone fullscreen viewer, and
      ocean test surface.
- [x] Reframe the cast for the remaining docked stage without discarding the
      user's viewing direction.
- [x] Run focused tests and the project type-check gate.
- [x] Verify all required viewport families and record the evidence.

## Verification record

- Layout resolver: 4 focused unit tests passed.
- Real components mounted without runtime console errors in an isolated Vite
  harness. The shared development servers were returning a Miniflare runtime
  500 before route code loaded, so they could not provide production-route
  screenshots during this pass.
- Visual and interaction checks passed at 3840x2160, 2560x1440, 1920x1080,
  1440x900, 820x1180, 960x412, 375x667, and 320x568. Checks included dock
  reservation, no horizontal overflow, compact drill-down navigation, 44px
  minimum targets, outside-pointer dismissal, and Escape dismissal.
- The repository type-check gate was invoked and remains red with 426 errors
  and 22 warnings across the shared dirty worktree. The focused resolver tests,
  Svelte compiler mounts, and browser runtime for this workspace are green.
