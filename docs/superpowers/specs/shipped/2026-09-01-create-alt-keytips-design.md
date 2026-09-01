# Create Alt Keytips — Design Spec

**Date:** 2026-09-01  
**Status:** Approved  
**Supersedes:** `2026-04-04-alt-hotkey-overlay-design.md` presentation and
disclosure behavior. The registered shortcuts remain unchanged.

## Decision

Alt is a modifier, not a panel launcher.

Create keeps its existing `Alt+key` commands. A quick Alt tap and a normal
Alt chord do not open UI. Holding Alt without pressing another key for 300ms
reveals compact keytips inside the existing Create method header. Releasing Alt,
switching focus, or leaving the page hides them.

The header also gains an explicit Keyboard shortcuts button. That button opens
the existing global Shortcut Center in its current-area view with `Alt+`
pre-filled in search. Persistent help therefore appears only after an explicit
request.

## Why

The previous surface combined two interaction contracts:

- an ephemeral guide for a modifier chord;
- a sticky, clickable command launcher.

That made the weakest possible signal, pressing a modifier, open a large panel
over the artifact. The panel also hardcoded binding labels and directly invoked
transform behavior even though the shortcut registry and Sequence Actions
already own those capabilities.

The new pattern separates the contracts:

- the registry continues to execute and customize shortcuts;
- the Create header presents registry-backed, temporary keytips;
- Shortcut Center owns persistent discovery and editing;
- Sequence Actions and Props keep mouse access to the commands.

## Header Composition

The Create method bar keeps a fixed height and three regions:

```text
Create / Construct | available keytip slot | Keyboard shortcuts
```

The keytip slot is always reserved. Visibility changes through opacity, so the
workspace never moves and no artifact content is covered.

The desktop keytip groups are:

- Rotate left and right
- Mirror
- Flip
- Swap
- Invert
- First step
- Rewind
- Prop presets

Bindings come from `ShortcutCustomizer.getAllShortcutsWithBindings()`. Disabled
commands and commands rebound away from Alt are omitted. Prop preset keys are
summarized from their effective bindings rather than assumed to be `1–0`.

## Interaction Contract

| Input                                                | Result                                                |
| ---------------------------------------------------- | ----------------------------------------------------- |
| Tap Alt for less than 300ms                          | No visible change                                     |
| Press Alt, then another key before 300ms             | Execute the chord; no keytips                         |
| Hold Alt for 300ms                                   | Reveal keytips in the reserved header slot            |
| Press a chord after keytips appear                   | Execute normally; keep keytips until Alt is released  |
| Release Alt                                          | Hide keytips                                          |
| Window blur or page hidden                           | Hide keytips and cancel pending reveal                |
| Input, textarea, select, or editable content focused | Do not reveal keytips                                 |
| Click Keyboard shortcuts                             | Open Shortcut Center for this area filtered to `Alt+` |

The browser receives `preventDefault()` for the standalone Alt keydown so its
menu focus does not replace the app interaction. Shortcut keydown events still
reach the central keyboard manager.

## Responsive and Accessibility

- The keytip interaction is enabled only for fine-pointer desktop layouts at
  least 768 CSS pixels wide, preserving the previous desktop-only boundary.
- Below the wide desktop tier the launcher collapses to an icon while retaining
  its accessible name and 44px target.
- The header never grows, wraps, or pushes the workspace.
- Keytips are supplementary. The explicit button and global `?` shortcut keep
  the persistent reference keyboard-accessible.
- Reduced motion removes the keytip opacity transition.
- Effective custom bindings are displayed with the shared
  `KeyboardKeyDisplay` primitive.

## Ownership

- Shortcut behavior and bindings: `shared/keyboard` registry and customizer
- Persistent help: `ShortcutCenter.svelte`
- Create-specific keytip presentation: `CreateShortcutHeader.svelte`
- Workspace header composition: `CreateModule.svelte`
- Mouse-accessible transforms and patterns: `SequenceTransformActions.svelte`

This is a new presentation of existing behavior. It does not create another
shortcut engine, command executor, popover, or transform owner.

## Verification

- Focused tests prove tap, chord, hold, release, and cancellation timing.
- Catalog tests prove custom/disabled bindings cannot produce stale keytips.
- Static checks cover shared state and Svelte integration.
- Browser verification covers the normal header, held-Alt header, explicit
  Shortcut Center launch, reduced motion, and the required responsive
  viewports.
