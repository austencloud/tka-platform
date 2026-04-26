# Feedback Image Pre-Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload feedback images to Firebase Storage as soon as they're attached, so submit is instant.

**Architecture:** New `ImageStager` service uploads images to a `feedback-staging/{userId}/` path using `uploadBytesResumable()`. A parallel `stagedImages` Map in the submit state tracks per-file upload progress. On submit, already-uploaded URLs are written directly to the feedback doc — no upload wait. A scheduled Cloud Function cleans up orphaned staged files older than 30 minutes.

**Tech Stack:** Firebase Storage (resumable uploads), Cloud Functions (scheduled cleanup), Svelte 5 runes (reactive state)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/features/feedback/services/contracts/IImageStager.ts` | Interface for staging service |
| Create | `src/lib/features/feedback/services/implementations/ImageStager.ts` | Upload, cancel, delete staged images |
| Modify | `src/lib/features/feedback/domain/models/feedback-models.ts` | Add `StagedImageState` type |
| Modify | `src/lib/features/feedback/state/feedback-submit-state.svelte.ts` | Add `stagedImages` map, auto-upload effect, modified submit |
| Modify | `src/lib/features/feedback/components/submit/ImageUpload.svelte` | Per-image progress overlay on thumbnails |
| Modify | `src/lib/features/feedback/services/implementations/FeedbackSubmitter.ts` | Accept pre-uploaded URLs, skip upload when available |
| Modify | `src/lib/features/feedback/services/contracts/IFeedbackSubmissionService.ts` | Add `preUploadedImageUrls` parameter |
| Modify | `src/lib/features/feedback/services/contracts/IFeedbackService.ts` | Same parameter through facade |
| Modify | `src/lib/features/feedback/services/implementations/FeedbackRepository.ts` | Pass through parameter |
| Modify | `storage.rules` | Add rule for `feedback-staging/{userId}/` path |
| Create | `firebase-functions/src/cleanupStagedUploads.ts` | Scheduled cleanup function |
| Modify | `firebase-functions/src/index.ts` | Export new function |

---

### Task 1: Domain Types

**Files:**
- Modify: `src/lib/features/feedback/domain/models/feedback-models.ts`

- [ ] **Step 1: Add StagedImageState type**

Add after the existing `FeedbackUploadProgress` type:

```typescript
/**
 * Per-image staging state. Tracks an individual image's upload to the
 * staging area, from the moment it's attached until submit or removal.
 */
export interface StagedImageState {
  status: "uploading" | "uploaded" | "failed";
  /** 0-1 upload progress fraction */
  fraction: number;
  /** Firebase Storage download URL, available once status is "uploaded" */
  downloadUrl?: string;
  /** Storage path for cancellation or deletion */
  storagePath: string;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/feedback/domain/models/feedback-models.ts
git commit -m "feat(feedback): add StagedImageState type for pre-upload tracking"
```

---

### Task 2: ImageStager Service

**Files:**
- Create: `src/lib/features/feedback/services/contracts/IImageStager.ts`
- Create: `src/lib/features/feedback/services/implementations/ImageStager.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/features/feedback/services/contracts/IImageStager.ts

import type { StagedImageState } from "../../domain/models/feedback-models";

/**
 * Callback invoked as a staged image upload progresses.
 */
export type StagedProgressCallback = (state: StagedImageState) => void;

/**
 * Handle returned from stageImage() for cancellation.
 */
export interface StagedUploadHandle {
  /** Resolves with the download URL on success, rejects on failure */
  promise: Promise<string>;
  /** Cancel the in-flight upload */
  cancel: () => void;
  /** The storage path (for deletion after upload completes) */
  storagePath: string;
}

export interface IImageStager {
  /**
   * Start uploading an image to the staging area immediately.
   * Returns a handle with a promise, cancel function, and storage path.
   */
  stageImage(
    file: File,
    userId: string,
    onProgress: StagedProgressCallback
  ): StagedUploadHandle;

