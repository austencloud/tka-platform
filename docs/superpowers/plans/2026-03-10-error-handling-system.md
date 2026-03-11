# Error Handling System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize error handling across the app with a two-tier system — modal for blocking errors (with guided bug reporting) and auto-reporting toasts for non-blocking errors — plus a Firestore telemetry pipeline and CLI access script.

**Architecture:** Errors route by severity: `error`/`critical` show the existing ErrorModal (upgraded with guided prompt), `warning` shows a new ErrorToast with auto-report to a separate `errorTelemetry` Firestore collection with deduplication. `info` shows a toast without reporting. The existing `showUserError()` API is unchanged; routing happens in the ErrorHandler implementation.

**Tech Stack:** Svelte 5 + TypeScript + Firebase Firestore + ITI DI

**Spec:** `docs/superpowers/specs/2026-03-10-error-handling-system-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/shared/error/services/contracts/IErrorTelemetryReporter.ts` | Interface for auto-reporting errors to Firestore |
| Create | `src/lib/shared/error/services/implementations/ErrorTelemetryReporter.ts` | Firestore writes with dedup logic |
| Create | `src/lib/shared/error/state/error-toast-state.svelte.ts` | Toast queue state with progress/pause/dismiss |
| Create | `src/lib/shared/error/components/ErrorToast.svelte` | Toast UI with progress bar, frosted glass, stacking |
| Modify | `src/lib/shared/error/components/ErrorModal.svelte` | Guided prompt upgrade |
| Modify | `src/lib/shared/application/services/contracts/IErrorHandler.ts` | Add telemetry reporter dependency |
| Modify | `src/lib/shared/application/services/implementations/ErrorHandler.ts` | Route by severity, integrate telemetry |
| Modify | `src/lib/shared/di/containers/core-container.ts` | Register ErrorTelemetryReporter |
| Modify | `src/lib/shared/di/container-types.ts` | Add telemetry type |
| Modify | `src/routes/+layout.svelte` or `MainApplication.svelte` | Mount ErrorToast component |
| Create | `scripts/error-telemetry.js` | CLI for querying telemetry |
| Modify | Tier 1-3 target files (12 files) | Add error boundaries |

---

## Chunk 1: Toast Infrastructure

### Task 1: Error Toast State

**Files:**
- Create: `src/lib/shared/error/state/error-toast-state.svelte.ts`

- [ ] **Step 1: Create the error toast state module**

This manages a queue of error toasts, separate from the existing toast system. Each toast has a progress timer that can be paused.

```typescript
/**
 * Error Toast State - Queue for non-blocking error notifications
 *
 * Separate from the general toast system because error toasts need:
 * progress bars, pause-on-hover, stacking compression, and auto-report integration.
 */

import type { ShowErrorOptions } from "../domain/error-models";

export interface ErrorToastItem {
  id: string;
  message: string;
  severity: "warning" | "info";
  duration: number;
  startedAt: number;
  remainingMs: number;
  paused: boolean;
  context?: ShowErrorOptions["context"];
}

const MAX_VISIBLE = 3;

let toasts = $state<ErrorToastItem[]>([]);
let idCounter = 0;

export function showErrorToast(options: ShowErrorOptions): string {
  const id = `etoast_${++idCounter}_${Date.now()}`;
  const duration = options.duration ?? 8000;

  const item: ErrorToastItem = {
    id,
    message: options.message,
    severity: (options.severity as "warning" | "info") ?? "warning",
    duration,
    startedAt: Date.now(),
    remainingMs: duration,
    paused: false,
    context: options.context,
  };

  toasts.push(item);

  scheduleAutoDismiss(id, duration);

  return id;
}

export function dismissErrorToast(id: string): void {
  const index = toasts.findIndex((t) => t.id === id);
  if (index !== -1) {
    toasts.splice(index, 1);
  }
}

export function pauseErrorToast(id: string): void {
  const item = toasts.find((t) => t.id === id);
  if (item && !item.paused) {
    item.paused = true;
    item.remainingMs = item.remainingMs - (Date.now() - item.startedAt);
  }
}

export function resumeErrorToast(id: string): void {
  const item = toasts.find((t) => t.id === id);
  if (item && item.paused) {
    item.paused = false;
    item.startedAt = Date.now();
    scheduleAutoDismiss(id, item.remainingMs);
  }
}

function scheduleAutoDismiss(id: string, ms: number): void {
  setTimeout(() => {
    const item = toasts.find((t) => t.id === id);
    if (item && !item.paused) {
      dismissErrorToast(id);
    }
  }, ms);
}

export function getErrorToasts(): ErrorToastItem[] {
  return toasts;
}

export function getVisibleErrorToasts(): ErrorToastItem[] {
  return toasts.slice(0, MAX_VISIBLE);
}

export function getOverflowCount(): number {
  return Math.max(0, toasts.length - MAX_VISIBLE);
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to error-toast-state

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/error/state/error-toast-state.svelte.ts
git commit -m "feat(error): add error toast state with pause/resume/stacking"
```

