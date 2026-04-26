# Error Handling System Design

**Date:** 2026-03-10
**Status:** Approved

## Problem

The app has a well-built error handling infrastructure (ErrorHandler -> ErrorModal -> Firestore feedback pipeline) but only 3 files use it. 12 identified candidates have no error UI. Users encounter silent failures, blank screens, and generic console errors with no way to report what happened.

## Design Decisions

1. **Two-tier error UX** (modal for blocking, toast for non-blocking)
2. **Auto-report for toast tier** (silent telemetry, no user action)
3. **Separate `errorTelemetry` Firestore collection** with deduplication
4. **Script-only telemetry access** (no in-app dashboard)
5. **Guided prompt on modal tier** ("What were you trying to do?")

## Architecture

### Tier Routing

Severity determines which tier handles the error:

| Severity | Tier | Behavior |
|----------|------|----------|
| `"error"`, `"critical"` | Modal | Blocks UI. User can add comment, click "Report Bug" -> feedback collection |
| `"warning"` | Toast | Non-blocking. Auto-reports to `errorTelemetry` collection silently |
| `"info"` | Toast | Non-blocking. No report. Purely informational |

The existing `showUserError()` API is unchanged. Callers already set `severity`. The routing happens inside the error state layer.

### Toast Tier UX

**Not a red alert box.** The app noticed something broke, handled it, and told you in passing.

- Slides in from bottom-right (desktop) or bottom-center (mobile)
- Frosted glass with subtle amber tint (warning) via `--theme-*` variables
- Thin progress bar along bottom edge depletes over ~8s, showing when it'll vanish
- Hover/tap pauses the timer. Swipe to dismiss early
- Stacks vertically, max 3 visible, older compress to "+N more" badge
- Small "logged" indicator (checkmark icon) confirming it was captured
- No "we've been notified" language (solo dev, no support team)
- `prefers-reduced-motion`: instant appear, no slide

### Modal Tier Upgrades

The existing ErrorModal gets one change:

- **Guided prompt:** Replace the current placeholder "What were you doing when this happened? (optional)" with "What were you trying to do?" as the textarea placeholder. Pre-populate the report section text to guide useful responses.

### Auto-Report (Toast Tier)

When a warning-severity error shows as a toast, the system simultaneously:

1. Fires a background write to `errorTelemetry` collection
2. Deduplicates: key = `${errorMessage}::${module}::${action}`
3. If key exists and last occurrence < 24h ago: increment `count`, update `lastSeen`
4. If key doesn't exist or older than 24h: create new document

### Telemetry Document Shape

```typescript
interface ErrorTelemetryDoc {
  key: string;                    // dedup key
  message: string;                // user-facing error message
  technicalDetails?: string;      // technical error info
  module: string;                 // which module
  action: string;                 // what was attempted
  severity: "warning";            // always warning for toast tier
  count: number;                  // occurrence count
  firstSeen: Timestamp;           // first occurrence
  lastSeen: Timestamp;            // most recent occurrence
  lastStack?: string;             // most recent stack trace
  lastAdditionalData?: object;    // most recent context
  userAgent: string;              // browser info
  resolved: boolean;              // manually marked resolved
}
```

### Telemetry Script

`node scripts/error-telemetry.js` with subcommands:

- `list` - show all unresolved errors, sorted by count descending
- `recent` - show errors from last 7 days
- `resolve <key>` - mark an error as resolved
- `stats` - summary: total unique errors, total occurrences, top 5 by count

### New Files

| File | Purpose |
|------|---------|
| `src/lib/shared/error/services/contracts/IErrorTelemetryReporter.ts` | Interface for auto-reporting |
| `src/lib/shared/error/services/implementations/ErrorTelemetryReporter.ts` | Firestore writes with dedup |
| `src/lib/shared/error/components/ErrorToast.svelte` | New toast component (not the existing ToastContainer) |
| `src/lib/shared/error/state/error-toast-state.svelte.ts` | Toast-specific state (queue, dismiss, progress) |
| `scripts/error-telemetry.js` | CLI access to telemetry data |

### Why a Separate Toast Component

The existing `ToastContainer.svelte` is a simple notification system (success/info messages). The error toast needs:
- Progress bar with pause-on-hover
- "Logged" indicator
- Stacking with "+N more" compression
- Different visual treatment (frosted glass, amber tint)
- Swipe-to-dismiss

Bolting this onto the existing toast would overcomplicate a simple system. Separate component, separate state.

### Integration Points

The `ErrorHandler.showUserError()` method currently calls `showErrorState()` which sets `currentError` and the ErrorModal renders it. For toast-tier errors:

1. `ErrorHandler.showUserError()` checks severity
2. If `"warning"`: calls `showErrorToast()` instead of `showErrorState()`, also calls `errorTelemetryReporter.report()`
3. If `"error"` or `"critical"`: calls `showErrorState()` as before (modal)
4. If `"info"`: calls `showErrorToast()` without auto-report

### Rollout Targets

#### Tier 1: User Blocked (Modal)

| File | Operation | Message |
|------|-----------|---------|
| `SequencePersister.ts` | Save/load/update | "Couldn't save your sequence" |
| `LibrarySaveService.ts` | Save to library | "Couldn't save to your library" |
| `CameraManager.ts` | Camera access | "Couldn't access your camera" |
| `PublicSequencesLoader.ts` | Browse gallery | "Couldn't load the gallery" |

#### Tier 2: Data Loss Risk (Modal)

| File | Operation | Message |
|------|-----------|---------|
| `FirebaseVideoUploader.ts` | Upload video | "Couldn't upload your video" |
| `CreateModuleEventHandler.ts` | Beat calculation | "Something went wrong adding that beat" |
| `PublicIndexSyncer.ts` | Publish to gallery | "Couldn't publish your sequence" |
| `OptimizedBrowser.ts` | Gallery pagination | "Couldn't load more results" |

#### Tier 3: Non-Blocking (Toast with auto-report)

| File | Operation | Message |
|------|-----------|---------|
| `CloudThumbnailCache.ts` | Thumbnail download | "Thumbnail didn't load" |
| `AudioLibraryService.ts` | Audio operations | "Audio track couldn't be loaded" |
| `TimelinePlaybackService.ts` | Playback | "Playback audio didn't start" |
| `FirebaseMLStorageManager.ts` | ML upload | "Training data upload failed" |

## Out of Scope

- In-app telemetry dashboard (script-only for now)
- Global error boundary component (Svelte doesn't have React-style error boundaries; try/catch at operation sites is the right pattern)
- Retry logic (add per-operation when proven needed, not as infrastructure)
