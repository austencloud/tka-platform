# Rename onBack → onClose Throughout Sequence Viewer

## Problem

The sequence viewer's close-viewer callback is named `onBack` / `handleBackInternal` everywhere — a leftover from when a "back" navigation concept existed. That concept was removed (no intermediate state to go back to), but the naming persists. Anyone reading the code assumes there's a navigation stack. There isn't.

## Scope

Rename across the sequence viewer module:

| Current | New |
|---|---|
| `onBack` (prop on Orchestrator) | `onClose` |
| `handleBackInternal` (orchestrator function) | `handleClose` |
| `onBack` (context object field) | `onClose` |
| `onBack` (prop on RouteViewerHeader) | `onClose` |
| `onBack` (prop on ViewerHeader) | `onClose` |

## Files Affected

1. `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` — prop type, destructuring, internal function name, context object field
2. `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` — prop pass-through
3. `src/lib/shared/sequence-viewer/components/ViewerHeader.svelte` — prop type and usage
4. `src/lib/shared/sequence-viewer/components/RouteViewerHeader.svelte` — prop type and usage
5. `src/routes/sequence/[id]/+page.svelte` — consumer of ViewerHeader/RouteViewerHeader

## Implementation

Pure mechanical rename. No behavioral changes. Search-and-replace with type verification via `npm run check`.

## Success Criteria

- Zero references to `onBack` or `handleBackInternal` remain in the sequence-viewer directory (except `onBackdropClick` / `onBackdropPointerDown` which are unrelated backdrop-dismiss handlers)
- `npm run check` passes with 0 errors
- Viewer opens and closes identically to before
