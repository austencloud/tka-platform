<script lang="ts">
  /**
   * ClipContextMenu - Right-click context menu for timeline clips
   *
   * Provides quick access to clip operations:
   * - Cut, Copy, Paste, Delete
   * - Duplicate
   * - Mute/Lock toggle
   * - Speed presets
   * - Open inspector
   */

  import { getTimelineState } from "../state/timeline-state.svelte";
  import * as m from "$lib/paraglide/messages.js";

  interface Props {
    clipId: string;
    x: number;
    y: number;
    onClose: () => void;
  }

  let { clipId, x, y, onClose }: Props = $props();

  function getState() {
    return getTimelineState();
  }

  // Local reactive state
  let clip = $state<
    ReturnType<typeof getState>["allClips"][number] | undefined
  >(undefined);

  // Sync from timeline state
  $effect(() => {
    clip = getState().allClips.find((c) => c.id === clipId);
  });

  function handleAction(action: () => void) {
    action();
    onClose();
  }

  // Close on click outside
  function handleClickOutside(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest(".context-menu")) {
      onClose();
    }
  }

  // Close on escape
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    }
  }

  $effect(() => {
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });
</script>

{#if clip}
  <div class="context-menu" style="left: {x}px; top: {y}px" role="menu">
    <!-- Edit section -->
    <button
      class="menu-item"
      onclick={() => handleAction(() => getState().duplicateClip(clipId))}
    >
      <i class="fa-solid fa-copy" aria-hidden="true"></i>
      <span>{m.clip_duplicate()}</span>
      <kbd>Ctrl+D</kbd>
    </button>

    <button
      class="menu-item danger"
      onclick={() => handleAction(() => getState().removeClip(clipId))}
    >
      <i class="fa-solid fa-trash" aria-hidden="true"></i>
      <span>{m.clip_delete()}</span>
      <kbd>Del</kbd>
    </button>

    <div class="divider"></div>

    <!-- Toggle section -->
    <button
      class="menu-item"
      onclick={() =>
        handleAction(() =>
          getState().updateClip(clipId, { muted: !clip?.muted })
        )}
    >
      <i
        class="fa-solid {clip?.muted ? 'fa-volume-high' : 'fa-volume-xmark'}"
        aria-hidden="true"
      ></i>
      <span>{clip?.muted ? m.clip_unmute() : m.clip_mute()}</span>
      <kbd>M</kbd>
    </button>

    <button
      class="menu-item"
      onclick={() =>
        handleAction(() =>
          getState().updateClip(clipId, { locked: !clip?.locked })
        )}
    >
      <i
        class="fa-solid {clip?.locked ? 'fa-lock-open' : 'fa-lock'}"
        aria-hidden="true"
      ></i>
      <span>{clip?.locked ? m.clip_unlock() : m.clip_lock()}</span>
      <kbd>L</kbd>
    </button>

    <button
      class="menu-item"
      onclick={() =>
        handleAction(() => getState().setClipLoop(clipId, !clip?.loop))}
    >
      <i class="fa-solid fa-repeat" aria-hidden="true"></i>
      <span>{clip?.loop ? m.clip_disable_loop() : m.clip_enable_loop()}</span>
    </button>

    <div class="divider"></div>

    <!-- Speed presets -->
    <div class="submenu">
      <button class="menu-item">
        <i class="fa-solid fa-gauge" aria-hidden="true"></i>
        <span>{m.clip_speed()}</span>
        <i class="fa-solid fa-chevron-right submenu-arrow" aria-hidden="true"
        ></i>
      </button>
      <div class="submenu-content">
        <button
          class="menu-item"
          onclick={() =>
            handleAction(() => getState().setClipPlaybackRate(clipId, 0.25))}
        >
          <span>{m.clip_speed_very_slow()}</span>
        </button>
        <button
          class="menu-item"
          onclick={() =>
            handleAction(() => getState().setClipPlaybackRate(clipId, 0.5))}
        >
          <span>{m.clip_speed_slow()}</span>
        </button>
        <button
          class="menu-item"
          onclick={() =>
            handleAction(() => getState().setClipPlaybackRate(clipId, 0.75))}
        >
          <span>0.75x</span>
        </button>
        <button
          class="menu-item"
          class:active={clip?.playbackRate === 1}
          onclick={() =>
            handleAction(() => getState().setClipPlaybackRate(clipId, 1))}
        >
          <span>{m.clip_speed_normal()}</span>
        </button>
        <button
          class="menu-item"
          onclick={() =>
            handleAction(() => getState().setClipPlaybackRate(clipId, 1.5))}
        >
          <span>1.5x</span>
        </button>
        <button
          class="menu-item"
          onclick={() =>
            handleAction(() => getState().setClipPlaybackRate(clipId, 2))}
        >
          <span>{m.clip_speed_fast()}</span>
        </button>
        <button
          class="menu-item"
          onclick={() =>
            handleAction(() => getState().setClipPlaybackRate(clipId, 4))}
        >
          <span>{m.clip_speed_very_fast()}</span>
        </button>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Inspector -->
    <button
      class="menu-item"
      onclick={() => handleAction(() => getState().openClipInspector(clipId))}
    >
      <i class="fa-solid fa-sliders" aria-hidden="true"></i>
      <span>{m.clip_open_inspector()}</span>
    </button>
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 1000;
    min-width: 180px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--theme-text, var(--theme-text));
    font-size: var(--font-size-compact);
    text-align: left;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .menu-item:hover {
    background: var(--theme-card-hover-bg);
  }

  .menu-item.active {
    background: var(--theme-accent);
  }

  .menu-item.danger:hover {
    background: rgba(255, 68, 68, 0.2);
    color: #ff4444;
  }

  .menu-item i {
    width: 16px;
    text-align: center;
    font-size: var(--font-size-compact);
    opacity: 0.7;
  }

  .menu-item span {
    flex: 1;
  }

  .menu-item kbd {
    font-size: var(--font-size-compact);
    padding: 2px 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    color: var(--theme-text-muted, var(--theme-text-dim));
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke);
    margin: 4px 0;
  }

  .submenu {
    position: relative;
  }

  .submenu-arrow {
    font-size: var(--font-size-compact) !important;
  }

  .submenu-content {
    display: none;
    position: absolute;
    left: 100%;
    top: 0;
    min-width: 140px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .submenu:hover .submenu-content {
    display: block;
  }
</style>
