# Store Screenshot Capture Tool — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In-app screenshot capture + gallery drawer for organizing Play Store submission screenshots.

**Architecture:** Admin-only camera button captures the viewport using `dom-to-image-more` (already installed), uploads to Firebase Storage via the existing `ScreenshotUploader`, and displays in a right-side gallery drawer with drag-to-slot organization mapped to Play Store requirements.

**Tech Stack:** Svelte 5 + dom-to-image-more + Firebase Storage/Firestore + existing DrawerStack + existing keyboard system

**Existing code to build on:**
- `src/lib/features/lab/services/implementations/ScreenshotUploader.ts` — Firebase upload + Firestore metadata (reuse directly)
- `src/lib/features/lab/services/contracts/IScreenshotUploader.ts` — interface + types
- `src/lib/shared/foundation/ui/CopyAsImageButton.svelte` — `dom-to-image-more` capture pattern
- `src/lib/shared/toast/state/toast-state.svelte.ts` — `toast.image()` for thumbnail preview

---

## File Structure

### New files (feature: `store-screenshots`)

| File | Responsibility |
|------|---------------|
| `src/lib/features/store-screenshots/state/store-screenshot-state.svelte.ts` | Reactive state: captures list, gallery open, slot assignments |
| `src/lib/features/store-screenshots/services/contracts/IScreenshotCapturer.ts` | Interface for viewport capture |
| `src/lib/features/store-screenshots/services/implementations/ScreenshotCapturer.ts` | Captures viewport via dom-to-image-more, uploads via existing ScreenshotUploader |
| `src/lib/features/store-screenshots/services/contracts/IScreenshotGalleryLoader.ts` | Interface for loading screenshots from Firestore |
| `src/lib/features/store-screenshots/services/implementations/ScreenshotGalleryLoader.ts` | Queries Firestore for user's screenshots, manages slot assignments |
| `src/lib/features/store-screenshots/components/CaptureButton.svelte` | Floating camera icon, admin-only |
| `src/lib/features/store-screenshots/components/StoreScreenshotGallery.svelte` | Gallery drawer: slots + unassigned pool |
| `src/lib/features/store-screenshots/components/SlotGrid.svelte` | Numbered slot row (phone or tablet) with drop targets |
| `src/lib/features/store-screenshots/components/ScreenshotThumbnail.svelte` | Individual thumbnail with actions (assign, delete, download) |
| `src/lib/features/store-screenshots/domain/models/store-screenshot-models.ts` | Types: StoreScreenshot, SlotAssignment, StoreSlotId |
| `src/lib/shared/di/containers/store-screenshots-container.ts` | DI container for capture + gallery services |

### Modified files

| File | Change |
|------|--------|
| `src/lib/shared/application/components/MainApplication.svelte` | Mount CaptureButton + StoreScreenshotGallery, register Ctrl+Shift+S and Ctrl+Q hotkeys |
| `src/lib/shared/di/container-types.ts` | Add StoreScreenshotsContainer type |
| `src/lib/shared/di/index.ts` | Wire store-screenshots container |

---

## Chunk 1: Domain Models + State + Services

### Task 1: Domain models

**Files:**
- Create: `src/lib/features/store-screenshots/domain/models/store-screenshot-models.ts`

- [ ] **Step 1: Create the models file**

