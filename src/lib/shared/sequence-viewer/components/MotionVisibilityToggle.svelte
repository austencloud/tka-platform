<!--
  MotionVisibilityToggle.svelte

  Per-viewer motion visibility control.

  One compact trigger at every width. The Left/Right controls live in a small
  popover so this utility never consumes two primary-action slots.

  Reads/writes SequenceViewerVisibilityState via context.
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";
  import { getViewerVisibilityContext } from "../context/viewer-visibility-context";
  import MotionColorChips from "$lib/shared/components/MotionColorChips.svelte";

  const visibility = getViewerVisibilityContext();
  interface Props {
    onToggleBlue?: () => void;
    onToggleRed?: () => void;
  }
  let { onToggleBlue, onToggleRed }: Props = $props();

  function toggleBlue(): void {
    if (onToggleBlue) onToggleBlue();
    else visibility.toggleBlue();
  }

  function toggleRed(): void {
    if (onToggleRed) onToggleRed();
    else visibility.toggleRed();
  }

  let open = $state(false);

  function toggleOpen(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function close() {
    open = false;
  }

  function onBackdropPointerDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    close();
  }

  function onKeydown(e: KeyboardEvent) {
    if (open && e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  }

  $effect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeydown, true);
    return () => document.removeEventListener("keydown", onKeydown, true);
  });
</script>

<div class="motion-vis-root">
  <button
    type="button"
    class="motion-vis-btn"
    class:open
    onclick={toggleOpen}
    aria-label="Motion visibility"
    title="Motion visibility"
    data-ghost="safe"
    data-ghost-kind="view-toggle"
    data-ghost-label="Motion visibility"
    aria-expanded={open}
    aria-haspopup="dialog"
  >
    <span
      class="prop-silhouette blue"
      class:muted={!visibility.blueMotion}
      aria-hidden="true"
    ></span>
    <span
      class="prop-silhouette red"
      class:muted={!visibility.redMotion}
      aria-hidden="true"
    ></span>
  </button>

  {#if open}
    <div
      class="motion-vis-backdrop"
      role="button"
      tabindex="-1"
      aria-label="Close motion visibility menu"
      onpointerdown={onBackdropPointerDown}
    ></div>
    <div
      class="motion-vis-popover"
      role="dialog"
      aria-label="Motion visibility"
      in:scale={{ duration: 180, start: 0.96, opacity: 0, easing: backOut }}
      out:scale={{ duration: 120, start: 0.98, opacity: 0, easing: cubicOut }}
    >
      <MotionColorChips
        showBlue={visibility.blueMotion}
        showRed={visibility.redMotion}
        onToggleBlue={toggleBlue}
        onToggleRed={toggleRed}
      />
    </div>
  {/if}
</div>

<style>
  .motion-vis-root {
    position: relative;
  }

  .motion-vis-btn {
    box-sizing: border-box;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 10px;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--theme-text, #ffffff) 5%, transparent),
        transparent 72%
      ),
      var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    box-shadow:
      inset 0 1px 0
        color-mix(in srgb, var(--theme-text, #ffffff) 8%, transparent),
      0 2px 6px
        color-mix(in srgb, var(--theme-shadow, #000000) 32%, transparent);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 0 6px;
    transition:
      background 150ms ease,
      border-color 150ms ease,
      box-shadow 150ms ease,
      transform 150ms ease;
  }

  .motion-vis-btn:hover,
  .motion-vis-btn.open {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.24));
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    box-shadow:
      inset 0 1px 0
        color-mix(in srgb, var(--theme-text, #ffffff) 13%, transparent),
      0 5px 14px
        color-mix(in srgb, var(--theme-shadow, #000000) 38%, transparent);
    transform: translateY(-1px);
  }

  .motion-vis-btn:active {
    transform: translateY(0) scale(0.96);
  }

  .motion-vis-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .prop-silhouette {
    width: 4px;
    height: 18px;
    border-radius: 2px;
    transition:
      background 160ms ease,
      opacity 160ms ease;
  }
  .prop-silhouette.blue {
    background: var(--prop-blue, #2196f3);
  }
  .prop-silhouette.red {
    background: var(--prop-red, #f44336);
  }
  .prop-silhouette.muted {
    background: rgba(255, 255, 255, 0.25);
    opacity: 0.55;
  }

  .motion-vis-backdrop {
    position: fixed;
    inset: 0;
    z-index: 19;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    cursor: default;
  }

  .motion-vis-popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 140px;
    padding: 8px;
    background: var(--theme-panel-bg, #141620);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow: 0 8px 24px var(--theme-shadow, rgba(0, 0, 0, 0.45));
    z-index: 20;
  }

  /* Popover chips stretch to fill the popover width evenly. */
  .motion-vis-popover :global(.motion-color-chips) {
    gap: 6px;
  }
  .motion-vis-popover :global(.chip) {
    flex: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .motion-vis-btn {
      transition: none;
    }
  }
</style>
