# Sequence Viewer ↔ Post Studio: live surface continuity

## Ownership

The viewer owns one mounted AnimatorCanvas and one AnimationPanel. Post Studio
borrows those instances rather than mounting matching copies. The existing
mounted-node action carries each live surface above its clipping hosts using
the canonical layout-motion clock, follows its moving destination, and docks
it when the flight ends. Reversals capture the current painted rectangle and
invalidate the previous completion callback. Reduced motion reparents directly.

The context is viewer-local, never a module-global renderer registry. A Studio
animation slot supplies frames calculated by its existing sequence orchestrator.
The viewer playback clock pauses while the composition clock owns the renderer;
entry adopts the viewer position/tempo/play state, and exit adopts Studio's
position/play state. Scrubbing and the existing frame-by-frame exporter therefore
drive the same canvas. Export is unavailable during the canvas flight.

The inspector preserves its selected section and shared settings. Studio supplies
its playback/tempo/prop callbacks and hides the viewer-only export action. A
parked inspector cannot retain a mobile ControlDock tray that suppresses the
mode bar. Card/art source selections still use their existing inspectors.

One physical canvas cannot appear in two simultaneous slots: the first animation
slot borrows it; additional slots and standalone Studio retain their existing
renderer. This is intentional, not a second always-running preview.

## Regression instrumentation

Workspace replays now record the actual shared canvas and inspector identities,
plus whether each has reached its Studio destination. Zero measured identities
does not pass. The development-only review fixture exposes the Studio mode
without changing production access checks.

## Evidence

- Direct browser equality checks confirmed the same canvas and inspector in both
  directions; Props remained selected on entry and return.
- A paused Studio seek to step 1 produced canvas position 1 and returned to 2D
  paused at position 1. Playing samples matched the composition position exactly.
- A playing Studio return stayed playing in 2D: position advanced from
  2.63676 to 3.17352 during the post-return sample. Studio pauses its outgoing
  clock only after the viewer has adopted that playback state.
- Reduced-motion browser verification retained both instances with no handoff
  overlays. The focused suite passed 84 tests across 11 files; Svelte check
  reported zero errors and zero warnings.
- Five alternating mode selections 90 ms apart retained both instances and left
  zero body-level handoff overlays after settling.
- Live inspection caught and corrected two ownership defects: the canvas needed
  to own its height after leaving the split pane; action cleanup must not restore
  an already-detached node and resurrect a dead canvas over the live one.
- Targeted tests cover single-slot ownership, viewer isolation, stale cleanup,
  interrupted reparenting, reduced motion, and detached-node cleanup. Existing
  composition timing and export-compositor tests remain in the verification set.
- A real 6.4-second MP4 render completed and exposed Download MP4. During export,
  both composition and shared canvas reported position 3.6866666666666665; after
  completion both returned to the previous position 6.113799999999997.
- Selecting the card opened its existing settings while the shared inspector
  returned to its parked host; the animation canvas remained in the phone.
- Responsive passes exercised 375×667, 960×412, 820×1180, 1440×900,
  1920×1080, 2560×1440, and 3840×2160. Measured entries retained the same canvas
  and inspector and introduced no document horizontal overflow. The compact
  action bar now uses labelled menu triggers and drops redundant position words
  before the source labels can overlap; its sound button has a loaded icon.

Visual inspection uses the real shared shell in the deterministic transition
fixture, not a mocked phone or a screenshot replacement. Native browser captures
are used because raw CDP screenshots on this Windows host mis-scale emulated
viewports. The shipping route remains `/sequence/EHWE`.