---

### Task 2: Error Telemetry Reporter

**Files:**
- Create: `src/lib/shared/error/services/contracts/IErrorTelemetryReporter.ts`
- Create: `src/lib/shared/error/services/implementations/ErrorTelemetryReporter.ts`

- [ ] **Step 1: Create the interface**

```typescript
/**
 * IErrorTelemetryReporter - Auto-reports non-blocking errors to Firestore
 *
 * When a user hits a non-critical error (thumbnail didn't load, audio didn't play),
 * we don't want to bother them with a form. Instead, the error is silently logged
 * to Firestore with deduplication so the developer can review patterns later.
 */

import type { ShowErrorOptions } from "$lib/shared/error/domain/error-models";

export interface IErrorTelemetryReporter {
  /**
   * Report an error to the telemetry collection.
   * Deduplicates by message + module + action — if the same error happened
   * recently, it increments the count instead of creating a new document.
   */
  report(options: ShowErrorOptions): Promise<void>;
}
```

- [ ] **Step 2: Create the implementation**

```typescript
/**
 * ErrorTelemetryReporter - Firestore-backed error telemetry with dedup
 *
 * Each unique error (keyed by message + module + action) gets one document.
 * Repeated occurrences within 24 hours increment the count instead of
 * creating duplicates. This keeps the collection small and queryable.
 */

import type { IErrorTelemetryReporter } from "../contracts/IErrorTelemetryReporter";
import type { ShowErrorOptions } from "$lib/shared/error/domain/error-models";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  increment,
  Timestamp,
} from "firebase/firestore";

export class ErrorTelemetryReporter implements IErrorTelemetryReporter {
  private readonly COLLECTION = "errorTelemetry";
  private readonly DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

  async report(options: ShowErrorOptions): Promise<void> {
    try {
      const db = getFirestore();
      const col = collection(db, this.COLLECTION);

      const module = options.context?.module ?? "unknown";
      const action = options.context?.action ?? "unknown";
      const dedupKey = `${options.message}::${module}::${action}`;

      // Check for existing document with same key
      const q = query(col, where("key", "==", dedupKey), where("resolved", "==", false));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const doc = snapshot.docs[0]!;
        const data = doc.data();
        const lastSeen = data.lastSeen?.toDate?.() ?? new Date(0);
        const windowStart = new Date(Date.now() - this.DEDUP_WINDOW_MS);

        if (lastSeen > windowStart) {
          // Same error within 24h — increment counter
          await updateDoc(doc.ref, {
            count: increment(1),
            lastSeen: serverTimestamp(),
            lastStack: options.error?.stack ?? null,
            lastAdditionalData: options.context?.additionalData ?? null,
          });
          return;
        }
      }

      // New error or outside dedup window — create document
      await addDoc(col, {
        key: dedupKey,
        message: options.message,
        technicalDetails: options.technicalDetails ?? options.error?.message ?? null,
        module,
        action,
        severity: options.severity ?? "warning",
        count: 1,
        firstSeen: serverTimestamp(),
        lastSeen: serverTimestamp(),
        lastStack: options.error?.stack ?? null,
        lastAdditionalData: options.context?.additionalData ?? null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
        resolved: false,
      });
    } catch (err) {
      // Telemetry should never break the app. Log and move on.
      console.error("Error telemetry failed:", err);
    }
  }
}
```

