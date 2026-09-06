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

## Follow-up: coordinate the surrounding controls

The first implementation preserved the canvas but changed its surroundings:
the outer inspector closed while Studio's inner inspector opened, the rail was
top-aligned by Studio overrides, and Studio mounted another Card and transport.
The replacement keeps the desktop inspector in the same outer track and loans
the existing Card and UnifiedTimeline through the viewer-local surface owner.
Only Studio-specific controls arrive with the phone chrome. The old export action
becomes inert and invisible without removing its allocated footer space.

At 1440×900, the inspector, rail, and editor now retain their exact rectangles
in both modes; the editor keeps its 749.7px scroll height. At 1920×1080 and
2560×1440 the same equality checks passed for all six measured identities:
canvas, Card, playback transport, inspector, rail, and editor. Returns restored
the original hosts with no body-level handoff overlays left behind.

Measuring the actual canvas (not its wrapper) caught an extra 60.7px height
jump when its playback bar left. The mounted-node action now supports capturing
the visual child before sibling layout changes. The corrected first painted
frame at 1440×900 stays 692×786.7, then flies to 367.3×366.2 in the phone.
The regression trace records per-surface position backtracking and size reversal,
split by transition direction so a legitimate round trip is not called a wobble.

Compact Studio keeps Canvas/Edit/Timing navigation instead of squeezing a phone
beside a full inspector. An 820px pass caught that incorrect desktop allocation;
the stationary inspector now uses Studio's existing 70rem compact boundary.
Direct checks at 375×667, 960×412, and 820×1180 found the shared inspector
accessible from Edit, and the same transport node moving between Canvas and
Timing. Wide-layout inspection also covered 1440×900, 1920×1080, 2560×1440,
and 3840×2160. At 4K the phone, inspector, and transport fit the measured viewport;
native capture on this Windows host still crops/scales the emulated screenshot.

Five alternating selections 90ms apart retained the same canvas, Card, transport,
and inspector, with zero leftover flight overlays and no document overflow.
The compact playback menu also exposes Studio's Advanced timing action.

Focused ownership/motion tests pass (12 tests), as does Svelte check (zero errors
and warnings). The wider composition suite was initially blocked by a missing
local `zod` package; after shared dependencies became available again it passed
all 59 tests across eight files. Preview delivery uses the task's port 5428 until
guarded integration succeeds.
