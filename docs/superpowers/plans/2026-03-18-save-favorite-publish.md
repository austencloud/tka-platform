# Save / Favorite / Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sequence viewer action bar context-aware — showing Save, Favorite, Edit, Publish/Unpublish based on ownership, save state, and visibility.

**Architecture:** Backend services already support visibility, content hashing, and favorites via CollectionManager. This plan adds `hasMatchingContent()` to LibraryRepository, updates `CollectionManager.getCollectionSequences()` for cross-user favorites resolution, creates a reusable OverflowMenu component, then rewrites the action button logic in both Browse and Route Viewer contexts.

**Tech Stack:** Svelte 5, TypeScript, Firebase/Firestore, ITI DI

**Spec:** `docs/superpowers/specs/2026-03-18-save-favorite-publish-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/features/library/services/implementations/LibraryRepository.ts:284` | Change fork default visibility to "public" |
| Modify | `src/lib/features/library/services/contracts/ILibraryRepository.ts` | Add `hasMatchingContent()` method |
| Modify | `src/lib/features/library/services/implementations/LibraryRepository.ts` | Implement `hasMatchingContent()` |
| Modify | `src/lib/features/library/services/implementations/CollectionManager.ts:443-459` | Two-pass ID resolution in `getCollectionSequences()` |
| Create | `src/lib/shared/ui/components/OverflowMenu.svelte` | Reusable three-dot dropdown menu |
| Modify | `src/lib/features/browse/sequences/display/components/SequenceActionButtons.svelte` | Context-aware button logic |
| Modify | `src/lib/features/browse/sequences/display/components/SequenceDetailContent.svelte:406-419` | Pass new props, derive isSaved/isFavorite |
| Modify | `src/lib/features/browse/shared/services/implementations/BrowseEventHandler.ts` | Add publish/unpublish action handlers |
| Modify | `src/lib/features/browse/shared/state/browse-state-factory.svelte.ts:365-395` | Switch toggleFavorite to CollectionManager |
| Modify | `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte` | Context-aware action buttons |
| Modify | `src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte:95-150` | Context-aware action buttons |
| Modify | `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` | Add state/handlers to ctx object |
| Modify | `src/routes/sequence/[id]/+page.svelte:696-715` | Thread ctx props to ViewerFooter |
| Modify | `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte:471-495` | Thread ctx props to ViewerFooter |

---

## Task 1: Fork Default Visibility

**Files:**
- Modify: `src/lib/features/library/services/implementations/LibraryRepository.ts:284`

- [ ] **Step 1: Change fork default from "private" to "public"**

In `LibraryRepository.ts`, find the fork branch (search for `visibility: overrides?.visibility ?? "private"`) and change:
```typescript
visibility: overrides?.visibility ?? "private",
```
to:
```typescript
visibility: overrides?.visibility ?? "public",
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/library/services/implementations/LibraryRepository.ts
git commit -m "feat: default fork visibility to public"
```

---

## Task 2: Add hasMatchingContent to LibraryRepository

**Files:**
- Modify: `src/lib/features/library/services/contracts/ILibraryRepository.ts`
- Modify: `src/lib/features/library/services/implementations/LibraryRepository.ts`

- [ ] **Step 1: Add method to interface**

In `ILibraryRepository.ts`, add to the CRUD OPERATIONS section (after `getSequences`):

```typescript
  /**
   * Check if a sequence with this content hash already exists in the user's library.
   * Used by the action bar to determine whether to show Save or Edit.
   * @param contentHash SHA-256 hash of motion content
   * @returns true if a matching sequence exists
   */
  hasMatchingContent(contentHash: string): Promise<boolean>;
```

- [ ] **Step 2: Implement the method**

In `LibraryRepository.ts`, add the implementation. Find a suitable spot near the other query methods. Use the existing Firestore query pattern from the class:

```typescript
  async hasMatchingContent(contentHash: string): Promise<boolean> {
    if (!contentHash) return false;

    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const sequencesRef = collection(
      firestore,
      getUserSequencesPath(userId)
    );

    const duplicateQuery = query(
      sequencesRef,
      where("contentHash", "==", contentHash),
      limit(1)
    );

    const snapshot = await getDocs(duplicateQuery);
    return !snapshot.empty;
  }
```

