# Shape Matrix Animation Workspace

## Outcome

The Shape Matrix Explorer has one relationship-selection model and one animation
workspace. A visitor always chooses the canonical hand timing and direction,
sees the exact prop result, and receives a prop-phase choice only when the
selected flowers genuinely admit more than one exact result. Playback,
appearance, prop, effort, and effect controls reuse the Sequence Viewer's
animation panel. Disassembly belongs to the stage rather than to whichever of
the two retained crossfade canvases happens to be visible.

## Exact relationship space

The Flow Arts Knowledge MCP establishes that Same/Opposite names the hand-path
direction and that quarter time is a 90-degree phase relationship rather than a
duration. The Shape Matrix parity solver then supplies the app-specific exact
realization graph for the two flowers selected by the visitor.

The focused graph sweep covers every pro/anti × in/out semantic pairing at 0,
0.25, 0.5, and 1 turn:

- zero, whole, and half-turn bands contain six exact Hand × Prop pairings;
- quarter-turn bands contain eight exact pairings;
- every hand relationship has one prop result outside quarter bands;
- on quarter bands, exactly two hand relationships have two valid prop phases;
- the legacy Hands view exposed only the first candidate for those branches;
- the legacy Props view exposed the complete graph through a secondary hand
  picker.

Six hand buttons therefore cannot uniquely identify all eight quarter-turn
pairings. The missing information is one binary prop-phase decision on the two
ambiguous hand relationships, not a persistent global driver mode.

## Relationship interaction

Remove the Hands/Props driver switch.

The relationship control has two stable roles:

1. `Hands` is the canonical six-button row and is always interactive.
2. `Prop result` occupies a reserved secondary slot. When the selected hand has
   one exact result, the slot is a passive derived readout. When it has two
   exact results, those two results become selectable buttons.

Changing the hand relationship preserves the current prop result when that
edge exists. Otherwise the nearest exact phase from the parity solver becomes
active. Changing the prop phase never changes the selected hand because only
compatible results are offered in this contextual slot.

This exposes every exact pairing without twelve persistent buttons, a hidden
"last row clicked" mode, or a secondary hand-path question. The hand and prop
corner glyphs and the paired relationship footer continue to name the active
edge.

Legacy shared URLs containing `driver=props` and `propMode` restore the exact
Hand × Prop edge. New writes retain `propMode` when it disambiguates the
selected hand but stop emitting a relationship driver. Parsing remains
backwards compatible.

## Animation control composition

Reuse `AnimationPanel` and its `ControlDock` bottom layout for:

- physical prop selection;
- effects and trails;
- effort;
- play/pause, BPM, and playback mode;
- path and display controls.

Export, save, remix, practice, card, and 3D actions remain Sequence Viewer
operations because they act on a sequence artifact rather than the presentation
of a generated Shape Matrix realization.

The dock is used in the constrained detail pane at every viewport. Opening a
tray temporarily yields the relationship picker and pictograph strip so the
hero remains useful. `ControlDock` owns tray motion; the Shape Matrix host uses
the canonical structural motion helpers for the yielding regions. A persistent
play/pause action remains available in the dock bar.

Physical prop type remains owned by `ShapeMatrixAppState` because it also
rebuilds matrix paths. `AnimationPanel` calls that owner rather than creating a
second prop state. Once the dock is available in both selected and empty detail
states, the redundant header prop action may be removed while the overflow
fallback remains available.

## Shared animation state

One Shape Matrix animation workspace state is created at the detail-pane root
and distributed through context. It owns:

- playback intent;
- BPM and playback mode;
- animation visibility/settings/effects scope;
- the active settings tray;
- the stage disassembly target.

Both retained `InlineAnimationPlayer` instances consume the same intent. The
hidden player pauses while it is not eligible to render, but it does not invent
its own user playback preference. A source handoff therefore preserves pause,
speed, effects, effort, and display settings.

The tuned Shape Matrix trail preset remains the initial presentation. Shared
effect controls modify that intent through the existing animation-scope owners
rather than mutating a process-global singleton.

## Disassembly

Extend `AnimatorCanvas` with a controlled disassembly target while preserving
the existing external-rendering contract used by Fuse. Thread the new contract
through `InlineAnimationPlayer` and pass one target to both retained Shape
Matrix players.

