# No Assumption Without Evidence — ENFORCED

Runtime-state claims ("the scene is active," "the component mounted," "the fix
is working," "X is causing Y") require tool output from the current turn that
directly checks that state — a DOM query, console capture, WebGL context
check, or before/after evidence. An indirect signal that pattern-matches is
not evidence: "ocean 3D scene is active" was once fabricated from a
localStorage value plus a canvas count, with the scene never loaded.

Permanent distinction, because it caused that incident:

- `backgroundType: "ocean"` in localStorage = the 2D CSS background theme
  (gradient + canvas animation).
- The 3D ocean scene = a Threlte environment inside Viewer3DCanvas that loads
  only when the sequence viewer's 3D pane is open with a sequence loaded.

Completely independent systems. One never implies the other.