Note: `getFirestoreInstance`, `getUserSequencesPath`, `query`, `where`, `limit`, `getDocs` are already imported in this file. `this.getUserId()` is an existing private method.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/library/services/contracts/ILibraryRepository.ts src/lib/features/library/services/implementations/LibraryRepository.ts
git commit -m "feat: add hasMatchingContent to LibraryRepository for save-state detection"
```

---

## Task 3: Cross-User Favorites Resolution in CollectionManager

**Files:**
- Modify: `src/lib/features/library/services/implementations/CollectionManager.ts:443-459`

The current `getCollectionSequences()` calls `batchFetchSequences()` which only queries `users/{currentUser}/sequences/`. When a user favorites someone else's public sequence, that ID won't resolve. We need a two-pass approach.

- [ ] **Step 1: Add public sequence fallback to getCollectionSequences**

Replace the current `getCollectionSequences` method (lines ~443-460) with:

```typescript
  async getCollectionSequences(
    collectionId: string
  ): Promise<LibrarySequence[]> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const collectionData = await this.getCollection(collectionId);

    if (!collectionData || collectionData.sequenceIds.length === 0) {
      return [];
    }

    // Pass 1: fetch from user's own library
    const ownSequences = await this.batchFetchSequences(
      firestore,
      userId,
      collectionData.sequenceIds
    );

    // If all IDs resolved, we're done
    if (ownSequences.length === collectionData.sequenceIds.length) {
      return ownSequences;
    }

    // Pass 2: find which IDs didn't resolve and try the public index
    const foundIds = new Set(ownSequences.map((s) => s.id));
    const missingIds = collectionData.sequenceIds.filter(
      (id) => !foundIds.has(id)
    );

    if (missingIds.length === 0) return ownSequences;

    const publicSequences = await this.batchFetchPublicSequences(
      firestore,
      missingIds
    );

    return [...ownSequences, ...publicSequences];
  }
```

- [ ] **Step 2: Add batchFetchPublicSequences helper**

Add a new private method after `batchFetchSequences`:

```typescript
  private async batchFetchPublicSequences(
    firestore: Firestore,
    sequenceIds: string[]
  ): Promise<LibrarySequence[]> {
    const results: LibrarySequence[] = [];
    const chunks = this.chunkArray(sequenceIds, 30);

    for (const chunk of chunks) {
      const publicRef = collection(firestore, "publicSequences");
      const q = query(publicRef, where(documentId(), "in", chunk));
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        // Map public index doc to LibrarySequence shape for display
        results.push({
          id: docSnap.id,
          ...data,
          // Public sequences don't have library-specific fields, provide defaults
          source: "imported" as const,
          visibility: "public" as const,
          collectionIds: [],
          sequenceTags: [],
          tagIds: [],
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
          updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
        } as LibrarySequence);
      }
    }

    return results;
  }
```

Note: `chunkArray` is already a private method on this class. Import `documentId` from `firebase/firestore` if not already imported — check the existing imports at the top of the file.

- [ ] **Step 3: Check imports**

Verify `documentId` is imported from `firebase/firestore`. If not, add it to the existing import block. Also verify `Firestore` type is imported for the parameter type.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/library/services/implementations/CollectionManager.ts
git commit -m "feat: two-pass favorites resolution for cross-user sequences"
```

---

## Task 4: Create OverflowMenu Component

**Files:**
- Create: `src/lib/shared/ui/components/OverflowMenu.svelte`

- [ ] **Step 1: Check directory exists**

Run: `ls src/lib/shared/ui/components/` — if it doesn't exist, create it.

- [ ] **Step 2: Create OverflowMenu.svelte**