Starting disassembly closes any open settings tray before the canonical
transition begins. Settings may reopen after the transition settles so solo
props can still be tuned. Rapid target changes reconcile at transition
settlement instead of programmatically clicking context-menu actions.

Add `auto` to the existing stacked/sidecar disassembly layout contract. Resolve
it from the measured animation-container aspect ratio:

- square and portrait containers use stacked composition;
- genuinely landscape containers use sidecar composition;
- the resolved layout is stable for the active disassembly transition/session
  so resizing cannot jump the canvases mid-transition.

Existing explicit `stacked` and `sidecar` consumers do not change.

## Capability ownership

Search terms: `ControlDock`, `AnimationPanel`, `playbackAllowed`,
`onTogglePlaybackRef`, `externalBpm`, `externalToggleDisassemble`,
`externalDisassembled`, `viewState`, `disassemblyLayout`, `propMode`, and
`relationshipDriver`.

- Reuse `AnimationPanel` for animation presentation controls.
- Reuse `ControlDock` for the responsive settings drill-down and tray motion.
- Extend `AnimationPanel` with a host-visible active-tray callback and neutral
  accessibility label where necessary.
- Extend `InlineAnimationPlayer` with controlled playback and disassembly
  intent.
- Extend `AnimatorCanvas` with controlled internal disassembly and automatic
  container-relative layout while preserving its legacy external contract.
- Compose those owners in `ShapeMatrixDrill`; do not create another animation
  settings implementation.
- Replace the driver-based relationship presentation with a feature-local
  projection of the exact `ModeRealization` graph. The parity solver remains
  the behavior owner.

## Layout and motion

- The hero keeps a reserved media box through loading, source swaps, tray
  changes, and disassembly.
- The prop-result slot reserves its one/two-choice geometry so phase ambiguity
  does not move the hero.
- Relationship and rail regions use canonical grow/fade or layout motion when
  they intentionally yield to an open tray.
- No feature-local durations, easing curves, FLIP helper, `transition: all`, or
  viewport-driven type scaling is introduced.
- Component container queries own recomposition. Ordinary control and type
  sizes remain stable at native 4K.

## Implementation checklist

- [x] Prove relationship graph cardinalities across representative level bands.
- [ ] Replace the driver switch with canonical Hands + contextual Prop result.
- [ ] Preserve legacy driver/prop URL restoration and serialize exact edges.
- [ ] Add focused selection-graph and state round-trip tests.
- [ ] Create the local Shape Matrix animation workspace state/context.
- [ ] Compose `AnimationPanel`/`ControlDock` without export operations.
- [ ] Route physical prop changes through `ShapeMatrixAppState`.
- [ ] Add stage-level playback intent shared by both retained players.
- [ ] Add stage-level disassembly intent shared by both retained players.
- [ ] Add automatic stacked/sidecar disassembly layout.
- [ ] Coordinate tray, relationship-picker, rail, and disassembly transitions.
- [ ] Remove redundant header prop control only after the dock covers empty and
      selected detail states.
- [ ] Update About copy and accessible labels for the new relationship model.
- [ ] Run focused tests and one full project check/build gate.
- [ ] Verify transitions and final composition at 375×667, 960×412, 820×1180,
      1440×900, 1920×1080, 2560×1440, and 3840×2160, plus 200% zoom.
- [ ] Integrate the verified branch into local `main` with `wt:finish`.

## Risks

- A hidden retained player must mirror user intent without doing unnecessary
  render work while ineligible for playback.
- Controlled disassembly must not alter Fuse's externally rendered split-view
  contract.
- Settings and Shape Matrix state must share owners without leaking local
  preview changes into unrelated viewer sessions.
- Removing `driver` from new URLs must not invalidate existing shared links.
- The compact prop-result slot must remain understandable when prop timing is
  unavailable for mixed turn rates or Float.

## Verification

Unit tests cover graph projection, deterministic fallback, legacy URL parsing,
exact edge serialization, playback intent, and interruptible disassembly state.
Visual proof covers both relationship endpoints, one/two-result states, open
and closed control trays, assembled/disassembled source swaps, portrait stacked
solos, landscape sidecar solos, reduced motion, touch targets, and all required
viewports.
