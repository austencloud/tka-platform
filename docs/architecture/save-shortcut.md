# App-wide Save shortcut

Ctrl+S on Windows/Linux and Command+S on macOS invoke the existing Save action
for the active surface. The browser keeps its native shortcut on pages where the
app has no active Save surface.

## Surface contract

Place `data-save-shortcut` on the native button that already owns the visible
Save action. Do not create a second save handler for the shortcut. Reusing the
button keeps validation, progress, errors, analytics, and feedback identical for
keyboard and pointer input.

Use `data-save-shortcut-scope` on an independent inline editor when more than one
editor can appear on the page. Focus inside that scope prevents the shortcut from
falling through to another editor or a background Save action.

Open native dialogs and ARIA modal dialogs own the shortcut layer. A modal with no
Save target blocks background Save buttons. A disabled Save target still claims
the shortcut but is not clicked, which prevents the browser's Save Page dialog
from appearing during validation or an in-flight save.

Do not mark per-row bookmarks, downloads labelled Share, auto-save controls, or
actions that merely contain the word “saved.” Mark the authoritative commit
action for the current artifact, editor, form, or dialog.

The resolver and activation behavior live in
`src/lib/shared/keyboard/domain/save-shortcut-target.ts`. The customizable global
binding is registered as `global.save`.