```typescript
import type { ScreenshotMetadata } from "$lib/features/lab/services/contracts/IScreenshotUploader";

/** Play Store slot identifiers */
export type PhoneSlot = "phone-1" | "phone-2" | "phone-3" | "phone-4" | "phone-5" | "phone-6" | "phone-7" | "phone-8";
export type TabletSlot = "tablet-1" | "tablet-2" | "tablet-3" | "tablet-4" | "tablet-5" | "tablet-6" | "tablet-7" | "tablet-8";
export type StoreSlotId = PhoneSlot | TabletSlot;

export const PHONE_SLOTS: PhoneSlot[] = ["phone-1", "phone-2", "phone-3", "phone-4", "phone-5", "phone-6", "phone-7", "phone-8"];
export const TABLET_SLOTS: TabletSlot[] = ["tablet-1", "tablet-2", "tablet-3", "tablet-4", "tablet-5", "tablet-6", "tablet-7", "tablet-8"];
export const REQUIRED_PHONE_SLOTS: PhoneSlot[] = ["phone-1", "phone-2"];

/** Extended metadata with slot assignment */
export interface StoreScreenshot extends ScreenshotMetadata {
  storeSlot?: StoreSlotId;
  tab?: string;
  background?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/store-screenshots/domain/models/store-screenshot-models.ts
git commit -m "feat(store-screenshots): add domain models for Play Store slots"
```

---

### Task 2: Reactive state

**Files:**
- Create: `src/lib/features/store-screenshots/state/store-screenshot-state.svelte.ts`

- [ ] **Step 1: Create state file**

```typescript
import type { StoreScreenshot, StoreSlotId } from "../domain/models/store-screenshot-models";
import { PHONE_SLOTS, TABLET_SLOTS } from "../domain/models/store-screenshot-models";

/** All captured screenshots loaded from Firestore */
let _screenshots = $state<StoreScreenshot[]>([]);

/** Whether the gallery drawer is open */
let _galleryOpen = $state(false);

/** Whether a capture is in progress */
let _capturing = $state(false);

export const storeScreenshotState = {
  get screenshots() { return _screenshots; },
  set screenshots(v: StoreScreenshot[]) { _screenshots = v; },

  get galleryOpen() { return _galleryOpen; },
  set galleryOpen(v: boolean) { _galleryOpen = v; },

  get capturing() { return _capturing; },
  set capturing(v: boolean) { _capturing = v; },

  /** Screenshots assigned to a slot, keyed by slot ID */
  get slotMap(): Map<StoreSlotId, StoreScreenshot> {
    const map = new Map<StoreSlotId, StoreScreenshot>();
    for (const s of _screenshots) {
      if (s.storeSlot) map.set(s.storeSlot, s);
    }
    return map;
  },

  /** Screenshots not assigned to any slot */
  get unassigned(): StoreScreenshot[] {
    return _screenshots.filter(s => !s.storeSlot);
  },

  get phoneSlotsFilled(): number {
    return PHONE_SLOTS.filter(slot =>
      _screenshots.some(s => s.storeSlot === slot)
    ).length;
  },

  get tabletSlotsFilled(): number {
    return TABLET_SLOTS.filter(slot =>
      _screenshots.some(s => s.storeSlot === slot)
    ).length;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/store-screenshots/state/store-screenshot-state.svelte.ts
git commit -m "feat(store-screenshots): add reactive state for captures and slots"
```

---

### Task 3: ScreenshotCapturer service (capture viewport + upload)

**Files:**
- Create: `src/lib/features/store-screenshots/services/contracts/IScreenshotCapturer.ts`
- Create: `src/lib/features/store-screenshots/services/implementations/ScreenshotCapturer.ts`

- [ ] **Step 1: Create interface**

```typescript
import type { StoreScreenshot } from "../../domain/models/store-screenshot-models";

export interface CaptureResult {
  screenshot: StoreScreenshot;
  previewUrl: string; // Object URL for toast thumbnail
}

export interface IScreenshotCapturer {
  /** Capture the current viewport and upload to Firebase */
  captureViewport(): Promise<CaptureResult>;
}
```

- [ ] **Step 2: Create implementation**

Build on the capture pattern from `CopyAsImageButton.svelte` and upload pattern from `ScreenshotUploader.ts`.

