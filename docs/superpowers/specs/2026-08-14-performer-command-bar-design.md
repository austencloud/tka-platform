# Performer Command Bar Upgrade

## Outcome

The ocean scene performer controls should stay readable and direct from a laptop through a wide 4K display. Selecting a performer must be stable, common actions must be visible, and dense editors must replace their contents with focused detail pages instead of adding horizontal or nested scrolling.

## Existing capability owners

- `PerformerHub`, `PerformerSpine`, and `PerformerHubDetail` remain the shell, scope selector, and shared control coordinator.
- `SequencePickerModal` remains the sequence library browser. The performer bar opens it and applies the result through `viewer.loadSequenceScoped`.
- The prop display registry remains the source of prop families, variants, names, and availability.
- `EffectsSettingsPanel`, the effect registry, `EffectPresetsSection`, and `EffectControlStack` remain the effect assignment and tuning owners.
- `PlanesPopover`, `EffortPalette`, and `PerformerPropSizeSlider` remain their current behavior owners.
- Viewer state remains in `viewer-3d-state` and performer state. The command bar does not introduce another reactive store.

## Interaction contract

### Performer scope

- Performer buttons always select their performer. Clicking the selected performer again keeps that performer selected.
- All Performers is entered only through the explicit All Performers button.
- The detail header always names the current scope and keeps the performer count or sequence summary visible.

### Shell and scale

- The desktop detail width is responsive: roughly 520px at normal desktop widths and up to 720px on wide displays.
- The shell uses an opaque high-contrast surface without backdrop blur. This reduces GPU composition work over the live scene and keeps controls legible over bright scenery.
- Component density responds to the panel's own width through container queries. The mobile performer sheet continues to use the same content at full width.
- Essential labels are at least 14px. Interactive targets are at least 44px on each axis.

### Tabs

- The bottom tab row remains the stable top-level information architecture.
- Only the active tab is in the normal keyboard Tab sequence. Left and right arrows move selection and focus between tabs.
- Tab labels use full words where space permits, including Sequence and Effects.

### Sequence

- The Sequence tab shows the active sequence, opens the canonical sequence picker, replaces the current sequence, and clears it.
- Choosing a sequence applies it to the selected performer through the viewer's scoped load path.

### Props

- The first page shows prop families with visible names and variant counts.
- A family with multiple variants opens a replacement detail page with a Back button. It does not expand an inline strip.
- The same family picker is shared with the existing prop popover so prop selection has one interaction owner.

### Effects

- The first page is a complete non-scrolling effect gallery plus a separate Scene Motion control.
- Choosing an effect applies it to the current performer scope and opens a replacement detail page for its presets and controls.
- The detail page has a Back button and an explicit Disable effect action.
- Developer tuning actions remain available in the full effects panel but are omitted from the performer command bar.

### Performer actions

- Remove Performer moves out of the Avatar tab into a visible header action.
- Removal uses the existing confirmation dialog and names the performer being removed.
- The action is absent in All Performers mode and disabled when only one performer remains.

### Avatar and effort selection

- Avatar and effort choices use radio-group keyboard behavior. Arrow keys move focus and selection.
- Effort choices show both the effort name and its existing short description.
- Avatar prewarming remains silent. A real selection failure produces user-facing feedback and does not apply a failed model.

## Structure

- Extract the avatar gallery into `PerformerAvatarPicker.svelte`.
- Extract the shared prop family and variant drill-down into `PropFamilyPicker.svelte`, then compose it in both performer prop surfaces.
- Keep `PerformerHubDetail.svelte` as the scope and tab coordinator.
- Extend `EffectsSettingsPanel.svelte` with a performer-hub presentation mode. Do not create another effects state or registry.

## Risks

- The shared performer detail also renders in the mobile sheet. Container-based rules and compact fallbacks must be verified there.
- Effect settings are partly performer-scoped and partly scene-global. Scene Motion remains visually separate, and global developer tuning actions do not appear in the performer bar.
- Avatar changes are asynchronous. Request identity checks must prevent an older load from replacing a newer choice.

## Verification

- Run focused package and Svelte checks after the refactor.
- Verify performer selection, All Performers entry, sequence choice, prop drill-down, effects drill-down, effort choice, avatar choice, and removal confirmation in the ocean scene.
- Inspect the panel at 1920, 2560, and 3840 widths, a 1440 desktop, an 820 tablet, and 960x412 and 375 mobile layouts.
- Re-run the module audit across Architecture, Code Quality, Accessibility, UX States, UI Consistency, Performance, and Security. Svelte compliance is no longer a scored audit dimension.
