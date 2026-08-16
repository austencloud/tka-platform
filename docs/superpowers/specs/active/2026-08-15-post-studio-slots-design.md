# Post Studio Slots — Design

**Status:** active · **Date:** 2026-08-15 · **Iteration:** 2 of Post Studio

## The problem

Post Studio presents a post as a choice among four named templates. That is not
what a post is. Austen (2026-08-15):

> that template is animation on top and choreo card on bottom. Or alternatively
> the second template would be performance on top and choreo card on bottom. or
> alternatively we could have performance on top and animation on bottom. In
> other words we should be able to pick these things incredibly simply and
> incredibly easily but right now I can't even select the top or bottom and
> click my delete key and remove it.

A post is **two stacked slots**, each holding a media source. The four presets in
`post-studio-presets.ts` are four frozen samples of that space. With three source
types there are 9 two-slot pairs plus 3 full-frame singles; four are reachable,
and Performance-over-Animation — one of the three Austen named — is not among
them.

Delete does nothing because the verb does not exist. Regions carry an `onclick`
that selects (`PostStudioPreview.svelte:177`) and there is no keydown handler
anywhere in the post-studio folder. The state exposes `selectRegion` /
`selectRole` but no `setSlotSource`, `clearSlot`, or `swapSlots`. Selection only
decides which settings the inspector shows.

Two behaviours in the current build are invisible and unasked-for:

- `performance-breakdown` crossfades Performance into Animation from 44% to 56%
  inside the top region (`post-studio-presets.ts:222`). Nothing in the UI says so.
- `selectRole` searches other presets for one containing the clicked role and
  switches to it, so clicking a source in the rail can rearrange the layout
  without announcing it.

## Decisions (locked 2026-08-15)

| Question | Decision |
|---|---|
| Slot count | Fixed at two. An empty slot collapses the other to full frame. |
| Time-sliced slots | Keep and generalise. A slot is a track of 1..N clips with crossfades. |
| Media types | All six in wave one: Animation, Performance, Choreo card, Tunnel, 3D view, Mandala. |
| Two 3D slots | Not allowed. Choosing 3D for one slot removes it as an option for the other. |
| Saved layouts | Survive as derived output, not as the source of truth. |

## The model

**A slot is a track.** It holds one or more clips in time order, with crossfades
at the seams. One clip spanning the full duration is the default case, not a
special case.

This needs no new engine work. `fractionVisualClip(id, role, region, start, end)`
plus a `crossfade` transition is exactly what `performance-breakdown` already
does. Austen's example — top slot Animation throughout, bottom slot Animation
then Choreo card — is the same call with different arguments.

The editor for it already exists and is already the right shape: the Advanced
timing panel renders a lane per region with draggable clip edges, and was
promoted to full workspace width in `28062c02d9`.

### Region normalisation

Region ids today are per-preset (`motion`, `card`, `performance`). They normalise
to two canonical ids:

- `top` — rect `{x:0, y:0, width:1, height:split}`
- `bottom` — rect `{x:0, y:split, width:1, height:1-split}`

`split` defaults to 0.56 and is draggable. One slot empty → the surviving slot
takes `{0,0,1,1}`. Both empty is invalid; the last slot cannot be cleared.

Migration runs on preset load: sort regions by `y`, reassign ids to `top`/
`bottom`, rewrite every clip's `regionId`. This covers the four built-ins and any
preset already saved to Firestore.

### Source registry

Roles are currently declared ad hoc in `post-studio-presets.ts`. They move to a
registry of six:

| key | label | renderMode | capture | seekable |
|---|---|---|---|---|
| `animation` | Animation | `sequence-animation` | canvas walk | yes |
| `performance` | Performance | `external-media` | `<video>` | yes |
| `card` | Choreo card | `choreo-card` | html-to-image | per beat |
| `tunnel` | Tunnel | `tunnel` | canvas walk | yes, needs wrapper |
| `scene3d` | 3D view | `scene-3d` | canvas walk (WebGL) | yes |
| `mandala` | Mandala | `mandala` | pure renderer | no, static |

### What each new type costs

Verified 2026-08-15 against the source, not assumed.

**Mandala.** No WebGL. `SequenceMandala.svelte` declares a `currentStep` prop and
never reads it — the mandala is a whole-sequence fingerprint, one still image,
not a frame at a time. Its render target flips between `<svg>` and `<canvas>`
depending on whether it is animating, so DOM capture is unreliable. The pure
functions (`calculateMandalaGeometry`, `renderMandalaToCanvas`) are already used
headless in a Web Worker by `mandala-export.worker.ts`. Bind those directly into
an offscreen canvas and treat the layer as a still.

**Tunnel.** Canvas2D. `tunnel-poster.ts:48` already walks every `<canvas>` in a
container and composites via `drawImage`, which is the compositor's existing
branch. `TunnelArtView` runs its own RAF clock and cannot be seeked;
`AnimatorCanvas` underneath accepts `currentStep` and `virtualTime` (the video
exporter drives it that way). Needs a seekable wrapper in place of the
self-driving view.

**3D view.** `Viewer3DCanvas` already sets `preserveDrawingBuffer: true` and
takes a float `currentStep`, and `capture-3d-scene.ts` plus
`export-coordinator.svelte.ts:377` are working capture paths. The cost is
bootstrap: a Svelte context installed before mount (`setViewer3DContext` +
`viewer.enter3D`), a required avatar/performer, hardware tier detection, and
async scene features behind a 15-second gate. It is not a component that can be
casually mounted in a preview slot.

