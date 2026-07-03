<!--
  MotionVisibilityToggle.svelte

  Per-viewer motion visibility control.

  - Wide viewports (>=768px): inline Left/Right chips via MotionColorChips.
  - Narrow viewports: icon button + popover with the same chips.

  Reads/writes SequenceViewerVisibilityState via context.
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";
  import { getViewerVisibilityContext } from "../context/viewer-visibility-context";
  import MotionColorChips from "$lib/shared/components/MotionColorChips.svelte";

  const visibility = getViewerVisibilityContext();
  let open = $state(false);
  let isNarrow = $state(false);

  $effect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      isNarrow = mq.matches;
      if (!isNarrow) open = false;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  });

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

<div class="motion-vis-root" class:narrow={isNarrow}>
  {#if isNarrow}
    <button
      type="button"
      class="motion-vis-btn"
      onclick={toggleOpen}
      aria-label="Motion visibility"
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
        in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
        out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
      >
        <MotionColorChips
          showBlue={visibility.blueMotion}
          showRed={visibility.redMotion}
          onToggleBlue={() => visibility.toggleBlue()}
          onToggleRed={() => visibility.toggleRed()}
        />
      </div>
    {/if}
  {:else}
    <MotionColorChips
      showBlue={visibility.blueMotion}
      showRed={visibility.redMotion}
      onToggleBlue={() => visibility.toggleBlue()}
      onToggleRed={() => visibility.toggleRed()}
    />
  {/if}
</div>

<style>
  .motion-vis-root { position: relative; }

  .motion-vis-btn {
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: transparent;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    gap: 3px;
    padding: 0 6px;
  }
  .motion-vis-btn:hover { background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06)); }

  .prop-silhouette {
    width: 4px;
    height: 18px;
    border-radius: 2px;
    transition: background 160ms ease, opacity 160ms ease;
  }
  .prop-silhouette.blue { background: var(--prop-blue, #2196f3); }
  .prop-silhouette.red  { background: var(--prop-red, #f44336); }
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
    background: rgba(20, 22, 32, 0.95);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.10));
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    z-index: 20;
  }

  /* Popover chips stretch to fill the popover width evenly. */
  .motion-vis-popover :global(.motion-color-chips) {
    gap: 6px;
  }
  .motion-vis-popover :global(.chip) {
    flex: 1;
  }
</style>
