# Viewer Content Switcher & Customizable Split View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `editingPane` state with two orthogonal dimensions (`viewerMode` + `exportContext`), build a left content-switcher rail, and add per-pane content selectors in split view.

**Architecture:** The orchestrator's conflated `editingPane` (which controls both center viewport and right sidebar) splits into `viewerMode` (what's in the center) and `exportContext` (what's in the right sidebar). A new `ViewerContentRail` component replaces the gutter-back button. Each split pane gets a `PaneContentSelector` dropdown. A `VideoGallery` component provides center content for the Videos mode.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, CSS Grid, Font Awesome 6 (solid), localStorage

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/shared/sequence-viewer/state/viewer-state.svelte.ts` | ViewerMode + ExportContext + SplitConfig reactive state |
| Create | `src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts` | localStorage read/write + migration from old key |
| Create | `src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte` | Left rail: Back + Animation + Card + Videos |
| Create | `src/lib/shared/sequence-viewer/components/PaneContentSelector.svelte` | Per-pane dropdown chip |
| Create | `src/lib/shared/sequence-viewer/components/VideoGallery.svelte` | Center content for videos mode (refactored from VideoPanel) |
| Modify | `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` | Replace `editingPane` with viewer state |
| Modify | `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` | Replace gutter-back with ViewerContentRail; route center content |
| Modify | `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` | Accept configurable content types per pane |
| Modify | `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte` | Export buttons set exportContext (not enterEditMode) |
| Delete | `src/lib/shared/sequence-viewer/services/editing-pane-persistence.ts` | Replaced by viewer-state-persistence.ts |

---

### Task 1: Create viewer-state-persistence.ts

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts`

This is the persistence layer — reads/writes `viewerMode` and `splitConfig` to localStorage, handles migration from old `tka-viewer-editing-pane` key.

- [ ] **Step 1: Write the persistence module**

```typescript
// src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts

export type ContentType = 'animation' | 'card' | 'videos';
export type ViewerMode = 'split' | ContentType;
export type ExportContext = 'animation-export' | 'image-export' | null;

export interface SplitConfig {
  leftPane: ContentType;
  rightPane: ContentType;
}

const VIEWER_MODE_KEY = 'tka-viewer-mode';
const SPLIT_CONFIG_KEY = 'tka-viewer-split-config';
const LEGACY_EDITING_PANE_KEY = 'tka-viewer-editing-pane';

function migrateFromLegacy(): { viewerMode: ViewerMode; exportContext: ExportContext } | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEGACY_EDITING_PANE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const pane = parsed.pane as string | undefined;
    localStorage.removeItem(LEGACY_EDITING_PANE_KEY);

    switch (pane) {
      case 'animation':
        return { viewerMode: 'animation', exportContext: 'animation-export' };
      case 'image':
        return { viewerMode: 'card', exportContext: 'image-export' };
      default:
        return { viewerMode: 'split', exportContext: null };
    }
  } catch {
    return null;
  }
}

export function loadViewerMode(): ViewerMode {
  if (typeof localStorage === 'undefined') return 'split';

  const migrated = migrateFromLegacy();
  if (migrated) {
    persistViewerMode(migrated.viewerMode);
    return migrated.viewerMode;
  }

  try {
    const raw = localStorage.getItem(VIEWER_MODE_KEY);
    if (raw === 'animation' || raw === 'card' || raw === 'videos' || raw === 'split') {
      return raw;
    }
    return 'split';
  } catch {
    return 'split';
  }
}

export function persistViewerMode(mode: ViewerMode): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(VIEWER_MODE_KEY, mode);
  } catch { /* ignore */ }
}

export function loadSplitConfig(): SplitConfig {
  if (typeof localStorage === 'undefined') return { leftPane: 'animation', rightPane: 'card' };
  try {
    const raw = localStorage.getItem(SPLIT_CONFIG_KEY);
    if (!raw) return { leftPane: 'animation', rightPane: 'card' };
    const parsed = JSON.parse(raw) as SplitConfig;
    if (isValidContentType(parsed.leftPane) && isValidContentType(parsed.rightPane)) {
      return parsed;
    }
    return { leftPane: 'animation', rightPane: 'card' };
  } catch {
    return { leftPane: 'animation', rightPane: 'card' };
  }
}

export function persistSplitConfig(config: SplitConfig): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SPLIT_CONFIG_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

function isValidContentType(value: unknown): value is ContentType {
  return value === 'animation' || value === 'card' || value === 'videos';
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in viewer-state-persistence.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts
git commit -m "feat(viewer): add viewer-state-persistence with migration from legacy key"
```

---

### Task 2: Create viewer-state.svelte.ts (reactive state)

**Files:**
- Create: `src/lib/shared/sequence-viewer/state/viewer-state.svelte.ts`

Reactive Svelte 5 state module. Owns `viewerMode`, `exportContext`, and `splitConfig`. Provides setter functions that also persist.

- [ ] **Step 1: Write the state module**

```typescript
// src/lib/shared/sequence-viewer/state/viewer-state.svelte.ts

import {
  type ViewerMode,
  type ExportContext,
  type ContentType,
  type SplitConfig,
  loadViewerMode,
  loadSplitConfig,
  persistViewerMode,
  persistSplitConfig,
} from '../services/viewer-state-persistence';

export type { ViewerMode, ExportContext, ContentType, SplitConfig };

export interface ViewerState {
  viewerMode: ViewerMode;
  exportContext: ExportContext;
  splitConfig: SplitConfig;
}

export function createViewerState(): {
  readonly viewerMode: ViewerMode;
  readonly exportContext: ExportContext;
  readonly splitConfig: SplitConfig;
  setViewerMode: (mode: ViewerMode) => void;
  setExportContext: (ctx: ExportContext) => void;
  setSplitPaneContent: (pane: 'left' | 'right', content: ContentType) => void;
  enterExport: (type: 'animation-export' | 'image-export') => void;
  exitExport: () => void;
  backToSplit: () => void;
} {
  let viewerMode = $state<ViewerMode>(loadViewerMode());
  let exportContext = $state<ExportContext>(null);
  let splitConfig = $state<SplitConfig>(loadSplitConfig());

  function setViewerMode(mode: ViewerMode) {
    viewerMode = mode;
    persistViewerMode(mode);
  }

  function setExportContext(ctx: ExportContext) {
    exportContext = ctx;
  }

  function setSplitPaneContent(pane: 'left' | 'right', content: ContentType) {
    if (pane === 'left') {
      splitConfig = { ...splitConfig, leftPane: content };
    } else {
      splitConfig = { ...splitConfig, rightPane: content };
    }
    persistSplitConfig(splitConfig);
  }

  function enterExport(type: 'animation-export' | 'image-export') {
    const mode: ViewerMode = type === 'animation-export' ? 'animation' : 'card';
    viewerMode = mode;
    exportContext = type;
    persistViewerMode(mode);
  }

  function exitExport() {
    exportContext = null;
  }

  function backToSplit() {
    viewerMode = 'split';
    exportContext = null;
    persistViewerMode('split');
  }

  return {
    get viewerMode() { return viewerMode; },
    get exportContext() { return exportContext; },
    get splitConfig() { return splitConfig; },
    setViewerMode,
    setExportContext,
    setSplitPaneContent,
    enterExport,
    exitExport,
    backToSplit,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in viewer-state.svelte.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/state/viewer-state.svelte.ts
git commit -m "feat(viewer): add reactive viewer state with viewerMode + exportContext + splitConfig"
```

---

### Task 3: Create ViewerContentRail.svelte

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte`

Left nav rail with Back button + three equal content sections. Uses `IconRailNav` keyboard pattern. Desktop-only (≥768px).

- [ ] **Step 1: Write the component**

```svelte
<!-- src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte -->
<script lang="ts">
  import type { ViewerMode, ContentType } from '../state/viewer-state.svelte';

  interface Props {
    activeMode: ContentType;
    videoCount?: number;
    onBack: () => void;
    onSelectMode: (mode: ContentType) => void;
  }

  let { activeMode, videoCount = 0, onBack, onSelectMode }: Props = $props();

  const modes: { id: ContentType; icon: string; label: string }[] = [
    { id: 'animation', icon: 'fa-play', label: 'Animation' },
    { id: 'card', icon: 'fa-grip', label: 'Card' },
    { id: 'videos', icon: 'fa-video', label: 'Videos' },
  ];

  let focusedIndex = $state(-1);

  function handleKeydown(e: KeyboardEvent, index: number) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusedIndex = Math.min(index + 1, modes.length - 1);
        focusAt(focusedIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusedIndex = Math.max(index - 1, 0);
        focusAt(focusedIndex);
        break;
      case 'Home':
        e.preventDefault();
        focusedIndex = 0;
        focusAt(0);
        break;
      case 'End':
        e.preventDefault();
        focusedIndex = modes.length - 1;
        focusAt(focusedIndex);
        break;
    }
  }

  let navEl: HTMLElement | undefined = $state();

  function focusAt(index: number) {
    const buttons = navEl?.querySelectorAll<HTMLButtonElement>('.rail-mode-btn');
    buttons?.[index]?.focus();
  }