```svelte
<!--
  OverflowMenu - Three-dot dropdown for secondary actions

  Displays a vertical three-dot icon button. On click, opens a positioned
  dropdown with action items. Closes on outside click or Escape.
-->
<script lang="ts">
  interface MenuItem {
    label: string;
    icon: string;
    action: () => void;
    variant?: "danger";
  }

  interface Props {
    items: MenuItem[];
  }

  const { items }: Props = $props();

  let open = $state(false);
  let menuEl: HTMLElement | null = $state(null);

  function toggle() {
    open = !open;
  }

  function handleItemClick(item: MenuItem) {
    open = false;
    item.action();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      open = false;
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    if (menuEl && !menuEl.contains(e.target as Node)) {
      open = false;
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener("click", handleOutsideClick, true);
      return () => document.removeEventListener("click", handleOutsideClick, true);
    }
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overflow-menu" bind:this={menuEl} onkeydown={handleKeydown}>
  <button
    type="button"
    class="overflow-trigger"
    onclick={toggle}
    aria-label="More actions"
    aria-expanded={open}
    aria-haspopup="menu"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  </button>

  {#if open}
    <div class="overflow-dropdown" role="menu">
      {#each items as item}
        <button
          type="button"
          class="overflow-item"
          class:danger={item.variant === "danger"}
          role="menuitem"
          onclick={() => handleItemClick(item)}
        >
          <i class={item.icon} aria-hidden="true"></i>
          <span>{item.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .overflow-menu {
    position: relative;
  }

  .overflow-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--touch-target-min, 44px);
    height: var(--touch-target-min, 44px);
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .overflow-trigger:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .overflow-trigger:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .overflow-dropdown {
    position: absolute;
    bottom: calc(100% + 6px);
    right: 0;
    min-width: 180px;
    padding: 4px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 50;
  }

  .overflow-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .overflow-item:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  .overflow-item:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .overflow-item i {
    width: 18px;
    text-align: center;
    font-size: 14px;
  }

  .overflow-item.danger {
    color: var(--semantic-error);
  }

  .overflow-item.danger:hover {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .overflow-trigger,
    .overflow-item {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/ui/components/OverflowMenu.svelte
git commit -m "feat: add reusable OverflowMenu component for secondary actions"
```

---

## Task 5: Rewrite SequenceActionButtons (Browse)

**Files:**
- Modify: `src/lib/features/browse/sequences/display/components/SequenceActionButtons.svelte`

This is a full rewrite of the component's props and template. The styling stays mostly the same.

- [ ] **Step 1: Update Props interface and destructuring**

Replace the current `<script>` block (lines 12-41) with:

```typescript
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import OverflowMenu from "$lib/shared/ui/components/OverflowMenu.svelte";

  interface Props {
    isLoggedIn?: boolean;
    isOwned?: boolean;
    isSaved?: boolean;
    isPublished?: boolean;
    isFavorite?: boolean;
    videoCount?: number;
    onFavorite?: () => void;
    onSave?: () => void;
    onEdit?: () => void;
    onShare?: () => void;
    onSendTo?: () => void;
    onVideos?: () => void;
    onDelete?: () => void;
    onMaximize?: () => void;
    onPublish?: () => void;
    onUnpublish?: () => void;
  }

  const {
    isLoggedIn = false,
    isOwned = false,
    isSaved = true,
    isPublished = true,
    isFavorite = false,
    videoCount = 0,
    onFavorite = () => {},
    onSave = () => {},
    onEdit = () => {},
    onShare = () => {},
    onSendTo,
    onVideos = () => {},
    onDelete = () => {},
    onMaximize = () => {},
    onPublish = () => {},
    onUnpublish = () => {},
  }: Props = $props();

  // Overflow menu items for owned sequences
  const overflowItems = $derived.by(() => {
    const items: { label: string; icon: string; action: () => void; variant?: "danger" }[] = [];

    if (isPublished) {
      items.push({ label: "Make Private", icon: "fas fa-eye-slash", action: onUnpublish });
    } else {
      items.push({ label: "Make Public", icon: "fas fa-eye", action: onPublish });
    }

    items.push({ label: "Delete", icon: "fas fa-trash", action: onDelete, variant: "danger" as const });

    return items;
  });
</script>
```

- [ ] **Step 2: Replace the template**

Replace everything between `</script>` and `<style>` with:

