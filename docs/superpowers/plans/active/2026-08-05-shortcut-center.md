# Shortcut Center Implementation

**Spec:** `docs/superpowers/specs/active/2026-08-05-shortcut-center-design.md`

## 1. Lock the domain contracts

- Add a versioned shortcut-settings codec that accepts the existing payload.
- Add atomic binding updates to `keyboardShortcutState`.
- Extend `ShortcutRegistry` with subscriptions.
- Extend `ShortcutCustomizer` with full conflict queries, Replace, and Swap.
- Add focused unit tests before UI integration.

## 2. Build the catalog

- Add the pure search and grouping module.
- Derive contexts from registered commands.
- Index effective and default bindings.
- Implement This area, All, and Changed filters.
- Test every filtering and grouping rule.

## 3. Build one surface

- Add `ShortcutCenter.svelte` on `BaseModal`.
- Rework `ShortcutRow` into sibling edit/reset actions.
- Add `ShortcutBindingEditor.svelte` with dispatcher suppression while recording.
- Rework `ConflictWarning` to show every conflict and wire Replace and Swap.
- Reuse `PanelSearch`, `SegmentedControl`, `ModalHeader`, and
  `KeyboardKeyDisplay`.

## 4. Route entry points

- Replace the MainInterface help host with Shortcut Center.
- Change `?` to open the center in place.
- Keep the command palette help action pointed at the same state.
- Add the visible Shortcut Center launcher to Settings > Preferences.
- Put the visible command-palette trigger in Support's desktop footer slot and
  move Support into the account popover.
- Present the footer trigger as a quiet `Jump to` utility without a permanent
  shortcut badge or selected-state accent.
- Rebuild Jump to on the shared modal and search primitives with one centered
  position for every launch method.
- Replace the module dump with accessible module-and-tab destinations, Recent,
  Often used, and Actions here.
- Record successful ordinary navigation in a versioned, device-local visit
  history scoped to the active identity.
- Keep command registration synchronized with the reactive navigation list.
- Remove the Keyboard Settings import, render branch, tab definition, ordering,
  and touch-device filter.
- Migrate stale Settings keyboard state to Profile while opening the center.

## 5. Delete duplicates

- Remove `ShortcutsHelp.svelte`.
- Remove `KeyboardShortcutsTab.svelte`.
- Remove `ShortcutContextSection.svelte`.
- Remove `ShortcutKeyCapture.svelte`.
- Confirm there are no remaining imports or user-facing references to the old
  Settings destination.

## 6. Verify

- Run the focused keyboard tests with the repository Vitest config.
- Run the machine-safe type-check gate, followed by one full check when resource
  gates allow it.
- Reuse `https://localhost:5173` and the shared Chrome debug process.
- Prove open, search, edit, conflict, replace, swap, disable, reset, reload, and
  dynamic registration behavior.
- Capture and inspect every required viewport.
- Clear browser emulation and close only the task-owned tab.