## Interaction

The preview is the picker. The Layouts rail and the Sources rail are deleted.

- Click a region → selected, with a full-element ring. Not a left-edge bar
  (`no-left-edge-accent-bar.md`).
- `Delete` / `Backspace` on a selected slot → clears it; the survivor goes full
  frame.
- An empty slot shows the six source targets. Choosing one fills it.
- Swap moves top ↔ bottom.
- A second clip in time is added from the timeline lane, which already exists.
- 3D is greyed out in one slot while the other holds it.

## Fat to cut

Three identical eyebrow-over-title double headers on one screen: `TEMPLATES /
Layouts`, `MEDIA / Sources`, `SELECTED LAYER / Animation`. The same pattern was
removed from Timing in `28062c02d9` and left standing three times elsewhere.
Also: prose under each template restating its own thumbnail, "Used in this
layout ✓" restating the preview, "Ready to render this layout." as a status
line, and "Select a region to edit" — a hint that exists only because direct
manipulation was never wired. In the inspector, Look/Placement → a five-item
rail → a "VISIBILITY" header is three nav levels to reach a toggle.

## Phases

- [x] **P1 — Slot model.** Regions normalise to `top`/`bottom` on load
      (`post-studio-slots.ts`, applied in `adoptPreset`). Verbs `setSlotSource`,
      `clearSlot`, `swapSlots`, `setSlotSplit` on composition state, plus
      `slotOccupancy` and the `slotAccepts` one-3D-at-a-time gate. `selectRole`
      no longer switches presets behind the user's back. Six-source registry
      (`POST_STUDIO_SOURCES`) with `renderMode`, `defaultFit`, `isStill`,
      `exclusive`; three new `MediaSourceKind` values and a
      `linked-sequence-derived` role resolution. No UI change — 21/21 unit tests
      in `tests/unit/post-studio-slots.test.ts`, `npm run check` 0/0, and all
      four presets verified live at `/test/post-studio` holding their exact
      original geometry (0.56 · 0.6 · full · full) with zero console errors.

      One deliberate change beyond the ledger: region *labels* now come from the
      occupying source rather than the position, so the preview's accessible
      names stayed "Animation" / "Choreo card" instead of degrading to "Top" /
      "Bottom". The role labels shortened to match ("Sequence animation" →
      "Animation") since they now name a slot and a chooser option.
- [x] **P2 — Direct manipulation.** Each slot carries a chip naming its source;
      the chip is a menu of all six sources plus Remove, with 3D disabled in one
      slot while the other holds it. `Delete`/`Backspace` on a selected slot
      clears it (handler on the region surface, not the document, so it cannot
      fire from a text field). A swap control straddles the seam; the collapsed
      single shows an "Add {slot} slot" chooser on the edge the new slot appears
      on. Selection is a full-element ring.

      Both rails are gone. `PostStudioPresetPicker.svelte` and
      `PostStudioSourcePanel.svelte` are deleted — Sources restated what the
      preview shows and its only verb (`requestSource` on a missing role) was
      already on the region click path, and Layouts became a shortcut rather
      than the way a post is built, so it is one menu behind the preset name the
      top bar already displayed. The workspace is two columns; the mobile
      "Layout" tab went with the rail.

      Two things the frames caught that the code did not: the canvas column was
      taking every spare pixel (1123px holding a 395px frame), so surplus past
      `frame + matting` now goes to the inspector up to a share of the
      workspace; and the scale tiers were declared on `.studio-body` only, which
      left the new top-bar control at 12px on a 3840 screen — they now land on
      every direct child. Chips drop to icon-only on a wide-short stage where a
      named chip is wider than the whole 112px frame.

      Evidence: 21/21 unit tests, `svelte-check` 0/0, zero console errors, and
      screenshots at 1920 / 3840 / 1440 / 960×412 / 375×667. Skipped 2560 —
      it sits between two verified tiers with no seam of its own.
- [ ] **P3 — Source registry + three new modes.** Registry of six. Mandala via
      pure renderer; Tunnel via seekable `AnimatorCanvas` wrapper; 3D via context
      bootstrap with the one-slot policy.
- [ ] **P4 — Compositor branches.** `tunnel`, `scene-3d`, `mandala` capture paths
      in `post-studio-frame-compositor.ts`. Verify an actual export of each.
- [ ] **P5 — Multi-clip tracks.** `appendClipToSlot`, `removeClip`, crossfade at
      seams, edited from the timeline lane.
- [ ] **P6 — Trim.** The three double headers, the prose, the status filler, the
      inspector's nav depth.

## Verification

Every phase carries evidence in the same message per `verification-protocol.md`.
Visual phases (P2, P6) are screenshotted at 1920 / 2560 / 3840 / 1440 / 960×412 /
375×667 per `visual-verification-mandatory.md`. P4 is not done until a rendered
export of each of the six source types has been produced and looked at.

## Related

- `28062c02d9` — timing promoted to a workspace-wide bar (the multi-clip editor)
- `.claude/rules/no-left-edge-accent-bar.md`, `never-hand-roll.md`,
  `visual-verification-mandatory.md`, `no-layout-shift.md`