```svelte
<div class="action-buttons">
  {#if !isLoggedIn}
    <!-- Not logged in: no actions in browse detail panel -->
    <!-- (Get App button is shown in the route viewer, not the browse detail) -->
  {:else}
    <!-- Favorite button (always shown for logged-in users) -->
    <button
      class="action-btn"
      class:favorited={isFavorite}
      onclick={onFavorite}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
    </button>

    <!-- Save button (only when content is new/modified and unsaved) -->
    {#if isOwned && !isSaved}
      <button
        class="action-btn action-btn-primary"
        onclick={onSave}
        aria-label="Save sequence"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>{t('browse_save')}</span>
      </button>
    {/if}

    <!-- Edit button (owner only, when sequence is saved) -->
    {#if isOwned && isSaved}
      <button
        class="action-btn"
        onclick={onEdit}
        aria-label={t('browse_edit_sequence')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    {/if}

    <!-- Share button -->
    <button
      class="action-btn"
      onclick={onShare}
      aria-label={t('browse_share_sequence')}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    </button>

    <!-- Send to button -->
    {#if onSendTo}
      <button
        class="action-btn"
        onclick={onSendTo}
        aria-label="Send sequence to a friend"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    {/if}

    <!-- Videos button -->
    <button
      class="action-btn action-btn-videos"
      onclick={onVideos}
      aria-label={videoCount > 0 ? t('browse_view_videos', { count: String(videoCount) }) : t('browse_record_performance')}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
      {#if videoCount > 0}
        <span class="video-count">{videoCount}</span>
      {:else}
        <span>{t('browse_record')}</span>
      {/if}
    </button>

    <!-- Overflow menu (owner only, when saved) — contains Publish/Unpublish + Delete -->
    {#if isOwned && isSaved}
      <OverflowMenu items={overflowItems} />
    {/if}

    <!-- Maximize button -->
    <button
      class="action-btn action-btn-maximize"
      onclick={onMaximize}
      aria-label={t('browse_maximize_details')}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
      <span>{t('browse_maximize')}</span>
    </button>
  {/if}
</div>
```

- [ ] **Step 3: Keep existing styles, add .favorited style for the non-primary heart button**

The existing styles can stay. The `.favorited` class is already styled. Remove the `.action-btn-primary.favorited` styles since the heart is no longer the primary button. The `.action-btn-danger` styles can be removed since Delete moves to overflow.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: May have errors in SequenceDetailContent since we changed props. Fix in next task.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/browse/sequences/display/components/SequenceActionButtons.svelte
git commit -m "feat: context-aware action buttons in browse detail panel"
```

---

## Task 6: Update SequenceDetailContent to Pass New Props

**Files:**
- Modify: `src/lib/features/browse/sequences/display/components/SequenceDetailContent.svelte`

- [ ] **Step 1: Add state for isSaved and isFavorite**

After the existing state declarations (around line 60), add:

```typescript
  import type { ICollectionManager } from "$lib/features/library/services/contracts/ICollectionManager";
  import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";

  // Save state detection
  let isSaved = $state(true); // Default: assume saved (hide Save button while checking)
  let isFavorite = $state(false);
  let libraryRepo = $state<ILibraryRepository | null>(null);
  let collectionManager = $state<ICollectionManager | null>(null);

  // Content hash cache (avoids re-querying Firestore for same hash)
  const savedHashCache = new Map<string, boolean>();
```

- [ ] **Step 2: Resolve services in onMount**

In the existing `onMount` block (line 144), add:

```typescript
    libraryRepo = container.items.libraryRepository;
    collectionManager = container.items.collectionManager;
```

- [ ] **Step 3: Add effect to derive isSaved and isFavorite**

After the existing video count effect (around line 208), add:

```typescript
  // Check if sequence is already saved in user's library (by content hash)
  $effect(() => {
    const currentSequence = sequence;
    const repo = libraryRepo;

    isSaved = true; // Optimistic: hide Save while loading

    if (!repo || !currentSequence?.contentHash || !currentUserId) return;

    const hash = currentSequence.contentHash;

    // Check cache first
    if (savedHashCache.has(hash)) {
      isSaved = savedHashCache.get(hash)!;
      return;
    }

    untrack(() => {
      repo.hasMatchingContent(hash)
        .then((found) => {
          savedHashCache.set(hash, found);
          if (sequence.id === currentSequence.id) {
            isSaved = found;
          }
        })
        .catch(() => {
          // On error, keep Save hidden (safe default)
        });
    });
  });

  // Check if sequence is favorited
  $effect(() => {
    const currentSequence = sequence;
    const cm = collectionManager;

    isFavorite = false;

    if (!cm || !currentSequence) return;

    untrack(() => {
      cm.isFavorite(currentSequence.id)
        .then((fav) => {
          if (sequence.id === currentSequence.id) {
            isFavorite = fav;
          }
        })
        .catch(() => {});
    });
  });
