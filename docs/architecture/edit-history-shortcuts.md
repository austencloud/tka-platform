# App-wide Undo and Redo shortcuts

Ctrl+Z on Windows and Linux, or Command+Z on macOS, invokes Undo in the
active editor. Redo uses Ctrl+Shift+Z or Ctrl+Y on Windows and Linux, and
Command+Shift+Z on macOS.

## Surface contract

Place `data-undo-shortcut` and `data-redo-shortcut` on the native buttons that
already own an editor's history actions. Add `data-undo-shortcut-label` and
`data-redo-shortcut-label` when the editor can describe the pending change.
Those labels appear in Jump to as actions such as `Undo: Move clip`.

Use `EditHistoryShortcutBridge` when an editor has a history API but no visible
Undo or Redo buttons. The bridge preserves the existing callback as the only
action owner while making it available to the shared keyboard and command
systems.

Add `data-edit-history-shortcut-scope` to an independent or nested editor.
Keyboard focus inside that scope prevents Undo or Redo from falling through to
a sibling or parent history stack.

Native text editing wins. When focus is in a text input, text area, select, or
editable element, the app leaves Undo and Redo to the browser. Open native and
ARIA modal dialogs block page actions behind them. Disabled history targets
claim the shortcut without running an action.

The target resolver lives in
`src/lib/shared/keyboard/domain/edit-history-shortcut-target.ts`. The global
bindings are registered as `global.undo` and `global.redo`.
