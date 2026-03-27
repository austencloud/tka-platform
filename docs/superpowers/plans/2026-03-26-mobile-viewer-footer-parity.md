# Mobile Viewer Footer Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile sequence viewer footer's expand/collapse toolbar with a two-row always-visible layout that has full feature parity with the desktop footer.

**Architecture:** The existing `ViewerFooter.svelte` uses a ResizeObserver to switch between "desktop" (>= 960px) and "mid" layouts. The "mid" layout delegates to `ViewerMorphToolbar`, which hides controls behind a toggle. We replace the "mid" layout with an inline two-row layout, create a new `ViewerOverflowMenu` for secondary actions, and clean up `TempoControl` to remove its internal mobile detection.

**Transport note:** The new mobile transport has 3 buttons: restart, play/pause, next beat. `onStepBack` (full beat backward) is intentionally replaced by `onRestartToStart` — restart is more useful on mobile. Half-step controls (`onStepHalfBack`, `onStepHalfForward`) are excluded from mobile per spec.

**Tech Stack:** Svelte 5, TypeScript, CSS custom properties, WAI-ARIA menu pattern

**Spec:** `docs/superpowers/specs/2026-03-26-mobile-viewer-footer-parity-design.md`

---

### Task 1: Create ViewerOverflowMenu component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/ViewerOverflowMenu.svelte`

This component is needed by Task 3 (the footer rewrite), so build it first.

- [ ] **Step 1: Create ViewerOverflowMenu.svelte**

```svelte
<!--
  ViewerOverflowMenu.svelte

  Three-dot overflow menu for secondary sequence viewer actions.
  Opens a popover above the trigger with labeled action buttons.
  WAI-ARIA menu pattern with keyboard navigation.
-->
<script lang="ts">
  interface Props {
    isPublished?: boolean;
    onCopyLink?: () => void;
    linkCopied?: boolean;
    onPropsOpen?: () => void;
    onPublish?: () => void;
    onUnpublish?: () => void;
    onExportImage?: () => void;
    onDeleteRequest?: () => void;
  }

  let {
    isPublished = false,
    onCopyLink,
    linkCopied = false,
    onPropsOpen,
    onPublish,
    onUnpublish,
    onExportImage,
    onDeleteRequest,
  }: Props = $props();

  let isOpen = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);
  let menuEl: HTMLDivElement | null = $state(null);

  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      // Focus first menu item after render
      requestAnimationFrame(() => {
        const firstItem = menuEl?.querySelector<HTMLButtonElement>('[role="menuitem"]');
        firstItem?.focus();
      });
    }
  }

  function close() {
    isOpen = false;
    triggerEl?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen || !menuEl) return;

    const items = Array.from(menuEl.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prev]?.focus();
    } else if (e.key === "Tab") {
      e.preventDefault();
      close();
    }
  }

  function handleItemClick(action: (() => void) | undefined) {
    action?.();
    close();
  }

  // Build menu items dynamically based on available actions
  let menuItems = $derived.by(() => {
    const items: Array<{ label: string; icon: string; action: () => void; className?: string }> = [];

    if (onPropsOpen) {
      items.push({ label: "Props", icon: "fa-wand-magic-sparkles", action: onPropsOpen });
    }
    if (onCopyLink) {
      items.push({
        label: linkCopied ? "Copied!" : "Copy Link",
        icon: linkCopied ? "fa-check" : "fa-link",
        action: onCopyLink,
        className: linkCopied ? "copied" : undefined,
      });
    }
    if (onPublish || onUnpublish) {
      items.push({
        label: isPublished ? "Make Private" : "Make Public",
        icon: isPublished ? "fa-eye-slash" : "fa-eye",
        action: (isPublished ? onUnpublish : onPublish) ?? (() => {}),
      });
    }
    if (onExportImage) {
      items.push({ label: "Export Image", icon: "fa-image", action: onExportImage });
    }
    if (onDeleteRequest) {
      items.push({
        label: "Delete",
        icon: "fa-trash",
        action: onDeleteRequest,
        className: "delete",
      });
    }

    return items;
  });

  // Don't render the trigger if there are no menu items
  let hasItems = $derived(menuItems.length > 0);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if hasItems}
  <div class="overflow-wrapper" onkeydown={handleKeydown}>
    <button
      bind:this={triggerEl}
      type="button"
      class="overflow-trigger"
      onclick={toggle}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-label="More actions"
    >
      <i class="fas fa-ellipsis-vertical" aria-hidden="true"></i>
    </button>

    {#if isOpen}
      <!-- Backdrop -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="overflow-backdrop" onclick={close} onkeydown={() => {}}></div>

      <!-- Menu popover -->
      <div bind:this={menuEl} class="overflow-popover" role="menu" aria-label="More actions">
        {#each menuItems as item}
          <button
            type="button"
            role="menuitem"
            class="overflow-item {item.className ?? ''}"
            onclick={() => handleItemClick(item.action)}
            tabindex={-1}
          >
            <i class="fas {item.icon}" aria-hidden="true"></i>
            <span>{item.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .overflow-wrapper {
    position: relative;
  }

  .overflow-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 16px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    .overflow-trigger:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .overflow-trigger:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .overflow-trigger:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .overflow-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .overflow-popover {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    z-index: 100;
    min-width: 180px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 4px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .overflow-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 44px;
    padding: 0 12px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }

  .overflow-item i {
    width: 20px;
    text-align: center;
    font-size: 14px;
  }

  .overflow-item:hover,
  .overflow-item:focus {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
    outline: none;
  }

  .overflow-item.delete {
    color: var(--semantic-error, #ef4444);
  }

  .overflow-item.delete:hover,
  .overflow-item.delete:focus {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    color: var(--semantic-error, #ef4444);
  }

  .overflow-item.copied {
    color: var(--semantic-success, #22c55e);
  }

  @media (prefers-reduced-motion: reduce) {
    .overflow-trigger {
      transition: none;
    }
    .overflow-trigger:active {
      transform: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error --output human 2>&1 | grep -i "ViewerOverflowMenu" || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerOverflowMenu.svelte
git commit -m "feat(viewer): add ViewerOverflowMenu component for secondary actions"
```