</script>

<nav class="content-rail" role="group" aria-label="Content switcher" bind:this={navEl}>
  <button
    type="button"
    class="rail-back-btn"
    onclick={onBack}
    aria-label="Back to split view"
  >
    <i class="fas fa-chevron-left" aria-hidden="true"></i>
    <span class="rail-back-label">Back</span>
  </button>

  <div class="rail-modes">
    {#each modes as mode, i (mode.id)}
      <button
        type="button"
        class="rail-mode-btn"
        class:active={activeMode === mode.id}
        aria-pressed={activeMode === mode.id}
        aria-label={mode.label}
        onclick={() => onSelectMode(mode.id)}
        onkeydown={(e) => handleKeydown(e, i)}
      >
        <i class="fas {mode.icon}" aria-hidden="true"></i>
        <span class="rail-mode-label">{mode.label}</span>
        {#if mode.id === 'videos' && videoCount > 0}
          <span class="rail-badge">{videoCount}</span>
        {/if}
      </button>
    {/each}
  </div>
</nav>

<style>
  .content-rail {
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, #0a0a14);
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    overflow: hidden;
  }

  .rail-back-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 16px 8px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: background 120ms cubic-bezier(0.2, 0, 0, 1),
                color 120ms cubic-bezier(0.2, 0, 0, 1);
  }

  .rail-back-btn:hover {
    background: color-mix(in srgb, var(--theme-panel-bg, #0a0a14) 85%, white);
    color: var(--theme-text, #ffffff);
  }

  .rail-back-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: -2px;
  }

  .rail-back-btn i {
    font-size: 18px;
  }

  .rail-back-label {
    font-size: var(--font-size-xs, 11px);
    font-weight: 500;
    letter-spacing: 0.03em;
  }

  .rail-modes {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .rail-mode-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: none;
    border: none;
    border-left: 3px solid transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    cursor: pointer;
    position: relative;
    transition: background 120ms cubic-bezier(0.2, 0, 0, 1),
                color 120ms cubic-bezier(0.2, 0, 0, 1),
                border-color 120ms cubic-bezier(0.2, 0, 0, 1);
  }

  .rail-mode-btn:hover:not(.active) {
    background: rgba(255, 255, 255, 0.04);
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .rail-mode-btn.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 12%, transparent);
    border-left-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #ffffff);
  }

  .rail-mode-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .rail-mode-btn i {
    font-size: 20px;
  }

  .rail-mode-label {
    font-size: var(--font-size-xs, 11px);
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .rail-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .rail-back-btn,
    .rail-mode-btn {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte
git commit -m "feat(viewer): add ViewerContentRail — left nav rail with Back + mode buttons"
```

---

### Task 4: Create PaneContentSelector.svelte

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/PaneContentSelector.svelte`

Small dropdown chip in the top-left corner of each split pane. Shows current content type + chevron, opens a dropdown to switch.

- [ ] **Step 1: Write the component**

```svelte
<!-- src/lib/shared/sequence-viewer/components/PaneContentSelector.svelte -->
<script lang="ts">
  import type { ContentType } from '../state/viewer-state.svelte';

  interface Props {
    current: ContentType;
    onSelect: (content: ContentType) => void;
  }

  let { current, onSelect }: Props = $props();

  let open = $state(false);

  const options: { id: ContentType; icon: string; label: string }[] = [
    { id: 'animation', icon: 'fa-play', label: 'Animation' },
    { id: 'card', icon: 'fa-grip', label: 'Card' },
    { id: 'videos', icon: 'fa-video', label: 'Videos' },
  ];

  const currentOption = $derived(options.find(o => o.id === current)!);

  function handleSelect(id: ContentType) {
    open = false;
    if (id !== current) onSelect(id);
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.pane-selector')) {
      open = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeydown} />

<div class="pane-selector">
  <button
    type="button"
    class="selector-chip"
    aria-expanded={open}
    aria-haspopup="listbox"
    onclick={() => { open = !open; }}
  >
    <i class="fas {currentOption.icon}" aria-hidden="true"></i>
    <span class="selector-label">{currentOption.label}</span>
    <i class="fas fa-chevron-down selector-chevron" class:open aria-hidden="true"></i>
  </button>

  {#if open}
    <div class="selector-dropdown" role="listbox" aria-label="Content type">
      {#each options as option (option.id)}
        <button
          type="button"
          class="selector-option"
          class:active={option.id === current}
          role="option"
          aria-selected={option.id === current}
          onclick={() => handleSelect(option.id)}
        >
          <i class="fas {option.icon}" aria-hidden="true"></i>
          <span>{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .pane-selector {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
  }

  .selector-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 16px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.85);
    font-size: var(--font-size-xs, 11px);
    font-weight: 500;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .selector-chip:hover {
    background: rgba(0, 0, 0, 0.75);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .selector-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .selector-chip i:first-child {
    font-size: 10px;
  }

  .selector-chevron {
    font-size: 8px;
    transition: transform 150ms ease;
  }

  .selector-chevron.open {
    transform: rotate(180deg);
  }

  .selector-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 140px;
    background: rgba(18, 18, 28, 0.98);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }

  .selector-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: var(--font-size-sm, 13px);
    cursor: pointer;
    transition: background 100ms ease;
  }

  .selector-option:hover {
    background: rgba(255, 255, 255, 0.06);
    color: white;
  }

  .selector-option.active {
    color: var(--theme-accent, #6366f1);
    font-weight: 600;
  }

  .selector-option:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .selector-option i {
    font-size: 12px;
    width: 16px;
    text-align: center;
  }
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/PaneContentSelector.svelte
git commit -m "feat(viewer): add PaneContentSelector — per-pane content type dropdown"
```

---

### Task 5: Create VideoGallery.svelte

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/VideoGallery.svelte`

Center content for Videos mode. Refactored from VideoPanel — shows video list + upload trigger. Does NOT include the full upload flow (that stays in VideoPanel sidebar for now).

- [ ] **Step 1: Write the component**

```svelte
<!-- src/lib/shared/sequence-viewer/components/VideoGallery.svelte -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import {
    getVideosForSequence,
    deleteVideo,
  } from '$lib/shared/video-collaboration/services/collaborative-video-manager';
  import type { CollaborativeVideo } from '$lib/shared/video-collaboration/domain/CollaborativeVideo';
  import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
  import { authState } from '$lib/shared/auth/state/authState.svelte';

  interface Props {
    sequence: SequenceData;
    isOwned: boolean;
    onUpload?: () => void;
  }

  let { sequence, isOwned, onUpload }: Props = $props();

  let videos = $state<CollaborativeVideo[]>([]);
  let loading = $state(true);
  let playingId = $state<string | null>(null);

  $effect(() => {
    const seqId = sequence?.id;
    if (!seqId) {
      videos = [];
      loading = false;
      return;
    }
    loading = true;
    getVideosForSequence(seqId)
      .then((v) => { videos = v; })
      .catch(() => { videos = []; })
      .finally(() => { loading = false; });
  });

  function handlePlay(id: string) {
    playingId = playingId === id ? null : id;
  }

  async function handleDelete(id: string) {
    await deleteVideo(id);
    videos = videos.filter((v) => v.id !== id);
  }
</script>

<div class="video-gallery" in:fade={{ duration: 200 }}>
  {#if loading}
    <div class="gallery-empty">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Loading videos...</span>
    </div>
  {:else if videos.length === 0}
    <div class="gallery-empty">
      <i class="fas fa-video" aria-hidden="true"></i>
      <span>No videos yet</span>
      {#if onUpload}
        <button type="button" class="upload-btn" onclick={onUpload}>
          <i class="fas fa-upload" aria-hidden="true"></i>
          Upload a performance
        </button>
      {/if}
    </div>
  {:else}
    <div class="gallery-header">
      <span class="gallery-count">{videos.length} video{videos.length !== 1 ? 's' : ''}</span>
      {#if onUpload}
        <button type="button" class="upload-btn-sm" onclick={onUpload}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          Upload
        </button>
      {/if}
    </div>
    <div class="gallery-grid">
      {#each videos as video (video.id)}
        <div class="video-card">
          {#if playingId === video.id}
            <video
              src={video.videoUrl}
              class="video-player"
              controls
              autoplay
              onended={() => { playingId = null; }}
            ></video>
          {:else}
            <button
              type="button"
              class="video-thumb"
              onclick={() => handlePlay(video.id)}
              aria-label="Play video by {video.uploaderName || 'Unknown'}"
            >
              {#if video.thumbnailUrl}
                <img src={video.thumbnailUrl} alt="" class="thumb-img" />
              {:else}
                <div class="thumb-placeholder">
                  <i class="fas fa-play" aria-hidden="true"></i>
                </div>
              {/if}
              <div class="thumb-overlay">
                <i class="fas fa-play" aria-hidden="true"></i>
              </div>
            </button>
          {/if}
          <div class="video-meta">
            <span class="video-uploader">{video.uploaderName || 'Anonymous'}</span>
            {#if isOwned && video.uploaderId === authState.user?.uid}
              <button
                type="button"
                class="video-delete"
                onclick={() => handleDelete(video.id)}
                aria-label="Delete video"
              >
                <i class="fas fa-trash-alt" aria-hidden="true"></i>
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .video-gallery {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 16px;
    overflow-y: auto;
  }

  .gallery-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-sm, 14px);
  }

  .gallery-empty i {
    font-size: 32px;
    opacity: 0.5;
  }

  .upload-btn {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    background: var(--theme-accent, #6366f1);
    border: none;
    color: white;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: opacity 120ms ease;
  }

  .upload-btn:hover {
    opacity: 0.85;
  }

  .gallery-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .gallery-count {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .upload-btn-sm {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-xs, 12px);
    cursor: pointer;
    transition: background 100ms ease;
  }

  .upload-btn-sm:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .video-card {
    border-radius: 8px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .video-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;
    background: black;
    border: none;
    padding: 0;
    cursor: pointer;
    display: block;
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.3);
    font-size: 24px;
  }

  .thumb-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    color: white;
    font-size: 24px;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .video-thumb:hover .thumb-overlay {
    opacity: 1;
  }

  .video-player {
    width: 100%;
    aspect-ratio: 16/9;
    background: black;
  }

  .video-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
  }

  .video-uploader {
    font-size: var(--font-size-xs, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .video-delete {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    padding: 4px;
    font-size: 12px;
    transition: color 100ms ease;
  }

  .video-delete:hover {
    color: var(--semantic-error, #f87171);
  }
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/VideoGallery.svelte
git commit -m "feat(viewer): add VideoGallery — center content for Videos mode"
```

---

### Task 6: Refactor SequenceViewerOrchestrator to use viewer state

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`

Replace `editingPane` with `createViewerState()`. The orchestrator context exposes the new state to children. `enterEditMode` becomes `enterExport`, `exitEditMode` becomes `backToSplit` (or `exitExport` depending on intent).

**Key changes:**
1. Import `createViewerState` instead of `loadRecentEditingPane`/`persistEditingPane`
2. Replace `editingPane` state variable with viewer state instance
3. Maintain backward-compatible `editingPane` derived property for gradual migration of consumers
4. `enterEditMode('animation')` → `viewerState.enterExport('animation-export')`
5. `enterEditMode('image')` → `viewerState.enterExport('image-export')`
6. `enterEditMode('video-upload')` → `viewerState.setViewerMode('videos')`
7. `exitEditMode()` → `viewerState.backToSplit()`

- [ ] **Step 1: Replace imports and state initialization**

In `SequenceViewerOrchestrator.svelte`, replace:
```typescript
import { loadRecentEditingPane, persistEditingPane } from "../services/editing-pane-persistence";
```
with:
```typescript
import { createViewerState } from "../state/viewer-state.svelte";
```

Replace:
```typescript
let editingPane = $state<'animation' | 'image' | 'video-upload' | null>(
  untrack(() => loadRecentEditingPane(sequence?.id ?? null))
);
$effect(() => {
  persistEditingPane(editingPane, sequence?.id ?? null);
});
```
with:
```typescript
const viewerState = createViewerState();

const editingPane = $derived.by((): 'animation' | 'image' | 'video-upload' | null => {
  const { viewerMode, exportContext } = viewerState;
  if (exportContext === 'animation-export') return 'animation';
  if (exportContext === 'image-export') return 'image';
  if (viewerMode === 'videos') return 'video-upload';
  return null;
});
```

- [ ] **Step 2: Update enterEditMode and exitEditMode**

Replace `enterEditMode`:
```typescript
function enterEditMode(pane: 'animation' | 'image' | 'video-upload') {
  if (viewer3DState.renderMode === '3d' && pane !== 'animation') {
    viewer3DState.exit3D();
  }
  hapticService?.trigger("selection");

  if (pane === 'animation') {
    viewerState.enterExport('animation-export');
    if (!playback.isPlayingLocal && playbackControllerRef) {
      playbackControllerRef.togglePlayback();
    }
  } else if (pane === 'image') {
    wasPlayingBeforeImageExport = playback.isPlayingLocal;
    if (playback.isPlayingLocal && playbackControllerRef) {
      playbackControllerRef.togglePlayback();
    }
    viewerState.enterExport('image-export');
  } else if (pane === 'video-upload') {
    wasPlayingBeforeImageExport = playback.isPlayingLocal;
    if (playback.isPlayingLocal && playbackControllerRef) {
      playbackControllerRef.togglePlayback();
    }
    viewerState.setViewerMode('videos');
  }

  if (pane === 'video-upload') {
    accessibilityHelper.announce("Upload a performance video for this sequence.", "assertive");
  } else {
    const label = pane === 'animation' ? 'Animation' : 'Card';
    accessibilityHelper.announce(`${label} export. Configure settings and tap Export when ready.`, "assertive");
  }
}
```

Replace `exitEditMode`:
```typescript
function exitEditMode() {
  hapticService?.trigger("selection");
  const wasPaneImage = editingPane === "image" || editingPane === "video-upload";
  viewerState.backToSplit();
  exportCoord.dismissPreview();

  if (wasPaneImage && wasPlayingBeforeImageExport && !playback.isPlayingLocal && playbackControllerRef) {
    playbackControllerRef.togglePlayback();
  }
  wasPlayingBeforeImageExport = false;

  accessibilityHelper.announce("Split view restored");
}
```

- [ ] **Step 3: Expose viewerState in OrchestratorContext**

Add to the `OrchestratorContext` interface:
```typescript
viewerState: ReturnType<typeof import("../state/viewer-state.svelte").createViewerState>;
```

Add to the context object passed to `children`:
```typescript
viewerState,
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors (or fix any type issues)

- [ ] **Step 5: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "refactor(viewer): replace editingPane with two-dimensional viewerState"
```

---

### Task 7: Update SequenceViewerDrawerHost — integrate ViewerContentRail

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`

Replace the gutter-back button with `ViewerContentRail`. Route center content based on `viewerMode`. Show the rail only in focused/non-split modes on desktop.

- [ ] **Step 1: Import new components**

Add imports:
```typescript
import ViewerContentRail from "./ViewerContentRail.svelte";
import VideoGallery from "./VideoGallery.svelte";
```

- [ ] **Step 2: Replace gutter-back with ViewerContentRail**

Replace the `{#if showGutterStrip}` block:
```svelte
{#if showGutterStrip}
  <button
    type="button"
    class="gutter-back"
    onclick={handleBackToSplit}
    aria-label="Back to split view"
  >
    <i class="fas fa-chevron-left" aria-hidden="true"></i>
    <span class="gutter-back-label">Back</span>
  </button>
{/if}
```

with:
```svelte
{#if showRail}
  <ViewerContentRail
    activeMode={ctx.viewerState.viewerMode === 'split' ? 'animation' : ctx.viewerState.viewerMode}
    {videoCount}
    onBack={handleBackToSplit}
    onSelectMode={(mode) => {
      ctx.viewerState.setViewerMode(mode);
      ctx.viewerState.exitExport();
    }}
  />
{/if}
```

- [ ] **Step 3: Update showGutterStrip → showRail condition**

Replace:
```typescript
{@const showGutterStrip = isSidebarExportActive && !isMobileWidth}
```
with:
```typescript
{@const showRail = ctx.viewerState.viewerMode !== 'split' && !isMobileWidth}
```

- [ ] **Step 4: Update grid classes**

Change `has-gutter` references to `has-rail`:
```svelte
class:has-rail={showRail}
```

Update the CSS:
```css
.viewer-and-export.export-active.desktop.has-rail {
  grid-template-columns: 1fr 4fr var(--export-sidebar-width);
}

.viewer-and-export.export-active.desktop.has-rail.sidebar-collapsed {
  grid-template-columns: 1fr 4fr 0px;
}

.viewer-and-export.desktop.has-rail:not(.export-active) {
  grid-template-columns: 1fr 4fr;
}
```

- [ ] **Step 5: Route center content by viewerMode**

Where `ViewerSplitPane` is rendered, wrap it in a conditional:
```svelte
{#if ctx.viewerState.viewerMode === 'split'}
  <ViewerSplitPane ... />
{:else if ctx.viewerState.viewerMode === 'videos'}
  <VideoGallery
    sequence={overlay.sequence}
    isOwned={ctx.isOwned}
    onUpload={ctx.isLoggedIn ? () => ctx.handleVideoUpload() : undefined}
  />
{:else}
  <!-- Animation or Card focused mode — ViewerSplitPane with focusedPane -->
  <ViewerSplitPane
    ...
    layout={{
      ...existingLayout,
      focusedPane: ctx.viewerState.viewerMode === 'animation' ? 'animation' : 'image',
      suppressCloseButton: true,
    }}
  />
{/if}
```

- [ ] **Step 6: Remove old gutter-back CSS**

Remove the `.gutter-back`, `.gutter-back:hover`, `.gutter-back:active`, `.gutter-back:focus-visible`, `.gutter-back i`, `.gutter-back-label` rules.

- [ ] **Step 7: Update handleBackToSplit**

```typescript
{@const handleBackToSplit = () => {
  ctx.viewerState.backToSplit();
  setTimeout(() => rerenderTrigger++, 280);
}}
```

- [ ] **Step 8: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "feat(viewer): replace gutter-back with ViewerContentRail, route center by viewerMode"
```

---

### Task 8: Update ViewerSplitPane — add PaneContentSelector

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`

Add `PaneContentSelector` chips to each pane in split mode. Accept `splitConfig` and `onSplitConfigChange` props.

- [ ] **Step 1: Add new props**

Add to the Props interface:
```typescript
import type { ContentType, SplitConfig } from '../state/viewer-state.svelte';
import PaneContentSelector from './PaneContentSelector.svelte';

// In Props interface:
splitConfig?: SplitConfig;
onSplitConfigChange?: (pane: 'left' | 'right', content: ContentType) => void;
```

Destructure:
```typescript
splitConfig = { leftPane: 'animation', rightPane: 'card' },
onSplitConfigChange,
```

- [ ] **Step 2: Add PaneContentSelector to animation column**

Inside `.split-column.animation-column`, before the `.media-pane`, add:
```svelte
{#if !layout.focusedPane && onSplitConfigChange}
  <PaneContentSelector
    current={splitConfig.leftPane}
    onSelect={(content) => onSplitConfigChange?.('left', content)}
  />
{/if}
```

- [ ] **Step 3: Add PaneContentSelector to preview column**

Inside `.split-column.preview-column`, before `.preview-column-inner`, add:
```svelte
{#if !layout.focusedPane && onSplitConfigChange}
  <PaneContentSelector
    current={splitConfig.rightPane}
    onSelect={(content) => onSplitConfigChange?.('right', content)}
  />
{/if}
```

- [ ] **Step 4: Route pane content based on splitConfig**

Wrap the animation pane content in a conditional:
```svelte
{#if splitConfig.leftPane === 'animation'}
  <!-- existing animation canvas content -->
{:else if splitConfig.leftPane === 'card'}
  <ChoreoCard ... />
{:else if splitConfig.leftPane === 'videos'}
  <VideoGallery ... />
{/if}
```

Do the same for the right pane based on `splitConfig.rightPane`.

- [ ] **Step 5: Pass splitConfig from DrawerHost**

In `SequenceViewerDrawerHost.svelte`, pass the new props to ViewerSplitPane:
```svelte
splitConfig={ctx.viewerState.splitConfig}
onSplitConfigChange={(pane, content) => ctx.viewerState.setSplitPaneContent(pane, content)}
```

- [ ] **Step 6: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
git add src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "feat(viewer): add PaneContentSelector to split view, route content by splitConfig"
```

---

### Task 9: Update ViewerFooter — export buttons use enterExport

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`

Footer's "Download Animation" and "Download Card" buttons should set both viewerMode AND exportContext (via `enterExport`). The footer's `onExportVideo` and `onExportImage` callbacks already call `ctx.enterEditMode('animation')` and `ctx.enterEditMode('image')` respectively — these work because Task 6 rewired `enterEditMode` internally. No footer changes needed unless we want to add the video upload button behavior.

The `onVideoUpload` callback in footer already calls `ctx.handleVideoUpload()` which calls `enterEditMode('video-upload')` — this now sets viewerMode to 'videos' per Task 6. No change needed.

- [ ] **Step 1: Verify existing footer callbacks route through updated enterEditMode**

Read `SequenceViewerDrawerHost.svelte` to confirm `onExportVideo` passes `() => ctx.enterEditMode('animation')` and `onExportImage` passes `() => ctx.enterEditMode('image')`. Both already confirmed from file read.

- [ ] **Step 2: Verify build still passes**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds (footer doesn't need changes — the plumbing was fixed in Task 6)

- [ ] **Step 3: Commit (only if changes made)**

If no changes needed, skip this commit.

---

### Task 10: Delete old editing-pane-persistence.ts

**Files:**
- Delete: `src/lib/shared/sequence-viewer/services/editing-pane-persistence.ts`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "editing-pane-persistence" src/`
Expected: Zero results (orchestrator import was replaced in Task 6)

- [ ] **Step 2: Delete the file**

```bash
git rm src/lib/shared/sequence-viewer/services/editing-pane-persistence.ts
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(viewer): remove deprecated editing-pane-persistence.ts"
```

---

### Task 11: Integration testing + visual verification

**Files:**
- No new files

End-to-end verification that all modes work correctly.

- [ ] **Step 1: Run full type check**

Run: `npm run check`
Expected: Zero errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 3: Verify in browser (manual or DevTools)**

Test matrix:
1. Open sequence viewer → split view with both panes visible
2. Click a pane → focused mode, rail appears with correct mode highlighted
3. Click "Back" in rail → returns to split view
4. Click "Card" in rail while in animation mode → switches to card focused
5. Click "Videos" in rail → shows VideoGallery
6. PaneContentSelector in split view → changes pane content
7. Download Animation button in footer → animation focused + export sidebar
8. Download Card button → card focused + export sidebar
9. Close export sidebar (X) → stays in focused mode, no sidebar
10. Reload page → viewerMode and splitConfig persist from localStorage

- [ ] **Step 4: Verify mobile (≤767px)**

1. Rail does NOT appear on mobile
2. Header Back button still works
3. Footer export buttons still work

- [ ] **Step 5: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix(viewer): integration fixups for content switcher"
```