```

- [ ] **Step 4: Add publish/unpublish handlers**

Add after the existing `handleAction` function:

```typescript
  async function handleFavoriteToggle() {
    hapticService?.trigger("selection");
    // Optimistic update
    isFavorite = !isFavorite;
    try {
      await collectionManager?.toggleFavorite(sequence.id);
    } catch {
      // Revert on error
      isFavorite = !isFavorite;
    }
  }

  function handlePublish() {
    hapticService?.trigger("selection");
    onAction("publish", sequence);
  }

  let unpublishConfirmOpen = $state(false);

  function handleUnpublishRequest() {
    hapticService?.trigger("selection");
    unpublishConfirmOpen = true;
  }

  function handleUnpublishConfirm() {
    unpublishConfirmOpen = false;
    onAction("unpublish", sequence);
  }
```

- [ ] **Step 5: Update SequenceActionButtons usage**

Replace lines 407-418:

```svelte
  <SequenceActionButtons
    isLoggedIn={!!currentUserId}
    {isOwned}
    {isSaved}
    isPublished={sequence.visibility === "public"}
    {isFavorite}
    {videoCount}
    onFavorite={handleFavoriteToggle}
    onSave={() => handleAction("save")}
    onEdit={() => handleAction("edit")}
    onShare={() => handleAction("share")}
    onSendTo={handleSendTo}
    onVideos={handleVideosClick}
    onDelete={() => handleAction("delete")}
    onMaximize={handleMaximize}
    onPublish={handlePublish}
    onUnpublish={handleUnpublishRequest}
  />
