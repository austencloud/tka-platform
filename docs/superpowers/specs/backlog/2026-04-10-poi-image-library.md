---
status: backlog
value: 3
effort: M
score: 9
remaining: "Firebase persistence layer (local library works)"
last_triaged: 2026-04-26
---
# Spec: Account-scoped POV image library

**Date:** 2026-04-10
**Status:** Ready for implementation
**Owner:** Next available sub-agent
**Estimated size:** Medium-Large (~5-7 hours)
**Priority:** After the timeline-sequence-integration specs. User explicitly asked for it: uploaded images should accumulate in a library attached to their account.

---

## Motivation

Today, when the user uploads an image in the POV Pattern Lab (either via `PatternPicker`'s upload zone or by dropping one directly on the timeline), the image is decoded into a `StripPattern` and the raw data URL is stashed in `localStorage` under `tka-poi-image`. That localStorage slot holds exactly ONE image — the most recently uploaded one. Upload a second image and the first is gone from the lab forever.

The user asked: *"it'd be really cool if I could when I upload an image if that image could be a part of like a library that I get saved according to my account."*

This spec adds a per-user image library that persists uploaded images to Firebase Storage + Firestore so they survive across devices and sessions, shows them in a browsable grid inside the lab, and lets the user re-apply any previously uploaded image with one click.

---

## Goals

- Every image the user uploads (via upload zone or timeline drop) is **also** saved to a library in their account — fire-and-forget, non-blocking.
- A new **Image Library** UI in the POV Pattern Lab shows thumbnails of all previously uploaded images.
- Clicking a library item loads it as the active pattern (same effect as uploading it fresh).
- Dragging a library item onto the pattern timeline creates a clip from it (same effect as dropping the file from the desktop).
- Library items can be renamed and deleted.
- Duplicate detection: if a user uploads a file that's identical (by content hash) to one already in the library, reuse the existing library entry rather than creating a second record.
- Reactive: the library list streams from Firestore via `onSnapshot`, so changes from another device or tab appear live.
- Guest fallback: when there's no logged-in user, uploads still work in-memory (as today) but nothing is written to the cloud. A subtle "Sign in to save your images" hint replaces the library browser.

## Non-goals

- **No library for algorithmic presets.** Presets are code-defined and don't need storage.
- **No sharing between users.** The library is strictly per-account.
- **No server-side thumbnail generation.** The browser renders thumbnails from the full image via the standard `<img>` tag. For typical upload sizes (<1MB) this is fine. Server-side thumbs are a future optimization.
- **No folders / tags / collections.** Flat list, sorted by upload date. If the user accumulates dozens of images we can add filtering later.
- **No batch operations** (multi-select delete, bulk export). Single-item actions only in v1.
- **No migration of the current `tka-poi-image` localStorage entry.** On first upload after this ships, the library gets the new image and the old localStorage entry is left alone (it'll be overwritten or cleared naturally). No data loss either way.

---

## Design

### Data model

**Firebase Storage path:** `users/{userId}/poi-images/{imageId}.{ext}`
Mirrors the existing `ScreenshotUploader` pattern. The `imageId` is a content hash (see below) so identical uploads collide naturally.

**Firestore collection:** `users/{userId}/poi-images/{imageId}`
One document per library entry.

**Document shape:**

```typescript
interface PoiImageLibraryEntry {
  /** Content hash (SHA-256 hex, first 16 chars) — doubles as doc ID and Storage filename */
  id: string;
  /** User-facing name, defaults to the original filename (no extension). Editable. */
  name: string;
  /** Original filename at upload time, for reference */
  originalFileName: string;
  /** Public download URL from Firebase Storage */
  storageUrl: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Pixel dimensions of the source image */
  width: number;
  height: number;
  /** MIME type: "image/png" | "image/jpeg" | "image/bmp" */
  contentType: string;
  /** Firestore server timestamp of the upload */
  uploadedAt: number; // Date.now() on the client, safe for display
  /** Where the upload came from — useful for analytics / debugging */
  source: "upload-zone" | "timeline-drop";
}
```

### Content hashing

To detect duplicates:

```typescript
async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 16; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex; // 32-char hex string (128 bits, plenty for dedup)
}
```

Upload flow:
1. Hash the file → `imageId`.
2. Check if `users/{userId}/poi-images/{imageId}` already exists in Firestore (single `getDoc`).
3. If yes → skip the upload, return the existing entry. Library state already has it via onSnapshot.
4. If no → upload binary to Storage, get download URL, write Firestore doc. The onSnapshot subscription picks up the new entry automatically.

### Service: `PoiImageLibrary`

Follow the project's service naming + DI rules (`.claude/rules/service-naming.md`, `.claude/rules/code-style.md`). This is a **Repository** because it owns CRUD on a Firestore collection.

**Interface** `src/lib/features/poi/services/contracts/IPoiImageLibrary.ts`:

```typescript
import type { PoiImageLibraryEntry } from "../../domain/PoiImageLibraryEntry";

export interface IPoiImageLibrary {
  /**
   * Upload a file to the current user's image library.
   * - Hashes the file to detect duplicates.
   * - If the image is already in the library, returns the existing entry without re-uploading.
   * - If no user is logged in, resolves to null (guest fallback).
   */
  upload(
    file: File,
    source: "upload-zone" | "timeline-drop",
  ): Promise<PoiImageLibraryEntry | null>;

  /** Subscribe to the live list of library entries for the current user. Returns an unsubscribe fn. */
  subscribe(onChange: (entries: PoiImageLibraryEntry[]) => void): () => void;

  /** Rename an entry. No-op if no user. */
  rename(id: string, name: string): Promise<void>;

  /** Delete an entry (removes both the Firestore doc AND the Storage file). No-op if no user. */
  delete(id: string): Promise<void>;

  /**
   * Fetch the binary image data for a library entry and decode it to an ImageData
   * that `patternEngine.fromImage(imageData, ledCount)` can consume.
   */
  loadAsImageData(entry: PoiImageLibraryEntry): Promise<ImageData>;
}
```

**Implementation** `src/lib/features/poi/services/implementations/PoiImageLibrary.ts`:

```typescript
import type { IPoiImageLibrary } from "../contracts/IPoiImageLibrary";
import type { PoiImageLibraryEntry } from "../../domain/PoiImageLibraryEntry";
import { getEffectiveUserId } from "$lib/shared/auth/state/authState.svelte";
import { getStorageInstance, getFirestoreInstance } from "$lib/shared/auth/firebase";

export class PoiImageLibrary implements IPoiImageLibrary {
  async upload(file: File, source: "upload-zone" | "timeline-drop"): Promise<PoiImageLibraryEntry | null> {
    const userId = getEffectiveUserId();
    if (!userId) return null;

    const id = await this.hashFile(file);
    const firestore = await getFirestoreInstance();
    const { doc, getDoc, setDoc } = await import("firebase/firestore");
    const docRef = doc(firestore, `users/${userId}/poi-images/${id}`);

    // Dedup check
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      return existing.data() as PoiImageLibraryEntry;
    }

    // Get pixel dimensions (needed for the doc, cheap via createImageBitmap)
    const bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close();

    // Upload binary
    const storage = await getStorageInstance();
    const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
    const ext = this.extFromContentType(file.type) ?? "bin";
    const storageRef = ref(storage, `users/${userId}/poi-images/${id}.${ext}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const storageUrl = await getDownloadURL(storageRef);

    // Write metadata doc
    const entry: PoiImageLibraryEntry = {
      id,
      name: file.name.replace(/\.[^.]+$/, ""),
      originalFileName: file.name,
      storageUrl,
      sizeBytes: file.size,
      width,
      height,
      contentType: file.type,
      uploadedAt: Date.now(),
      source,
    };
    await setDoc(docRef, entry);
    return entry;
  }

  subscribe(onChange: (entries: PoiImageLibraryEntry[]) => void): () => void {
    const userId = getEffectiveUserId();
    if (!userId) {
      onChange([]);
      return () => { /* noop */ };
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      const firestore = await getFirestoreInstance();
      const { collection, onSnapshot, query, orderBy } = await import("firebase/firestore");
      if (cancelled) return;
      const q = query(
        collection(firestore, `users/${userId}/poi-images`),
        orderBy("uploadedAt", "desc"),
      );
      unsubscribe = onSnapshot(q, (snap) => {
        const entries: PoiImageLibraryEntry[] = [];
        snap.forEach((d) => entries.push(d.data() as PoiImageLibraryEntry));
        onChange(entries);
      });
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }

  async rename(id: string, name: string): Promise<void> {
    const userId = getEffectiveUserId();
    if (!userId) return;
    const firestore = await getFirestoreInstance();
    const { doc, updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(firestore, `users/${userId}/poi-images/${id}`), { name });
  }

  async delete(id: string): Promise<void> {
    const userId = getEffectiveUserId();
    if (!userId) return;

    // Firestore doc first (cheap, reversible if Storage delete fails)
    const firestore = await getFirestoreInstance();
    const { doc, getDoc, deleteDoc } = await import("firebase/firestore");
    const docRef = doc(firestore, `users/${userId}/poi-images/${id}`);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return;
    const entry = snapshot.data() as PoiImageLibraryEntry;
    await deleteDoc(docRef);

    // Best-effort Storage cleanup — if it fails, orphaned file is acceptable
    try {
      const storage = await getStorageInstance();
      const { ref, deleteObject } = await import("firebase/storage");
      const ext = this.extFromContentType(entry.contentType) ?? "bin";
      await deleteObject(ref(storage, `users/${userId}/poi-images/${id}.${ext}`));
    } catch {
      // Orphan acceptable — Firestore is the source of truth
    }
  }

  async loadAsImageData(entry: PoiImageLibraryEntry): Promise<ImageData> {
    // Fetch the binary from Storage and decode
    const response = await fetch(entry.storageUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();
    return imageData;
  }

  private async hashFile(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const bytes = new Uint8Array(digest);
    let hex = "";
    for (let i = 0; i < 16; i++) hex += bytes[i]!.toString(16).padStart(2, "0");
    return hex;
  }

  private extFromContentType(ct: string): string | null {
    if (ct === "image/png") return "png";
    if (ct === "image/jpeg") return "jpg";
    if (ct === "image/bmp") return "bmp";
    if (ct === "image/webp") return "webp";
    return null;
  }
}
```

### DI registration

Add `poiImageLibrary` to whichever container the poi feature currently uses. If there's no POI container yet, either (a) add it to an existing lab/data container, or (b) create a new `poi-container.ts` under `src/lib/shared/di/containers/`. Check `src/lib/shared/di/index.ts` to see where poi is currently wired — if nowhere, add the minimal wiring. Update `src/lib/shared/di/container-types.ts` accordingly.

```typescript
// container
.add({ poiImageLibrary: () => new PoiImageLibrary() })
```

### State factory integration

Extend `createPoiState` in `src/lib/features/poi/state/poi-state.svelte.ts`:

1. Take `IPoiImageLibrary` as a third constructor arg. Update `ModuleRoot` / wherever `createPoiState` is called to pass `container.items.poiImageLibrary`.
2. Add `$state` for the library list:

   ```typescript
   let libraryEntries = $state<PoiImageLibraryEntry[]>([]);
   ```
3. Subscribe to the library on creation:

   ```typescript
   const unsubscribeLibrary = imageLibrary.subscribe((entries) => {
     libraryEntries = entries;
   });
   ```

   Store `unsubscribeLibrary` and expose a `dispose()` function on the returned object so the module root can call it on teardown. (Current code has no dispose pattern — add one. Minimal and additive.)
4. In `loadFromFile`, after successfully decoding the image, fire off `imageLibrary.upload(file, "upload-zone")` without awaiting, catching errors so a failed upload doesn't break the in-memory workflow.
5. In `dropImageAsClip`, do the same with `source: "timeline-drop"` after the clip is successfully inserted.
6. Add two new actions:

   ```typescript
   async function loadFromLibrary(entry: PoiImageLibraryEntry): Promise<void> {
     const imageData = await imageLibrary.loadAsImageData(entry);
     activePattern = patternEngine.fromImage(imageData, ledCount);
     if (activePattern) {
       activePattern.metadata.name = entry.name;
       activePattern.metadata.source = "image-upload";
       activePattern.metadata.sourceImagePath = entry.originalFileName;
     }
     hasUploadedImage = true;
     uploadedImageName = entry.name;
     // NOTE: does NOT overwrite the localStorage `tka-poi-image` entry
     // because the library is the source of truth now.
   }

   async function dropLibraryEntryAsClip(
     entry: PoiImageLibraryEntry,
     startBeat: number,
     endBeat: number,
   ): Promise<PatternClip | null> {
     const imageData = await imageLibrary.loadAsImageData(entry);
     const pattern = patternEngine.fromImage(imageData, ledCount);
     pattern.metadata.name = entry.name;
     pattern.metadata.source = "image-upload";
     pattern.metadata.sourceImagePath = entry.originalFileName;
     const s = Math.max(1, Math.min(totalBeats, Math.round(startBeat)));
     const e = Math.max(1, Math.min(totalBeats, Math.round(endBeat)));
     const lo = Math.min(s, e);
     const hi = Math.max(s, e);
     const clip: PatternClip = {
       id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
       startBeat: lo,
       endBeat: hi,
       pattern,
       presetId: undefined,
       label: entry.name,
     };
     patternTimeline = insertPatternClip(patternTimeline, clip);
     return clip;
   }
   ```
7. Expose `libraryEntries`, `loadFromLibrary`, `dropLibraryEntryAsClip`, `renameLibraryEntry`, `deleteLibraryEntry` through the return object.

### UI: `PoiImageLibrary.svelte`

New component at `src/lib/features/poi/components/PoiImageLibrary.svelte`.

Layout: a grid of thumbnail tiles under `PatternPicker` in the left column. Each tile is a small square showing the image, with a filename overlay. Hover reveals a delete button. Click loads into active pattern. Drag starts an HTML5 drag-and-drop operation that `PatternTimeline` picks up.

```svelte
<script lang="ts">
  import { getPoiContext } from "../context/poi-context";
  import type { PoiImageLibraryEntry } from "../domain/PoiImageLibraryEntry";

  const poi = getPoiContext();

  async function handleClick(entry: PoiImageLibraryEntry): Promise<void> {
    await poi.loadFromLibrary(entry);
  }

  function handleDragStart(e: DragEvent, entry: PoiImageLibraryEntry): void {
    if (!e.dataTransfer) return;
    // Custom MIME type so PatternTimeline can distinguish library drags from file drags
    e.dataTransfer.setData("application/x-tka-poi-library-id", entry.id);
    e.dataTransfer.effectAllowed = "copy";
  }

  async function handleDelete(e: MouseEvent, entry: PoiImageLibraryEntry): Promise<void> {
    e.stopPropagation();
    if (!confirm(`Delete "${entry.name}" from your library?`)) return;
    await poi.deleteLibraryEntry(entry.id);
  }
</script>

{#if poi.isAuthenticated}
  <div class="library-section">
    <h4 class="section-title">My Images</h4>
    {#if poi.libraryEntries.length === 0}
      <p class="empty-hint">Images you upload will appear here.</p>
    {:else}
      <div class="library-grid">
        {#each poi.libraryEntries as entry (entry.id)}
          <button
            type="button"
            class="library-tile"
            draggable="true"
            onclick={() => handleClick(entry)}
            ondragstart={(e) => handleDragStart(e, entry)}
            title={entry.name}
          >
            <img src={entry.storageUrl} alt={entry.name} class="tile-thumb" loading="lazy" />
            <span class="tile-label">{entry.name}</span>
            <button
              type="button"
              class="tile-delete"
              onclick={(e) => handleDelete(e, entry)}
              aria-label="Delete"
            >
              <i class="fas fa-trash" aria-hidden="true"></i>
            </button>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="library-section">
    <p class="empty-hint">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      Sign in to save uploaded images to a library you can reuse later.
    </p>
  </div>
{/if}
```

Add `poi.isAuthenticated` to the state factory: `const isAuthenticated = $derived(getEffectiveUserId() !== null)`. Note: `getEffectiveUserId()` is currently a plain function — to make it reactive, you'll need to read `authState.user` (or whichever reactive state the auth module exposes). Verify by reading `authState.svelte.ts` to find the reactive getter. If the auth state is itself a `$state` rune, reading it in a `$derived` is automatic.

### PovPatternLab wiring

Add `PoiImageLibrary.svelte` to the controls column of `src/lib/features/lab/tabs/PovPatternLab.svelte`, directly below `PatternPicker`. Component-scoped styles only.

### PatternTimeline drop handling for library drags

Extend the existing `handleDragOver` / `handleFileDrop` in `PatternTimeline.svelte` to also recognize the custom MIME type `application/x-tka-poi-library-id`:

```typescript
function handleDragOver(e: DragEvent): void {
  const types = e.dataTransfer?.types;
  if (!types) return;
  const isFile = types.includes("Files");
  const isLibrary = types.includes("application/x-tka-poi-library-id");
  if (!isFile && !isLibrary) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = "copy";
  const beat = getBeatFromX(e.clientX);
  const DEFAULT_SPAN = 4;
  fileDragOver = true;
  fileDragStart = beat;
  fileDragEnd = Math.min(totalBeats, beat + DEFAULT_SPAN - 1);
}

async function handleFileDrop(e: DragEvent): Promise<void> {
  e.preventDefault();
  fileDragOver = false;

  const libraryId = e.dataTransfer?.getData("application/x-tka-poi-library-id");
  if (libraryId) {
    const entry = poi.libraryEntries.find((lib) => lib.id === libraryId);
    if (entry) await poi.dropLibraryEntryAsClip(entry, fileDragStart, fileDragEnd);
    return;
  }

  const file = e.dataTransfer?.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  await poi.dropImageAsClip(file, fileDragStart, fileDragEnd);
}
```

### Guest fallback behavior

- Uploading a file while logged out still works in-memory (`loadFromFile` / `dropImageAsClip` produce a pattern as today).
- `imageLibrary.upload()` resolves to `null` when there's no user — it doesn't throw, and the fire-and-forget call in `loadFromFile` / `dropImageAsClip` catches null gracefully.
- `libraryEntries` stays empty.
- `PoiImageLibrary.svelte` shows the "Sign in to save" hint instead of the grid.

---

## Files to touch

### New files

1. `src/lib/features/poi/domain/PoiImageLibraryEntry.ts` — interface
2. `src/lib/features/poi/services/contracts/IPoiImageLibrary.ts` — interface
3. `src/lib/features/poi/services/implementations/PoiImageLibrary.ts` — implementation
4. `src/lib/features/poi/components/PoiImageLibrary.svelte` — new UI

### Modified files

5. `src/lib/features/poi/state/poi-state.svelte.ts` — take `IPoiImageLibrary` as arg, add `libraryEntries` state, subscribe on init, add `loadFromLibrary` / `dropLibraryEntryAsClip` / `renameLibraryEntry` / `deleteLibraryEntry` actions, fire-and-forget upload calls in `loadFromFile` and `dropImageAsClip`, expose new state/actions, add `isAuthenticated` derived, add `dispose()` for cleanup
6. `src/lib/features/poi/context/poi-context.ts` — if the context type is hand-written, add the new fields
7. `src/lib/features/lab/tabs/PovPatternLab.svelte` — render `PoiImageLibrary` below `PatternPicker`
8. `src/lib/features/poi/components/PatternTimeline.svelte` — extend drag handlers to recognize the custom MIME type and drop library items
9. One of: existing poi container OR new `src/lib/shared/di/containers/poi-container.ts` — register `poiImageLibrary`
10. `src/lib/shared/di/container-types.ts` — if a new container was added
11. Wherever `createPoiState` is called (probably `PoiModuleRoot` or similar) — pass `container.items.poiImageLibrary` as the new arg

---

## Implementation plan

1. Create domain type (`PoiImageLibraryEntry.ts`).
2. Create service interface + implementation. Follow the ScreenshotUploader import patterns for lazy Firebase imports.
3. Register in DI container; wire into composition root.
4. Extend poi-state factory: add constructor arg, library state, subscribe, dispose, new actions.
5. Wire the new constructor arg at the call site.
6. Create `PoiImageLibrary.svelte`.
7. Add `PoiImageLibrary` to `PovPatternLab.svelte`.
8. Extend `PatternTimeline.svelte` drop handlers for the custom MIME type.
9. `npx svelte-check --tsconfig ./tsconfig.json --output human 2>&1 | grep -iE "poi-state|patterntimeline|povpatternlab|poiimagelibrary|poilibrary"` — confirm zero errors in touched files.
10. Verify in browser with the user signed in: upload an image, confirm it appears in the library grid. Reload the page, confirm it's still there. Click it, confirm it loads as active pattern. Drag it to the timeline, confirm it creates a clip.

---

## Verification / acceptance criteria

- [ ] Uploading an image while signed in creates a Firestore doc under `users/{userId}/poi-images/{id}` and a Storage file at the matching path.
- [ ] Uploading the exact same file twice results in ONE library entry (dedup by SHA-256).
- [ ] The library grid populates reactively from `onSnapshot` — upload in one tab, watch it appear in another.
- [ ] Clicking a library tile loads it as the active pattern, visible in the disc and staff previews.
- [ ] Dragging a library tile onto the pattern timeline creates a clip using the library entry's pattern data.
- [ ] Deleting a library entry removes both the Firestore doc and the Storage file (and the tile disappears from the grid).
- [ ] Uploading while signed OUT still produces a working in-memory pattern AND does not crash or throw network errors visible to the user.
- [ ] Signing out hides the library grid and shows the "Sign in to save" hint.
- [ ] The existing `tka-poi-image` localStorage fallback still works for guest uploads (single in-memory slot). This is unchanged.
- [ ] Timeline persistence (clips, playback, blend mode) still works — the library feature is additive and doesn't touch the timeline persistence code.

---

## Open questions

- **Storage rules.** This spec assumes Firebase Storage security rules already allow `users/{uid}/**` writes for the authenticated user. If not, they need to be updated. Check `storage.rules` in the repo root before shipping.
- **Firestore rules.** Same question for `users/{uid}/poi-images/*` reads/writes. If rules are currently `request.auth.uid == uid` based on a wildcard, this collection will inherit access automatically.
- **Quota.** No per-user size cap in v1. If people upload GB of images, that's a Firebase billing concern. Add a per-user total size limit later if it becomes a problem.
- **Rename UI.** The interface supports rename but the v1 UI doesn't expose it (just click and delete). Follow-up: double-click label to edit inline.
- **Batch delete.** Out of scope for v1. Explicit follow-up.
- **Thumbnail optimization.** Full-resolution images served from Storage for display. If load times become a problem, add a Cloud Function to generate a 256×256 webp thumbnail on upload.
- **Offline behavior.** If the user is offline, `imageLibrary.upload()` will throw on the Storage call. The fire-and-forget catch swallows it; the image still works in-memory but is not persisted. Acceptable for v1. Firestore's offline persistence MAY buffer the metadata doc write but not the binary upload.