```typescript
import type { IScreenshotCapturer, CaptureResult } from "../contracts/IScreenshotCapturer";
import type { IScreenshotUploader } from "$lib/features/lab/services/contracts/IScreenshotUploader";
import type { StoreScreenshot } from "../../domain/models/store-screenshot-models";

export class ScreenshotCapturer implements IScreenshotCapturer {
  constructor(private uploader: IScreenshotUploader) {}

  async captureViewport(): Promise<CaptureResult> {
    const domtoimage = (await import("dom-to-image-more")).default;

    // Capture the full document body (viewport with background)
    const blob = await domtoimage.toBlob(document.body, {
      width: window.innerWidth,
      height: window.innerHeight,
      quality: 1.0,
    });

    // Determine current module/tab from navigation state
    const { navigationState } = await import("$lib/shared/navigation/state/navigation-state.svelte");
    const module = navigationState.currentModule ?? "unknown";
    const tab = navigationState.activeTab ?? "unknown";
    const routeLabel = `${module}--${tab}`;
    const filename = `${routeLabel}_${Date.now()}.png`;

    const metadata = await this.uploader.upload({
      blob,
      filename,
      routeLabel,
      module,
      deviceSlug: "manual-capture",
      deviceCategory: "phone", // default, user reassigns in gallery
      deviceName: "Manual Capture",
      width: window.innerWidth * window.devicePixelRatio,
      height: window.innerHeight * window.devicePixelRatio,
    });

    const previewUrl = URL.createObjectURL(blob);

    const screenshot: StoreScreenshot = {
      ...metadata,
      tab,
    };

    return { screenshot, previewUrl };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/store-screenshots/services/contracts/IScreenshotCapturer.ts src/lib/features/store-screenshots/services/implementations/ScreenshotCapturer.ts
git commit -m "feat(store-screenshots): add viewport capture service"
```

---

### Task 4: ScreenshotGalleryLoader service (Firestore queries + slot management)

**Files:**
- Create: `src/lib/features/store-screenshots/services/contracts/IScreenshotGalleryLoader.ts`
- Create: `src/lib/features/store-screenshots/services/implementations/ScreenshotGalleryLoader.ts`

- [ ] **Step 1: Create interface**

```typescript
import type { StoreScreenshot, StoreSlotId } from "../../domain/models/store-screenshot-models";

export interface IScreenshotGalleryLoader {
  /** Load all screenshots for current user from Firestore */
  loadAll(): Promise<StoreScreenshot[]>;

  /** Assign a screenshot to a Play Store slot (updates Firestore) */
  assignToSlot(screenshotId: string, slot: StoreSlotId): Promise<void>;

  /** Remove a screenshot from its slot (updates Firestore) */
  unassignSlot(screenshotId: string): Promise<void>;

  /** Delete a screenshot (Storage + Firestore) */
  deleteScreenshot(screenshotId: string, storagePath: string): Promise<void>;
}
```

- [ ] **Step 2: Create implementation**