- [ ] **Step 3: Register in DI container**

In `src/lib/shared/di/containers/core-container.ts`, add the import and registration:

```typescript
import { ErrorTelemetryReporter } from "$lib/shared/error/services/implementations/ErrorTelemetryReporter";

// Add to the container chain:
.add({ errorTelemetryReporter: () => new ErrorTelemetryReporter() })
```

In `src/lib/shared/di/container-types.ts`, add the type so it's available via `container.items.errorTelemetryReporter`.

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/error/services/contracts/IErrorTelemetryReporter.ts \
  src/lib/shared/error/services/implementations/ErrorTelemetryReporter.ts \
  src/lib/shared/di/containers/core-container.ts \
  src/lib/shared/di/container-types.ts
git commit -m "feat(error): add ErrorTelemetryReporter with Firestore dedup"
```

---

### Task 3: Route Errors by Severity in ErrorHandler

**Files:**
- Modify: `src/lib/shared/application/services/implementations/ErrorHandler.ts`
- Modify: `src/lib/shared/application/services/contracts/IErrorHandler.ts`

- [ ] **Step 1: Update ErrorHandler.showUserError() to route by severity**

The key change: `warning` and `info` severity errors go to the toast, not the modal. `warning` also auto-reports to telemetry.

```typescript
// In ErrorHandler.ts, update showUserError():
showUserError(options: ShowErrorOptions): string {
  // Log internally regardless of tier
  if (options.error) {
    this.handleError(
      options.error,
      options.context?.action || options.context?.module
    );
  }

  const severity = options.severity ?? "error";

  if (severity === "warning" || severity === "info") {
    // Toast tier — non-blocking
    const { showErrorToast } = await import(
      "$lib/shared/error/state/error-toast-state.svelte"
    );
    // Can't use top-level await in a sync method, so use dynamic import
    // Actually, showUserError is sync and returns string. We need to handle this.
    // Solution: import at top level since this is a .ts file, not SSR-critical
  }
}
```

Actually, since `showUserError` is synchronous and returns a string ID, and the toast state is a simple module import, the cleaner approach:

Add a new import at the top of ErrorHandler.ts:

```typescript
import { showErrorToast } from "$lib/shared/error/state/error-toast-state.svelte";
```

Then update `showUserError`:

```typescript
showUserError(options: ShowErrorOptions): string {
  if (options.error) {
    this.handleError(
      options.error,
      options.context?.action || options.context?.module
    );
  }

  const severity = options.severity ?? "error";

  if (severity === "warning" || severity === "info") {
    // Toast tier — non-blocking notification
    const id = showErrorToast(options);

    // Auto-report warnings to telemetry (info is purely informational)
    if (severity === "warning") {
      this.reportToTelemetry(options);
    }

    return id;
  }

  // Modal tier — blocking, user can report bug
  return showErrorState(options);
}
```

Add the telemetry helper:

```typescript
private reportToTelemetry(options: ShowErrorOptions): void {
  // Fire-and-forget — telemetry should never block the UI
  import("$lib/shared/error/services/implementations/ErrorTelemetryReporter")
    .then(({ ErrorTelemetryReporter }) => {
      const reporter = new ErrorTelemetryReporter();
      reporter.report(options);
    })
    .catch((err) => console.error("Telemetry import failed:", err));
}
```

Wait — we have DI. But ErrorHandler doesn't receive container deps. It's instantiated directly: `errorHandler: () => new ErrorHandler()`. We could either:

A. Pass the reporter as a constructor dep
B. Use dynamic import (avoids circular deps, lazy-loads Firebase)

Option B is better because:
- ErrorTelemetryReporter imports Firebase, which is heavy
- The existing `reportBug()` method already uses dynamic import for the same reason
- Keeps ErrorHandler construction lightweight

So the `reportToTelemetry` method uses dynamic import, consistent with the existing `reportBug()` pattern.

- [ ] **Step 2: Update showWarning() to use toast tier**

The existing `showWarning()` method currently calls `showErrorState()` (modal). Update it to route through `showUserError()` so it gets the toast treatment:

```typescript
showWarning(message: string, context?: Partial<ErrorContext>): string {
  return this.showUserError({
    message,
    context,
    severity: "warning",
  });
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/application/services/implementations/ErrorHandler.ts
git commit -m "feat(error): route warnings to toast tier with auto-telemetry"
```

---

### Task 4: ErrorToast Component

**Files:**
- Create: `src/lib/shared/error/components/ErrorToast.svelte`

- [ ] **Step 1: Create the ErrorToast component**

This is a separate component from ToastContainer. It renders error-specific toasts with progress bars, frosted glass, and stacking.

Key visual features:
- Frosted glass with subtle amber tint for warnings
- Thin progress bar along bottom edge that depletes over duration
- Pause on hover (desktop) or tap (mobile)
- Slide-in from bottom-right (desktop), bottom-center (mobile)
- Max 3 visible, overflow shows "+N more" badge
- Small checkmark "logged" indicator for warnings
- `prefers-reduced-motion`: instant appear

The component should:
1. Import `getVisibleErrorToasts`, `getOverflowCount`, `pauseErrorToast`, `resumeErrorToast`, `dismissErrorToast` from the toast state
2. Use `$derived` to reactively read the toast queue
3. Render each visible toast with a progress bar `<div>` whose width is driven by a `requestAnimationFrame` loop (or CSS animation)
4. Use CSS custom properties from `--theme-*` for theming
5. Support swipe-to-dismiss on mobile via pointer events

Progress bar approach: Use a CSS animation (`@keyframes deplete`) with `animation-duration` set to the toast's remaining time. Pause the animation on hover by setting `animation-play-state: paused`.

- [ ] **Step 2: Mount in MainApplication.svelte**

Find where `ErrorModal` is mounted and add `ErrorToast` alongside it:

```svelte
<ErrorModal />
<ErrorToast />
```

Import it:
```typescript
import ErrorToast from "$lib/shared/error/components/ErrorToast.svelte";
```

- [ ] **Step 3: Verify no TypeScript errors and visual test**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Tell user: "The ErrorToast component is ready. To test it, open the browser console on localhost:5173 and run:
```js
// Import the toast state and fire a test warning
import('/$lib/shared/error/state/error-toast-state.svelte').then(m => m.showErrorToast({ message: 'Thumbnail didn\'t load', severity: 'warning', context: { module: 'browse', action: 'load-thumbnail' } }))
```
You should see a frosted amber toast slide in from the bottom-right with a progress bar."

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/error/components/ErrorToast.svelte
git commit -m "feat(error): add ErrorToast component with progress bar and stacking"
```

---

### Task 5: Upgrade ErrorModal with Guided Prompt

**Files:**
- Modify: `src/lib/shared/error/components/ErrorModal.svelte`

- [ ] **Step 1: Update the report section**

Change the placeholder and prompt text. Current (line 181-186):

```svelte
<div class="report-section">
  <p class="report-prompt">Help us fix this issue:</p>
  <textarea
    class="comment-input"
    placeholder="What were you doing when this happened? (optional)"
    bind:value={userComment}
    rows="2"
  ></textarea>
</div>
```

Replace with:

```svelte
<div class="report-section">
  <p class="report-prompt">What were you trying to do?</p>
  <textarea
    class="comment-input"
    placeholder="e.g. I was saving a 16-beat sequence and clicked Save..."
    bind:value={userComment}
    rows="2"
  ></textarea>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/error/components/ErrorModal.svelte
git commit -m "feat(error): guided prompt on ErrorModal bug report"
```

---

## Chunk 2: Error Boundary Rollout

### Task 6: Tier 1 — SequencePersister

**Files:**
- Modify: `src/lib/features/create/services/implementations/SequencePersister.ts` (or wherever save/load methods are)

- [ ] **Step 1: Find the save/load methods and wrap with error handling**

Read the file first. Find the `saveSequence`, `loadSequence`, and `updateSequence` methods. Wrap the Firestore operations in try/catch blocks that call `showUserError` with severity `"error"`.

Pattern for each method:

```typescript
try {
  // existing Firestore operation
} catch (error) {
  const errorHandler = container.items.errorHandler as IErrorHandler;
  errorHandler.showUserError({
    message: "Couldn't save your sequence",
    technicalDetails: error instanceof Error ? error.message : String(error),
    error: error instanceof Error ? error : new Error(String(error)),
    severity: "error",
    context: {
      module: "create",
      action: "save-sequence",
      additionalData: { /* relevant state like sequenceId, word */ },
    },
  });
  throw error; // Re-throw if callers need to handle it
}
```

**Decision on re-throw:** Check each call site. If the caller has its own error handling (try/catch, .catch), re-throw. If the caller doesn't handle errors, don't re-throw (the modal is the handling).

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add <modified files>
git commit -m "feat(error): add error boundary to SequencePersister"
```

---

### Task 7: Tier 1 — LibrarySaveService

**Files:**
- Modify: `src/lib/features/library/services/implementations/LibrarySaveService.ts`

- [ ] **Step 1: Read the file and identify save operations**

The design spec notes that thumbnail + tag creation fail silently today. Find those operations and wrap them.

For the main save: severity `"error"` (user is blocked).
For thumbnail/tag side effects: severity `"warning"` (save succeeded, but thumbnail didn't generate — non-blocking).

```typescript
// Main save failure — modal
errorHandler.showUserError({
  message: "Couldn't save to your library",
  severity: "error",
  context: { module: "library", action: "save-sequence" },
  ...
});

// Thumbnail failure — toast (auto-reports)
errorHandler.showUserError({
  message: "Sequence saved, but the thumbnail didn't generate",
  severity: "warning",
  context: { module: "library", action: "generate-thumbnail" },
  ...
});
```

- [ ] **Step 2: Verify typecheck**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(error): add error boundaries to LibrarySaveService"
```

---

### Task 8: Tier 1 — CameraManager

**Files:**
- Modify: `src/lib/features/train/services/implementations/CameraManager.ts` (find exact path)

- [ ] **Step 1: Read file, find camera access error handling**

Camera errors should distinguish between:
- Permission denied: "Camera access was denied. Check your browser permissions."
- Hardware not found: "No camera found on this device."
- In use: "Camera is being used by another app."
- Generic: "Couldn't access your camera."

All severity `"error"` — user can't continue training without camera.

- [ ] **Step 2: Verify typecheck**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(error): add error boundary to CameraManager"
```

---

### Task 9: Tier 1 — PublicSequencesLoader

**Files:**
- Modify: `src/lib/features/browse/services/implementations/PublicSequencesLoader.ts` (find exact path)

- [ ] **Step 1: Read file, find load/fetch methods**

When the browse gallery fails to load, the user sees a blank page. Wrap with:

```typescript
errorHandler.showUserError({
  message: "Couldn't load the gallery",
  severity: "error",
  context: { module: "browse", action: "load-gallery" },
  ...
});
```

- [ ] **Step 2: Verify typecheck**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(error): add error boundary to PublicSequencesLoader"
```

---

### Task 10: Tier 2 — FirebaseVideoUploader, CreateModuleEventHandler, PublicIndexSyncer, OptimizedBrowser

**Files:**
- Modify: 4 files (find exact paths by searching)

- [ ] **Step 1: Read each file, identify error-prone operations**

Apply the same pattern. All Tier 2 errors are severity `"error"` (data loss risk):

| File | Message | Action |
|------|---------|--------|
| FirebaseVideoUploader | "Couldn't upload your video" | upload-video |
| CreateModuleEventHandler | "Something went wrong adding that beat" | add-beat |
| PublicIndexSyncer | "Couldn't publish your sequence" | publish-sequence |
| OptimizedBrowser | "Couldn't load more results" | load-page |

- [ ] **Step 2: Verify typecheck across all changes**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(error): add error boundaries to Tier 2 targets"
```

---

### Task 11: Tier 3 — Toast-Level Errors

**Files:**
- Modify: `CloudThumbnailCache.ts`, `AudioLibraryService.ts`, `TimelinePlaybackService.ts`, `FirebaseMLStorageManager.ts`

- [ ] **Step 1: Read each file, find bare .catch() or silent failures**

Replace bare `.catch(() => {})` with `showUserError` at severity `"warning"`:

```typescript
// BEFORE
await operation().catch(() => {});

// AFTER
try {
  await operation();
} catch (error) {
  errorHandler.showUserError({
    message: "Thumbnail didn't load",
    severity: "warning",
    context: { module: "browse", action: "load-thumbnail" },
    error: error instanceof Error ? error : new Error(String(error)),
  });
}
```

These will auto-toast AND auto-report to telemetry.

**Exception:** `video.play().catch(() => {})` in video players should be LEFT ALONE. Browser autoplay policy rejections are expected and not errors.

- [ ] **Step 2: Verify typecheck**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(error): add warning-level error boundaries to Tier 3 targets"
```

---

## Chunk 3: Telemetry Script

### Task 12: Error Telemetry CLI Script

**Files:**
- Create: `scripts/error-telemetry.js`

- [ ] **Step 1: Create the script**

Uses Firebase Admin SDK (like `scripts/fetch-feedback.js`). Check that file for the Firebase init pattern and reuse it.

Subcommands:
- `list` — all unresolved errors sorted by count desc
- `recent` — errors from last 7 days
- `resolve <key>` — mark resolved
- `stats` — summary

```bash
node scripts/error-telemetry.js list
node scripts/error-telemetry.js recent
node scripts/error-telemetry.js resolve "Thumbnail didn't load::browse::load-thumbnail"
node scripts/error-telemetry.js stats
```

Output format (for `list`):
```
  # │ Count │ Last Seen   │ Module  │ Message
  1 │    47 │ 2h ago      │ browse  │ Thumbnail didn't load
  2 │    12 │ 1d ago      │ library │ Sequence saved, but the thumbnail didn't generate
  3 │     3 │ 5d ago      │ train   │ Playback audio didn't start
```

- [ ] **Step 2: Test locally**

Run: `node scripts/error-telemetry.js stats`
Expected: Either shows stats or "No telemetry data yet" (collection doesn't exist until first error is reported).

- [ ] **Step 3: Commit**

```bash
git add scripts/error-telemetry.js
git commit -m "feat(error): add error-telemetry CLI script"
```

---

## Chunk 4: Final Verification

### Task 13: Full Typecheck and Build

- [ ] **Step 1: Run full typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual verification instructions**

Tell user to verify:
1. Trigger a sequence generation error (disconnect network, try generating) — should see ErrorModal with guided "What were you trying to do?" prompt
2. Open browser console, run a test warning toast — should see amber frosted toast with progress bar
3. Check Firestore console for `errorTelemetry` collection after a warning fires
4. Run `node scripts/error-telemetry.js list` to see the telemetry entry

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git commit -m "chore(error): cleanup and verification"
```