---

### Task 2: Clean up TempoControl mobile detection

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/TempoControl.svelte`

Remove the internal `isMobile` state and `window.innerWidth < 768` resize listener. Preset visibility becomes purely prop-driven via the existing `showPresets` prop.

- [ ] **Step 1: Remove isMobile state and resize listener**

In `TempoControl.svelte`, delete the mobile detection block (lines 66-76):

```typescript
// DELETE this entire block:
// Mobile detection
let isMobile = $state(false);

$effect(() => {
  if (typeof window !== "undefined") {
    const check = () => { isMobile = window.innerWidth < 768; };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }
  return undefined;
});
```

- [ ] **Step 2: Update preset condition**

Change line 223 from:
```svelte
{#if showPresets && !isMobile}
```
to:
```svelte
{#if showPresets}
```

- [ ] **Step 3: Remove mobile class binding**

Change line 180 from:
```svelte
<div class="tempo-control" class:mobile={isMobile}>
```
to:
```svelte
<div class="tempo-control">
```

- [ ] **Step 4: Remove .tempo-control.mobile CSS rule**

Delete lines 262-264:
```css
.tempo-control.mobile {
  gap: 8px;
}
```

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error --output human 2>&1 | grep -i "TempoControl\|error" | head -20`

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/TempoControl.svelte
git commit -m "refactor(viewer): remove TempoControl internal mobile detection, preset visibility is now purely prop-driven"
```

---

### Task 3: Rewrite ViewerFooter mid-layout

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte`

Replace the `ViewerMorphToolbar` usage in the "mid" layout with inline two-row layout.

- [ ] **Step 1: Update imports**

Replace the `ViewerMorphToolbar` import with `ViewerOverflowMenu`:

```typescript
// REMOVE:
import ViewerMorphToolbar from "./ViewerMorphToolbar.svelte";

// ADD:
import ViewerOverflowMenu from "./ViewerOverflowMenu.svelte";
```

- [ ] **Step 2: Replace the mid-layout block**

Replace the entire `{#if layout === "mid"}` block (lines 268-300, the `ViewerMorphToolbar` usage) with the new two-row layout:

```svelte
    <!-- Mid-width: Two-row layout with all controls visible -->
    <div class="mid-layout">
      <!-- Row 1: Tempo + Practice -->
      <div class="mid-tempo-row">
        <TempoControl
          {bpm}
          {onBpmChange}
          showPresets={true}
          practiceActive={practiceActive}
          onPracticeStart={onPracticeStart}
          onPracticeStop={onPracticeStop}
        />
      </div>

      <!-- Row 2: Transport + Actions -->
      <div class="mid-controls-row">
        <div class="mid-transport-group">
          {#if onRestartToStart}
            <button
              type="button"
              class="mid-step-btn"
              onclick={onRestartToStart}
              aria-label="Restart from beginning"
            >
              <i class="fas fa-backward-fast" aria-hidden="true"></i>
            </button>
          {/if}
          <button
            type="button"
            class="mid-play-btn"
            class:playing={isPlaying}
            onclick={onPlayPause}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="mid-step-btn"
            onclick={onStepForward}
            aria-label="Next beat"
          >
            <i class="fas fa-forward-step" aria-hidden="true"></i>
          </button>
        </div>

        <div class="mid-actions-group">
          {#if isLoggedIn}
            {#if onFavorite}
              <button
                type="button"
                class="mid-action-btn"
                class:favorited={isFavorite}
                onclick={onFavorite}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <i class="fas fa-heart" aria-hidden="true"></i>
              </button>
            {/if}

            {#if isOwned && !isSaved}
              <button
                type="button"
                class="mid-action-btn save"
                onclick={onSave}
                aria-label="Save sequence"
              >
                <i class="fas fa-floppy-disk" aria-hidden="true"></i>
              </button>
            {/if}

            {#if isOwned && isSaved}
              <button
                type="button"
                class="mid-action-btn edit"
                onclick={onEdit}
                aria-label="Remix"
              >
                <i class="fas fa-pen-to-square" aria-hidden="true"></i>
              </button>
            {/if}
          {:else}
            <button
              type="button"
              class="mid-get-app-btn"
              onclick={onGetApp}
              aria-label="Get TKA Composer"
            >
              <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
              <span>Get App</span>
            </button>
          {/if}

          {#if isLoggedIn && onVideoUpload}
            <button
              type="button"
              class="mid-action-btn video"
              onclick={onVideoUpload}
              aria-label="Upload video"
            >
              <i class="fas fa-video" aria-hidden="true"></i>
              {#if videoCount && videoCount > 0}
                <span class="video-badge video-badge-sm">{videoCount}</span>
              {/if}
            </button>
          {/if}

          <!-- Overflow menu renders for all users — it self-hides when no items -->
          <ViewerOverflowMenu
            {isPublished}
            onCopyLink={isLoggedIn ? onCopyLink : undefined}
            {linkCopied}
            onPropsOpen={isLoggedIn ? onPropsOpen : undefined}
            onPublish={isLoggedIn && isOwned && isSaved ? onPublish : undefined}
            onUnpublish={isLoggedIn && isOwned && isSaved ? onUnpublish : undefined}
            {onExportImage}
            onDeleteRequest={isLoggedIn && isOwned && isSaved ? onDeleteRequest : undefined}
          />
        </div>
      </div>
    </div>
```

- [ ] **Step 3: Add CSS for mid-layout**

Add these styles inside the `<style>` block, after the existing footer base styles:

```css
  /* ===========================
     MID-WIDTH TWO-ROW LAYOUT
     =========================== */

  .mid-layout {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .mid-tempo-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    flex-wrap: wrap;
  }

  .mid-controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 8px;
  }

  .mid-transport-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .mid-actions-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* Transport buttons (mid) */
  .mid-step-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    .mid-step-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .mid-step-btn:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .mid-step-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Play/Pause button (mid) */
  .mid-play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-accent, rgba(139, 92, 246, 0.4));
    color: var(--theme-accent, rgba(139, 92, 246, 1));
    font-size: var(--font-size-lg, 18px);
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px var(--theme-shadow, rgba(0, 0, 0, 0.2));
    -webkit-tap-highlight-color: transparent;
  }

  .mid-play-btn.playing {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  @media (hover: hover) and (pointer: fine) {
    .mid-play-btn:hover {
      transform: scale(1.05);
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    }
  }

  .mid-play-btn:active {
    transform: scale(0.92);
    transition-duration: 0ms;
  }

  .mid-play-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Icon-only action buttons (mid) */
  .mid-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 16px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    position: relative;
  }

  @media (hover: hover) and (pointer: fine) {
    .mid-action-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .mid-action-btn:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .mid-action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Color-coded mid action buttons */
  .mid-action-btn.save {
    border-color: rgba(34, 197, 94, 0.25);
    color: #22c55e;
  }

  .mid-action-btn.edit {
    border-color: rgba(245, 158, 11, 0.25);
    color: #f59e0b;
  }

  .mid-action-btn.favorited {
    color: var(--semantic-error);
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  .mid-action-btn.video {
    position: relative;
  }

  /* Get App pill button (logged-out state) */
  .mid-get-app-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 16px;
    background: rgba(34, 197, 94, 0.1);
    border: 1.5px solid rgba(34, 197, 94, 0.25);
    border-radius: 22px;
    color: #22c55e;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }

  @media (hover: hover) and (pointer: fine) {
    .mid-get-app-btn:hover {
      background: rgba(34, 197, 94, 0.2);
      border-color: rgba(34, 197, 94, 0.4);
    }
  }

  .mid-get-app-btn:active {
    transform: scale(0.95);
    transition-duration: 0ms;
  }

  .mid-get-app-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Mid-layout reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .mid-step-btn,
    .mid-play-btn,
    .mid-action-btn,
    .mid-get-app-btn {
      transition: none;
    }

    .mid-step-btn:active,
    .mid-play-btn:active,
    .mid-play-btn:hover,
    .mid-action-btn:active,
    .mid-get-app-btn:active {
      transform: none;
    }
  }
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error --output human 2>&1 | grep -i "ViewerFooter\|error" | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerFooter.svelte
git commit -m "feat(viewer): replace mobile MorphToolbar with two-row always-visible layout"
```

---

### Task 4: Delete ViewerMorphToolbar

**Files:**
- Delete: `src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "ViewerMorphToolbar" src/ --include="*.svelte" --include="*.ts"`

Expected: No results (the import was removed in Task 3).

- [ ] **Step 2: Delete the file**

```bash
rm src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build 2>&1 | tail -20`

Expected: Build succeeds with no import errors.

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte
git commit -m "chore(viewer): delete ViewerMorphToolbar, replaced by inline two-row layout"
```

---

### Task 5: Verify at multiple widths

**Files:** None (verification only)

- [ ] **Step 1: Run full type check**

Run: `npm run check 2>&1 | tail -10`

Expected: No errors.

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -10`

Expected: Build succeeds.

- [ ] **Step 3: Visual verification prompt**

Tell the user:
> "The mobile viewer footer is ready for visual testing. Open the sequence viewer at these widths and verify:
> - 375px: Two rows visible, speed presets may wrap
> - 414px: Two rows, all controls in line
> - 768px: Two rows, comfortable spacing
> - 959px: Still two-row layout
> - 960px+: Desktop single-row layout (unchanged)
> - Landscape: Vertical column on right (unchanged)
>
> Check: play/pause, step forward, restart, BPM +/-, speed presets, practice, favorite, save, remix, video, overflow menu."