```typescript
import type { IScreenshotGalleryLoader } from "../contracts/IScreenshotGalleryLoader";
import type { StoreScreenshot, StoreSlotId } from "../../domain/models/store-screenshot-models";
import {
  getFirestoreInstance,
  getStorageInstance,
  getAuthSync,
} from "$lib/shared/auth/firebase";

export class ScreenshotGalleryLoader implements IScreenshotGalleryLoader {
  private getCollectionPath(): string {
    const userId = getAuthSync().currentUser?.uid;
    if (!userId) throw new Error("Must be authenticated");
    return `users/${userId}/screenshots`;
  }

  async loadAll(): Promise<StoreScreenshot[]> {
    const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
    const firestore = await getFirestoreInstance();
    const collPath = this.getCollectionPath();

    const q = query(
      collection(firestore, collPath),
      orderBy("capturedAt", "desc")
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        filename: data.filename,
        storagePath: data.storagePath,
        downloadUrl: data.downloadUrl,
        routeLabel: data.routeLabel,
        module: data.module,
        tab: data.tab,
        deviceSlug: data.deviceSlug,
        deviceCategory: data.deviceCategory,
        deviceName: data.deviceName,
        width: data.width,
        height: data.height,
        tagIds: data.tagIds ?? [],
        storeSlot: data.storeSlot,
        background: data.background,
        capturedAt: data.capturedAt?.toDate() ?? new Date(),
        createdAt: data.createdAt?.toDate() ?? new Date(),
        updatedAt: data.updatedAt?.toDate() ?? new Date(),
      } satisfies StoreScreenshot;
    });
  }

  async assignToSlot(screenshotId: string, slot: StoreSlotId): Promise<void> {
    const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
    const firestore = await getFirestoreInstance();
    const collPath = this.getCollectionPath();

    // First, unassign any screenshot currently in this slot
    const existing = await this.loadAll();
    const occupant = existing.find(s => s.storeSlot === slot && s.id !== screenshotId);
    if (occupant) {
      await updateDoc(doc(firestore, collPath, occupant.id), {
        storeSlot: null,
        updatedAt: serverTimestamp(),
      });
    }

    await updateDoc(doc(firestore, collPath, screenshotId), {
      storeSlot: slot,
      updatedAt: serverTimestamp(),
    });
  }

  async unassignSlot(screenshotId: string): Promise<void> {
    const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
    const firestore = await getFirestoreInstance();
    const collPath = this.getCollectionPath();

    await updateDoc(doc(firestore, collPath, screenshotId), {
      storeSlot: null,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteScreenshot(screenshotId: string, storagePath: string): Promise<void> {
    const { doc, deleteDoc } = await import("firebase/firestore");
    const { ref, deleteObject } = await import("firebase/storage");
    const firestore = await getFirestoreInstance();
    const storage = await getStorageInstance();
    const collPath = this.getCollectionPath();

    // Delete from Storage
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      console.warn("Storage delete failed (may already be deleted):", err);
    }

    // Delete Firestore doc
    await deleteDoc(doc(firestore, collPath, screenshotId));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/store-screenshots/services/contracts/IScreenshotGalleryLoader.ts src/lib/features/store-screenshots/services/implementations/ScreenshotGalleryLoader.ts
git commit -m "feat(store-screenshots): add gallery loader with slot management"
```

---

### Task 5: DI container + wiring

**Files:**
- Create: `src/lib/shared/di/containers/store-screenshots-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`
- Modify: `src/lib/shared/di/index.ts`

- [ ] **Step 1: Create container**

```typescript
import { createContainer } from "iti";
import { ScreenshotCapturer } from "$lib/features/store-screenshots/services/implementations/ScreenshotCapturer";
import { ScreenshotGalleryLoader } from "$lib/features/store-screenshots/services/implementations/ScreenshotGalleryLoader";
import type { IScreenshotUploader } from "$lib/features/lab/services/contracts/IScreenshotUploader";

export function createStoreScreenshotsContainer(deps: { screenshotUploader: IScreenshotUploader }) {
  return createContainer()
    .add({ screenshotCapturer: () => new ScreenshotCapturer(deps.screenshotUploader) })
    .add({ screenshotGalleryLoader: () => new ScreenshotGalleryLoader() });
}

export type StoreScreenshotsContainer = ReturnType<typeof createStoreScreenshotsContainer>;
```

- [ ] **Step 2: Add to container-types.ts**

Add `StoreScreenshotsContainer` items to the `IAppContainerItems` intersection type. Follow the exact pattern of existing container type additions in that file.

- [ ] **Step 3: Wire into index.ts**