  /**
   * Delete a staged image from storage (used on image removal or cleanup).
   */
  deleteStaged(storagePath: string): Promise<void>;
}
```

- [ ] **Step 2: Create the implementation**

```typescript
// src/lib/features/feedback/services/implementations/ImageStager.ts

import { getStorageInstance } from "$lib/shared/auth/firebase";
import type { StagedImageState } from "../../domain/models/feedback-models";
import type {
  IImageStager,
  StagedUploadHandle,
  StagedProgressCallback,
} from "../contracts/IImageStager";

export class ImageStager implements IImageStager {
  stageImage(
    file: File,
    userId: string,
    onProgress: StagedProgressCallback
  ): StagedUploadHandle {
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `feedback-staging/${userId}/${timestamp}_${sanitizedFilename}`;

    // Track whether cancelled so we can skip getDownloadURL after upload
    let cancelled = false;
    let uploadTask: import("firebase/storage").UploadTask | null = null;

    const promise = new Promise<string>(async (resolve, reject) => {
      try {
        const { ref, uploadBytesResumable, getDownloadURL, deleteObject } =
          await import("firebase/storage");
        const storage = await getStorageInstance();
        const storageRef = ref(storage, storagePath);

        uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            if (cancelled) return;
            onProgress({
              status: "uploading",
              fraction: snapshot.bytesTransferred / snapshot.totalBytes,
              storagePath,
            });
          },
          (error) => {
            if (cancelled) return;
            onProgress({ status: "failed", fraction: 0, storagePath });
            reject(error);
          },
          async () => {
            if (cancelled) {
              // Upload completed but we were cancelled — clean up
              try { await deleteObject(storageRef); } catch { /* best effort */ }
              reject(new Error("Upload cancelled"));
              return;
            }
            try {
              const downloadUrl = await getDownloadURL(storageRef);
              onProgress({
                status: "uploaded",
                fraction: 1,
                downloadUrl,
                storagePath,
              });
              resolve(downloadUrl);
            } catch (error) {
              onProgress({ status: "failed", fraction: 0, storagePath });
              reject(error);
            }
          }
        );
      } catch (error) {
        onProgress({ status: "failed", fraction: 0, storagePath });
        reject(error);
      }
    });

    return {
      promise,
      cancel: () => {
        cancelled = true;
        uploadTask?.cancel();
      },
      storagePath,
    };
  }

  async deleteStaged(storagePath: string): Promise<void> {
    try {
      const { ref, deleteObject } = await import("firebase/storage");
      const storage = await getStorageInstance();
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (error) {
      // Best effort — file may already be gone or never fully uploaded
      console.warn("[ImageStager] Failed to delete staged file:", storagePath, error);
    }
  }
}