```

- [ ] **Step 6: Add unpublish confirmation dialog**

After the `SequenceActionButtons` block, add a simple confirmation dialog. Reuse the existing dialog pattern from the codebase (the `DeleteConfirmDialog` is a reference). Add this markup:

```svelte
  {#if unpublishConfirmOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="confirm-backdrop" onclick={() => (unpublishConfirmOpen = false)} onkeydown={(e) => { if (e.key === "Escape") unpublishConfirmOpen = false; }}>
      <div class="confirm-dialog" role="alertdialog" aria-label="Confirm unpublish" onclick|stopPropagation>
        <p>Remove from community gallery? This sequence will still be in your library but won't appear in Browse.</p>
        <div class="confirm-actions">
          <button type="button" onclick={() => (unpublishConfirmOpen = false)}>Cancel</button>
          <button type="button" class="confirm-danger" onclick={handleUnpublishConfirm}>Make Private</button>
        </div>
      </div>
    </div>
  {/if}
```

Add minimal scoped styles for the dialog (backdrop with dark overlay, centered card, two buttons). The implementer should match the existing `DeleteConfirmDialog` styling pattern.

- [ ] **Step 7: Verify `untrack` import exists**

Check that `import { untrack } from "svelte"` is present at the top of the file. It should already be there (line 26 of the original file). If not, add it.

- [ ] **Step 8: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 9: Commit**

```bash
git add src/lib/features/browse/sequences/display/components/SequenceDetailContent.svelte
git commit -m "feat: derive isSaved/isFavorite and pass to action buttons"
```

---

## Task 7: Add Publish/Unpublish to BrowseEventHandler

**Files:**
- Modify: `src/lib/features/browse/shared/services/implementations/BrowseEventHandler.ts`

- [ ] **Step 1: Add publish and unpublish cases**

In `handleSequenceAction` (around line 58), add before the `default` case:

```typescript
        case "publish":
          await this.handlePublish(sequence);
          break;
        case "unpublish":
          await this.handleUnpublish(sequence);
          break;
```

And in `handleDetailPanelAction` (around line 151), add before the `default` case:

```typescript
      case "publish":
        await this.handlePublish(sequence);
        break;
      case "unpublish":
        await this.handleUnpublish(sequence);
        break;
```

- [ ] **Step 2: Add handler methods**

Add to the class:

```typescript
  private async handlePublish(sequence: SequenceData): Promise<void> {
    this.ensureInitialized();
    try {
      const libraryRepo = container.items.libraryRepository;
      await libraryRepo.publishSequence(sequence.id);
    } catch (err) {
      console.error("Failed to publish:", err);
      this.params!.setError(
        err instanceof Error ? err.message : "Failed to publish sequence"
      );
    }
  }

  private async handleUnpublish(sequence: SequenceData): Promise<void> {
    this.ensureInitialized();
    try {
      const libraryRepo = container.items.libraryRepository;
      await libraryRepo.unpublishSequence(sequence.id);
      // Remove from browse gallery cache immediately
      this.loaderService?.removeFromCache?.(sequence.id);
    } catch (err) {
      console.error("Failed to unpublish:", err);
      this.params!.setError(
        err instanceof Error ? err.message : "Failed to unpublish sequence"
      );
    }
  }
```

Add the container import at the top:

```typescript
import { container } from "$lib/shared/di";
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors. `removeFromCache` exists on `IBrowseLoader`. The `loaderService` property on `BrowseEventHandler` is typed as `IBrowseLoader | null` (passed via constructor).

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/shared/services/implementations/BrowseEventHandler.ts
git commit -m "feat: add publish/unpublish handlers to BrowseEventHandler"
```

---

## Task 8: Switch Browse State Favorites to CollectionManager

**Files:**
- Modify: `src/lib/features/browse/shared/state/browse-state-factory.svelte.ts`

- [ ] **Step 1: Update the toggleFavorite function**

Replace the existing `toggleFavorite` function (lines ~365-395) to use `CollectionManager` instead of `FavoritesManager`:

```typescript
  async function toggleFavorite(sequenceId: string): Promise<void> {
    const collectionManager = container.items.collectionManager;
    if (!collectionManager) return;

    try {
      const newStatus = await collectionManager.toggleFavorite(sequenceId);

      // Update local state for all arrays
      const updateSequence = (seq: SequenceData) =>
        seq.id === sequenceId ? { ...seq, isFavorite: newStatus } : seq;

      allSequences = allSequences.map(updateSequence);
      displayedSequences = displayedSequences.map(updateSequence);
      filteredSequences = filteredSequences.map(updateSequence);

      sequenceSections = sequenceSections.map((section) => ({
        ...section,
        sequences: section.sequences.map(updateSequence),
      }));

      if (selectedSequence?.id === sequenceId) {
        selectedSequence = { ...selectedSequence, isFavorite: newStatus };
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  }
```

- [ ] **Step 2: Remove or deprecate FavoritesManager import**

If `FavoritesManager` is only used for `toggleFavorite` and `isFavorite`, remove the import and usage. Check if it's used elsewhere in the file before removing.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/shared/state/browse-state-factory.svelte.ts
git commit -m "feat: switch browse favorites to CollectionManager (canonical system)"
```

---

## Task 9: Update ViewerFooter + ViewerMorphToolbar (Route Viewer)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte`

These components need the same context-aware logic as SequenceActionButtons.

- [ ] **Step 1: Add new props to ViewerFooter**

Add to the `Props` interface (after `videoCount`):

```typescript
    isSaved?: boolean;
    isPublished?: boolean;
    isFavorite?: boolean;
    onFavorite?: () => void;
    onPublish?: () => void;
    onUnpublish?: () => void;
```

And destructure them with defaults:

```typescript
    isSaved = true,
    isPublished = true,
    isFavorite = false,
    onFavorite,
    onPublish,
    onUnpublish,
```

- [ ] **Step 2: Thread new props to ViewerMorphToolbar**

In the `ViewerMorphToolbar` usage (line ~229), add the new props:

```svelte
    <ViewerMorphToolbar
      ...existing props...
      {isSaved}
      {isPublished}
      {isFavorite}
      {onFavorite}
      {onPublish}
      {onUnpublish}
    />
```

- [ ] **Step 3: Update desktop layout actions section**

Replace the actions section in the desktop layout (lines ~300-356) with context-aware buttons:

```svelte
        <div class="actions-section">
          {#if isLoggedIn}
            <!-- Favorite heart -->
            {#if onFavorite}
              <button
                type="button"
                class="action-btn"
                class:favorited={isFavorite}
                onclick={onFavorite}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <i class="fas fa-heart" aria-hidden="true"></i>
                <span>{isFavorite ? "Favorited" : "Favorite"}</span>
              </button>
            {/if}

            <!-- Save (only when unsaved) -->
            {#if isOwned && !isSaved}
              <button
                type="button"
                class="action-btn save"
                onclick={onSave}
                aria-label="Save sequence"
              >
                <i class="fas fa-floppy-disk" aria-hidden="true"></i>
                <span>Save</span>
              </button>
            {/if}

            <!-- Edit (owner only, when saved) -->
            {#if isOwned && isSaved}
              <button
                type="button"
                class="action-btn edit"
                onclick={onEdit}
                aria-label="Edit"
              >
                <i class="fas fa-pen-to-square" aria-hidden="true"></i>
                <span>Edit</span>
              </button>
            {/if}
          {:else}
            <button
              type="button"
              class="action-btn get-app"
              onclick={onGetApp}
              aria-label="Get TKA Scribe"
            >
              <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
              <span>Get App</span>
            </button>
          {/if}
          {#if isLoggedIn && onVideoUpload}
            <button
              type="button"
              class="action-btn video"
              onclick={onVideoUpload}
              aria-label="Upload video"
            >
              <i class="fas fa-video" aria-hidden="true"></i>
              <span>Video</span>
              {#if videoCount && videoCount > 0}
                <span class="video-badge">{videoCount}</span>
              {/if}
            </button>
          {/if}
          {#if isOwned && isSaved}
            <button
              type="button"
              class="action-btn"
              onclick={isPublished ? onUnpublish : onPublish}
              aria-label={isPublished ? "Make Private" : "Make Public"}
            >
              <i class="fas {isPublished ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
              <span>{isPublished ? "Make Private" : "Make Public"}</span>
            </button>
            {#if onDeleteRequest}
              <button
                type="button"
                class="action-btn delete"
                onclick={onDeleteRequest}
                aria-label="Delete sequence"
              >
                <i class="fas fa-trash" aria-hidden="true"></i>
                <span>Delete</span>
              </button>
            {/if}
          {/if}
        </div>
```

- [ ] **Step 4: Update landscape layout similarly**

Replace the landscape action buttons section (lines ~178-219) with the same context-aware logic. Key changes: remove the unconditional Save button, add Favorite heart, conditionally show Edit only when owned+saved.

- [ ] **Step 5: Add new props to ViewerMorphToolbar**

Add the same props to `ViewerMorphToolbar.svelte`'s interface and destructuring, then update its action buttons (lines ~95-150) to match the same context-aware logic.

- [ ] **Step 6: Add .favorited style for the heart button**

Add to ViewerFooter styles:

```css
  .action-btn.favorited {
    color: var(--semantic-error);
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  .action-btn.favorited:hover {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
  }
```

- [ ] **Step 7: Run typecheck**

Run: `npm run check`
Expected: Errors in SequenceViewerOrchestrator (needs to pass new props). Fix in next task.

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerFooter.svelte src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte
git commit -m "feat: context-aware action buttons in route viewer footer"
```

---

## Task 10: Wire SequenceViewerOrchestrator + Consumer Components

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`
- Modify: `src/routes/sequence/[id]/+page.svelte` (passes ctx props to ViewerFooter)
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` (passes ctx props to ViewerFooter)

**Architecture note:** `SequenceViewerOrchestrator` does NOT render `ViewerFooter` directly. It builds a `ctx` object and passes it to children via a Svelte snippet: `{#snippet children(ctx)}`. The actual `ViewerFooter` is rendered by `+page.svelte` (route viewer) and `SequenceViewerDrawerHost.svelte` (browse drawer), which read properties from `ctx`. So: add state + handlers to the orchestrator's ctx, then update the two consumer components to thread `ctx.isSaved`, `ctx.isFavorite`, etc. to `ViewerFooter`.

- [ ] **Step 1: Add isSaved/isFavorite/isPublished state**

Near the existing `isOwned` derivation (line ~410), add:

```typescript
  import type { ICollectionManager } from "$lib/features/library/services/contracts/ICollectionManager";
  import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";

  let isSaved = $state(true);
  let isFavorite = $state(false);
  const isPublished = $derived(sequence?.visibility === "public");

  // Content hash cache
  const savedHashCache = new Map<string, boolean>();
```

- [ ] **Step 2: Add effects to check isSaved and isFavorite**

```typescript
  // Check if this sequence is already saved
  $effect(() => {
    const seq = sequence;
    if (!seq?.contentHash || !authState.user?.uid) {
      isSaved = true;
      return;
    }

    const hash = seq.contentHash;
    if (savedHashCache.has(hash)) {
      isSaved = savedHashCache.get(hash)!;
      return;
    }

    const repo = container.items.libraryRepository as ILibraryRepository;
    repo.hasMatchingContent(hash)
      .then((found) => {
        savedHashCache.set(hash, found);
        if (sequence?.id === seq.id) isSaved = found;
      })
      .catch(() => {});
  });

  // Check favorite status
  $effect(() => {
    const seq = sequence;
    if (!seq) { isFavorite = false; return; }

    const cm = container.items.collectionManager as ICollectionManager;
    cm.isFavorite(seq.id)
      .then((fav) => { if (sequence?.id === seq.id) isFavorite = fav; })
      .catch(() => {});
  });
```

- [ ] **Step 3: Add handler functions**

```typescript
  function handleFavoriteToggle() {
    if (!sequence) return;
    isFavorite = !isFavorite; // optimistic
    const cm = container.items.collectionManager as ICollectionManager;
    cm.toggleFavorite(sequence.id).catch(() => { isFavorite = !isFavorite; });
  }

  async function handlePublish() {
    if (!sequence) return;
    const repo = container.items.libraryRepository as ILibraryRepository;
    await repo.publishSequence(sequence.id);
  }

  async function handleUnpublish() {
    if (!sequence) return;
    const repo = container.items.libraryRepository as ILibraryRepository;
    await repo.unpublishSequence(sequence.id);
  }
```

- [ ] **Step 4: Add new properties to the orchestrator's ctx object**

In the ctx object (around line 1437, near `isOwned`), add:

```typescript
    isSaved,
    isPublished,
    isFavorite,
    handleFavoriteToggle,
    handlePublish,
    handleUnpublish,
```

- [ ] **Step 5: Update +page.svelte to thread ctx props to ViewerFooter**

In `src/routes/sequence/[id]/+page.svelte`, find the `<ViewerFooter` usage (around line 696) and add the new props:

```svelte
              <ViewerFooter
                ...existing props...
                isSaved={ctx.isSaved}
                isPublished={ctx.isPublished}
                isFavorite={ctx.isFavorite}
                onFavorite={ctx.handleFavoriteToggle}
                onPublish={ctx.handlePublish}
                onUnpublish={ctx.handleUnpublish}
              />
```

- [ ] **Step 6: Update SequenceViewerDrawerHost.svelte similarly**

In `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`, find the `<ViewerFooter` usage (around line 471) and add the same props from ctx.

- [ ] **Step 8: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 9: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte src/routes/sequence/[id]/+page.svelte src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "feat: wire isSaved/isFavorite/publish state to sequence viewer"
```

---

## Task 11: Verification

- [ ] **Step 1: Full typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run existing tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Manual verification checklist**

Ask the user to verify in the running app:
1. Open someone else's public sequence → see Favorite heart + Share (no Save, no Edit, no Fork)
2. Open your own published sequence → see Favorite + Edit + Share + overflow menu (Make Private, Delete)
3. Open your own unpublished sequence → see Favorite + Edit + Share + overflow menu (Make Public, Delete)
4. Create a new sequence, don't save → see Save button
5. Favorite someone else's sequence → heart fills, persists across page refresh
6. Click Make Private on your sequence → disappears from Browse gallery
7. Click Make Public → reappears in Browse gallery
8. Not logged in → see Get App button only