In `buildAppContainer()`, call `createStoreScreenshotsContainer` passing the existing `screenshotUploader` from the lab container.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/store-screenshots-container.ts src/lib/shared/di/container-types.ts src/lib/shared/di/index.ts
git commit -m "feat(store-screenshots): register DI container"
```

- [ ] **Step 5: Run typecheck**

```bash
npm run check
```

Expected: no new errors.

---

## Chunk 2: UI Components

### Task 6: CaptureButton component

**Files:**
- Create: `src/lib/features/store-screenshots/components/CaptureButton.svelte`

- [ ] **Step 1: Create the floating capture button**

Admin-only floating camera icon in top-right corner. On click: captures viewport, uploads, shows toast with thumbnail. Follows the state/animation pattern from `CopyAsImageButton.svelte`.

Key details:
- Position: `fixed`, top-right, `z-index: 100` (below drawers at 200+)
- Show only when `isEffectiveAdmin()` returns true
- On click: set `storeScreenshotState.capturing = true`, call `screenshotCapturer.captureViewport()`, add result to state, show `toast.image()`, reset capturing state
- The button itself should be excluded from the capture (hide it during capture via a CSS class or `visibility: hidden` before dom-to-image runs, restore after)
- Shutter flash: brief white overlay that fades in 200ms

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/store-screenshots/components/CaptureButton.svelte
git commit -m "feat(store-screenshots): add floating capture button"
```

---

### Task 7: ScreenshotThumbnail component

**Files:**
- Create: `src/lib/features/store-screenshots/components/ScreenshotThumbnail.svelte`

- [ ] **Step 1: Create thumbnail component**

Displays a single screenshot as a thumbnail card. Shows:
- The image (lazy loaded via `downloadUrl`)
- Module + tab label below
- Timestamp
- Actions: delete button (trash icon), download button (arrow-down icon)

Props:
```typescript
interface Props {
  screenshot: StoreScreenshot;
  onDelete: (id: string) => void;
  onSelect?: (screenshot: StoreScreenshot) => void;
  selected?: boolean;
  draggable?: boolean;
}
```

Use `draggable="true"` with `ondragstart` setting `dataTransfer` to the screenshot ID.

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/store-screenshots/components/ScreenshotThumbnail.svelte
git commit -m "feat(store-screenshots): add screenshot thumbnail component"
```

---

### Task 8: SlotGrid component

**Files:**
- Create: `src/lib/features/store-screenshots/components/SlotGrid.svelte`

- [ ] **Step 1: Create slot grid**

A horizontal row of numbered slots (8 slots). Each slot is a drop target.

Props:
```typescript
interface Props {
  label: string;           // "Phone (required)" or "Tablet (optional)"
  slots: StoreSlotId[];    // PHONE_SLOTS or TABLET_SLOTS
  slotMap: Map<StoreSlotId, StoreScreenshot>;
  requiredSlots?: StoreSlotId[];  // Slots marked as required (dashed red border when empty)
  onAssign: (screenshotId: string, slot: StoreSlotId) => void;
  onUnassign: (screenshotId: string) => void;
  onDelete: (id: string, storagePath: string) => void;
}
```

Each slot:
- Empty: dashed border, slot number, "Drop here" text
- Filled: thumbnail image, module/tab label, small "x" to unassign
- Required + empty: dashed border with accent color
- Drop zone: `ondragover` + `ondrop` handlers that read screenshot ID from `dataTransfer`

Horizontal scroll if slots overflow the drawer width.

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/store-screenshots/components/SlotGrid.svelte
git commit -m "feat(store-screenshots): add slot grid with drag-drop targets"
```

---

### Task 9: StoreScreenshotGallery drawer

**Files:**
- Create: `src/lib/features/store-screenshots/components/StoreScreenshotGallery.svelte`

- [ ] **Step 1: Create the gallery drawer**

The main gallery component. Right-side drawer using the existing `Drawer.svelte` component.

Layout (top to bottom):
1. **Header**: "Store Screenshots" title + "Download All" button + progress ("3/8 phone")
2. **Phone SlotGrid**: 8 slots, first 2 required
3. **Tablet SlotGrid**: 8 slots, all optional
4. **Divider**
5. **Unassigned pool**: Scrollable grid of `ScreenshotThumbnail` components, sorted newest first

On mount:
- Call `screenshotGalleryLoader.loadAll()` to populate `storeScreenshotState.screenshots`
- Show loading skeleton while fetching