export const imageStager = new ImageStager();
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/feedback/services/contracts/IImageStager.ts src/lib/features/feedback/services/implementations/ImageStager.ts
git commit -m "feat(feedback): add ImageStager service for pre-upload to staging area"
```

---

### Task 3: Storage Rules

**Files:**
- Modify: `storage.rules`

- [ ] **Step 1: Add staging path rule**

Add after the existing `feedback/{userId}/{feedbackId}/` rule block (around line 33):

```
    // Feedback staging - temporary uploads before feedback submission
    // Cleaned up by scheduled Cloud Function after 30 minutes
    match /feedback-staging/{userId}/{allPaths=**} {
      // Only the owner can read/write their staged uploads
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
```

- [ ] **Step 2: Commit**

```bash
git add storage.rules
git commit -m "feat(feedback): add storage rule for feedback-staging path"
```

---

### Task 4: Wire Pre-Upload into Submit State

**Files:**
- Modify: `src/lib/features/feedback/state/feedback-submit-state.svelte.ts`

This is the core task. The submit state gets a `stagedImages` map that tracks each File's upload state. An `$effect` watches the `images` array and auto-starts uploads for new files. On submit, if all images are uploaded, their URLs are passed directly to the service.

- [ ] **Step 1: Add imports and staging state**

Add import for `StagedImageState`:
```typescript
import type {
  FeedbackFormData,
  FeedbackFormErrors,
  FeedbackSubmitStatus,
  FeedbackType,
  FeedbackUploadProgress,
  StagedImageState,
} from "../domain/models/feedback-models";
```

Add import for the stager:
```typescript
import { imageStager } from "../services/implementations/ImageStager";
import type { StagedUploadHandle } from "../services/contracts/IImageStager";
```

Inside `createFeedbackSubmitState()`, add after the `uploadProgress` declaration:

```typescript
  // Per-image staging state — tracks upload progress for each attached image
  let stagedImages = $state<Map<File, StagedImageState>>(new Map());

  // Active upload handles for cancellation on removal
  const uploadHandles = new Map<File, StagedUploadHandle>();
```

- [ ] **Step 2: Add the auto-upload effect**

Add after the existing derived state:

```typescript
  // Auto-stage images as soon as they're attached.
  // Compares current images to what we're already tracking and starts
  // uploads for any new files.
  $effect(() => {
    // Snapshot current images for comparison
    const currentFiles = new Set(images);
    const trackedFiles = new Set(stagedImages.keys());

    // Start uploads for newly added files
    for (const file of currentFiles) {
      if (!trackedFiles.has(file)) {
        startStagingUpload(file);
      }
    }

    // Cancel and clean up removed files
    for (const file of trackedFiles) {
      if (!currentFiles.has(file)) {
        cancelAndCleanup(file);
      }
    }
  });
```

- [ ] **Step 3: Add staging helper functions**

Add before the `return` statement:

```typescript
  function startStagingUpload(file: File) {
    // Need userId for the staging path
    const userId = getUserId();
    if (!userId) return;

    const handle = imageStager.stageImage(file, userId, (state) => {
      // Create a new Map to trigger Svelte reactivity
      const next = new Map(stagedImages);
      next.set(file, state);
      stagedImages = next;
    });

    uploadHandles.set(file, handle);

    // Initialize state immediately
    const next = new Map(stagedImages);
    next.set(file, { status: "uploading", fraction: 0, storagePath: handle.storagePath });
    stagedImages = next;

    // Handle completion/failure (fire and forget — state is updated via callback)
    handle.promise.catch(() => {
      // Error state already set via the onProgress callback
    });
  }

  function cancelAndCleanup(file: File) {
    const handle = uploadHandles.get(file);
    if (handle) {
      handle.cancel();
      uploadHandles.delete(file);
    }

    const state = stagedImages.get(file);
    if (state?.status === "uploaded" && state.storagePath) {
      // Already uploaded — delete from staging
      imageStager.deleteStaged(state.storagePath);
    }

    const next = new Map(stagedImages);
    next.delete(file);
    stagedImages = next;
  }

  function getUserId(): string | null {
    return authState.user?.uid ?? null;
  }
```

**Note:** `authState` is already used by `FeedbackSubmitter.ts` in the same module. Import it at the top of the file:
```typescript
import { authState } from "$lib/shared/auth/state/authState.svelte";
```

- [ ] **Step 4: Modify submit() to use pre-uploaded URLs**

Replace the existing `submit()` function body with logic that checks if all images are already staged:

```typescript
  async function submit(): Promise<boolean> {
    if (!validate()) {
      return false;
    }

    // If images are still uploading, wait for them (with a timeout)
    if (images.length > 0) {
      const pendingHandles = images
        .map((f) => uploadHandles.get(f))
        .filter((h): h is StagedUploadHandle => h != null);

      if (pendingHandles.length > 0) {
        submitStatus = "submitting";
        uploadProgress = { phase: "uploading", fraction: 0 };

        try {
          // Wait for all pending uploads to complete (they're already in flight)
          await Promise.all(pendingHandles.map((h) => h.promise));
        } catch {
          // Some uploads failed — check which ones
          const failed = images.filter((f) => stagedImages.get(f)?.status === "failed");
          if (failed.length > 0) {
            uploadProgress = null;
            submitStatus = "error";
            return false;
          }
        }
      }
    }

    submitStatus = "submitting";
    uploadProgress = null;

    try {
      const capturedModule = getCapturedModule();
      const capturedTab = getCapturedTab();

      // Collect pre-uploaded URLs from staged images
      const preUploadedUrls = images
        .map((f) => stagedImages.get(f)?.downloadUrl)
        .filter((url): url is string => url != null);

      // If all images are pre-uploaded, pass URLs directly (no upload needed)
      // Otherwise fall back to uploading during submit
      const hasAllUrls = preUploadedUrls.length === images.length;

      await feedbackService.submitFeedback(
        formData,
        capturedModule,
        capturedTab,
        hasAllUrls ? undefined : (images.length > 0 ? images : undefined),
        (progress) => { uploadProgress = progress; },
        hasAllUrls ? preUploadedUrls : undefined
      );

      uploadProgress = null;
      submitStatus = "success";
      return true;
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      uploadProgress = null;
      submitStatus = "error";
      return false;
    }
  }
```

- [ ] **Step 5: Update reset() to clean up staged images**

```typescript
  function reset() {
    // Cancel any in-flight uploads and delete staged files
    for (const file of uploadHandles.keys()) {
      cancelAndCleanup(file);
    }

    formData = {
      type: "general",
      title: "",
      description: "",
    };
    images = [];
    formErrors = {};
    submitStatus = "idle";
    uploadProgress = null;
    stagedImages = new Map();
  }
```

- [ ] **Step 6: Expose stagedImages in the return object**

Add to the return object:

```typescript
    get stagedImages() {
      return stagedImages;
    },
```

- [ ] **Step 7: Verify build**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/feedback/state/feedback-submit-state.svelte.ts
git commit -m "feat(feedback): auto-stage images on attach with reactive progress tracking"
```

---

### Task 5: Update Service Layer for Pre-Uploaded URLs

**Files:**
- Modify: `src/lib/features/feedback/services/contracts/IFeedbackSubmissionService.ts`
- Modify: `src/lib/features/feedback/services/contracts/IFeedbackService.ts`
- Modify: `src/lib/features/feedback/services/implementations/FeedbackRepository.ts`
- Modify: `src/lib/features/feedback/services/implementations/FeedbackSubmitter.ts`

- [ ] **Step 1: Update IFeedbackSubmissionService**

Add `preUploadedImageUrls?: string[]` parameter:

```typescript
  submitFeedback(
    formData: FeedbackFormData,
    capturedModule: string,
    capturedTab: string,
    images?: File[],
    onProgress?: FeedbackProgressCallback,
    preUploadedImageUrls?: string[]
  ): Promise<string>;
```

- [ ] **Step 2: Update IFeedbackService with same parameter**

Same change in the facade interface.

- [ ] **Step 3: Update FeedbackRepository to pass through**

Add parameter to `submitFeedback()` and forward to `this.submissionService.submitFeedback(...)`.

- [ ] **Step 4: Update FeedbackSubmitter**

In `submitFeedback()`, after creating the doc, check for pre-uploaded URLs first:

```typescript
    // Use pre-uploaded URLs if available (from staging), otherwise upload now
    if (preUploadedImageUrls && preUploadedImageUrls.length > 0) {
      try {
        await updateDoc(docRef, { imageUrls: preUploadedImageUrls });
      } catch (error) {
        console.error("[FeedbackSubmitter] Failed to attach pre-uploaded image URLs:", error);
        toast.warning("Feedback submitted but images may not be attached.");
      }
    } else if (images && images.length > 0) {
      // Existing upload-on-submit path (fallback)
      onProgress?.({ phase: "uploading", fraction: 0 });
      try {
        const imageUrls = await this.uploadImagesWithProgress(
          images, docRef.id, effectiveUser.uid, onProgress
        );
        await updateDoc(docRef, { imageUrls });
      } catch (error) {
        console.error("[FeedbackSubmitter] Failed to upload images:", error);
        toast.warning("Feedback submitted but some images failed to upload.");
      }
    }
```

- [ ] **Step 5: Verify build**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/feedback/services/
git commit -m "feat(feedback): accept pre-uploaded image URLs to skip upload on submit"
```

---

### Task 6: Per-Image Progress Overlay in ImageUpload

**Files:**
- Modify: `src/lib/features/feedback/components/submit/ImageUpload.svelte`

- [ ] **Step 1: Add stagedImages prop**

```typescript
const {
  images = $bindable([]),
  maxImages = 5,
  disabled = false,
  stagedImages = new Map(),
} = $props<{
  images?: File[];
  maxImages?: number;
  disabled?: boolean;
  stagedImages?: Map<File, import("../../domain/models/feedback-models").StagedImageState>;
}>();
```

- [ ] **Step 2: Update preview item template**

Wrap each `.preview-item` with a progress overlay. The overlay is a semi-transparent layer with a circular progress ring or a simple horizontal bar at the bottom of the thumbnail:

```svelte
{#each previews as { file, url }, index}
  {@const staged = stagedImages.get(file)}
  <div class="preview-item">
    <img src={url} alt={file.name} />

    <!-- Upload progress overlay -->
    {#if staged?.status === "uploading"}
      <div class="upload-overlay" aria-label="Uploading {Math.round((staged.fraction ?? 0) * 100)}%">
        <div class="upload-progress-bar" style:--progress="{(staged.fraction ?? 0) * 100}%"></div>
        <span class="upload-pct">{Math.round((staged.fraction ?? 0) * 100)}%</span>
      </div>
    {:else if staged?.status === "failed"}
      <div class="upload-overlay failed" aria-label="Upload failed">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <span class="upload-failed-text">Failed</span>
      </div>
    {:else if staged?.status === "uploaded"}
      <div class="upload-complete" aria-label="Upload complete">
        <i class="fas fa-check-circle" aria-hidden="true"></i>
      </div>
    {/if}

    <button
      type="button"
      class="remove-btn"
      onclick={() => removeImage(index)}
      disabled={disabled}
      aria-label="Remove {file.name}"
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
    <div class="preview-name">{file.name}</div>
  </div>
{/each}
```

- [ ] **Step 3: Add CSS for the overlay**

```css
/* Semi-transparent overlay during upload */
.upload-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  border-radius: inherit;
  gap: 4px;
}

.upload-overlay.failed {
  background: rgba(239, 68, 68, 0.4);
}

.upload-overlay .fa-exclamation-triangle {
  font-size: 1.25rem;
  color: var(--semantic-error);
}

.upload-failed-text {
  font-size: var(--font-size-compact, 12px);
  color: white;
  font-weight: 600;
}

/* Horizontal progress bar at bottom of thumbnail */
.upload-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 0 0 8px 8px;
  overflow: hidden;
}

.upload-progress-bar::after {
  content: "";
  display: block;
  height: 100%;
  width: var(--progress);
  background: var(--semantic-success, #22c55e);
  transition: width 200ms ease-out;
}

.upload-pct {
  font-size: var(--font-size-compact, 12px);
  color: white;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

/* Green checkmark badge for completed uploads */
.upload-complete {
  position: absolute;
  top: 6px;
  left: 6px;
  color: var(--semantic-success, #22c55e);
  font-size: 1rem;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

@media (prefers-reduced-motion: reduce) {
  .upload-progress-bar::after {
    transition: none;
  }
}
```

- [ ] **Step 4: Pass stagedImages through FeedbackTextarea to ImageUpload**

**`FeedbackTextarea.svelte`** — add `stagedImages` to the props interface:

```typescript
// Add to the $props destructure:
stagedImages = new Map(),

// Add to the type:
stagedImages?: Map<File, import("../../domain/models/feedback-models").StagedImageState>;
```

Then pass it to `ImageUpload`:
```svelte
<ImageUpload bind:images {disabled} {stagedImages} />
```

**`FeedbackForm.svelte`** — pass `stagedImages` to `FeedbackTextarea`:
```svelte
<FeedbackTextarea
  ...existing props...
  stagedImages={formState.stagedImages}
/>
```

- [ ] **Step 5: Verify build**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/feedback/components/
git commit -m "feat(feedback): add per-image upload progress overlay on thumbnails"
```

---

### Task 7: Cloud Function for Orphan Cleanup

**Files:**
- Create: `firebase-functions/src/cleanupStagedUploads.ts`
- Modify: `firebase-functions/src/index.ts`

- [ ] **Step 1: Create the cleanup function**

```typescript
// firebase-functions/src/cleanupStagedUploads.ts

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const STAGING_PREFIX = "feedback-staging/";
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Runs every 30 minutes. Lists all files under feedback-staging/
 * and deletes any older than 30 minutes.
 *
 * This is a safety net — the client cleans up on image removal,
 * but if the user closes the browser mid-upload or never submits,
 * orphaned files would accumulate without this.
 */
export const cleanupStagedUploads = functions.pubsub
  .schedule("every 30 minutes")
  .onRun(async () => {
    const bucket = admin.storage().bucket();
    const cutoff = Date.now() - MAX_AGE_MS;

    const [files] = await bucket.getFiles({ prefix: STAGING_PREFIX });

    let deletedCount = 0;
    for (const file of files) {
      const metadata = file.metadata;
      const created = new Date(metadata.timeCreated).getTime();

      if (created < cutoff) {
        await file.delete();
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[cleanupStagedUploads] Deleted ${deletedCount} orphaned staged uploads`);
    }

    return null;
  });
```

- [ ] **Step 2: Export from index.ts**

Add to `firebase-functions/src/index.ts`:

```typescript
// Export staged upload cleanup (orphan prevention)
export { cleanupStagedUploads } from "./cleanupStagedUploads";
```

- [ ] **Step 3: Verify functions build**

Run: `cd firebase-functions && npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add firebase-functions/src/cleanupStagedUploads.ts firebase-functions/src/index.ts
git commit -m "feat(feedback): add scheduled Cloud Function to clean up orphaned staged uploads"
```

---

### Task 8: Integration Verification

- [ ] **Step 1: Full type check**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 2: Functions build check**

Run: `cd firebase-functions && npm run build`
Expected: No errors

- [ ] **Step 3: Manual verification checklist**

Ask the user to test on their device:
1. Open feedback panel, attach an image — progress overlay should appear on thumbnail immediately
2. Attach a second image — both should upload concurrently with individual progress
3. Remove an image mid-upload — upload should cancel, no orphan left
4. Type feedback text while images upload — images should finish uploading in background
5. Click submit after images are uploaded — should be instant (no upload wait)
6. Click submit while an image is still uploading — should wait for it, then submit

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git commit -m "fix(feedback): integration fixes for pre-upload"
```