"Download All Assigned" button:
- Collects all screenshots with `storeSlot` set
- Fetches each `downloadUrl` as blob
- Packages into a zip using JSZip (add as dependency) with filenames like `phone-1_create--construct.png`
- Triggers browser download

Bind `isOpen` to `storeScreenshotState.galleryOpen`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/store-screenshots/components/StoreScreenshotGallery.svelte
git commit -m "feat(store-screenshots): add gallery drawer with slot layout"
```

---

## Chunk 3: Integration + Hotkeys

### Task 10: Mount in MainApplication + register hotkeys

**Files:**
- Modify: `src/lib/shared/application/components/MainApplication.svelte`

- [ ] **Step 1: Import and mount components**

Add to the imports section:
```typescript
import CaptureButton from "$lib/features/store-screenshots/components/CaptureButton.svelte";
import StoreScreenshotGallery from "$lib/features/store-screenshots/components/StoreScreenshotGallery.svelte";
```

Add to the template, alongside other overlay components (near line 543):
```svelte
{#if authState.isAdmin}
  <CaptureButton />
  <StoreScreenshotGallery />
{/if}
```

- [ ] **Step 2: Register keyboard shortcuts**

In the existing `handleKeydown` function (around line 304), add:

```typescript
// Screenshot capture (Ctrl+Shift+S) — admin only
if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "S") {
  event.preventDefault();
  if (authState.isAdmin) {
    // Trigger capture via state — CaptureButton listens for this
    document.dispatchEvent(new CustomEvent("store-screenshot-capture"));
  }
  return;
}

// Screenshot gallery (Ctrl+Q) — admin only
if ((event.ctrlKey || event.metaKey) && event.key === "q") {
  event.preventDefault();
  if (authState.isAdmin) {
    storeScreenshotState.galleryOpen = !storeScreenshotState.galleryOpen;
  }
  return;
}
```

Import the state at the top:
```typescript
import { storeScreenshotState } from "$lib/features/store-screenshots/state/store-screenshot-state.svelte";
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/application/components/MainApplication.svelte
git commit -m "feat(store-screenshots): mount capture button and gallery, register hotkeys"
```

- [ ] **Step 4: Run typecheck**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 5: Manual verification**

Open the app at localhost:5173. As admin:
1. Press `Ctrl+Shift+S` — should see shutter flash and toast with thumbnail
2. Press `Ctrl+Q` — gallery drawer should open from right
3. New capture should appear in unassigned pool
4. Drag a capture to phone slot 1 — should snap into place
5. "Download All Assigned" should produce a zip

---

## Chunk 4: Polish

### Task 11: Add JSZip dependency

- [ ] **Step 1: Install JSZip**

```bash
npm install jszip
```

- [ ] **Step 2: Add type declaration if needed**

JSZip ships with types. Verify with `npm run check`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jszip for screenshot gallery export"
```

---

### Task 12: Shutter flash animation

The CaptureButton should include a full-viewport flash overlay that:
- Appears as `position: fixed; inset: 0; background: white; z-index: 9999`
- Fades from `opacity: 0.3` to `0` over 200ms
- Runs after the capture completes (so the flash itself isn't captured)
- Respects `prefers-reduced-motion` (skip animation, just show toast)

This is part of CaptureButton.svelte — add it there during Task 6.

---

### Task 13: Hide capture button from screenshot

Before `domtoimage.toBlob()` runs, hide the capture button:
```typescript
const captureBtn = document.querySelector("[data-capture-button]");
if (captureBtn) (captureBtn as HTMLElement).style.visibility = "hidden";
try {
  const blob = await domtoimage.toBlob(document.body, { ... });
  return blob;
} finally {
  if (captureBtn) (captureBtn as HTMLElement).style.visibility = "visible";
}
```

Add `data-capture-button` attribute to the CaptureButton root element. This is part of Task 6.
