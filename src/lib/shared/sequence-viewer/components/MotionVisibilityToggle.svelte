<!--
  MotionVisibilityToggle.svelte

  Icon button in the sequence viewer header. Shows two prop silhouettes:
  the hidden side is rendered grey. Click opens a popover with two chips
  (Blue, Red) that toggle each color's visibility.

  Reads/writes SequenceViewerVisibilityState via context.
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";
  import { getViewerVisibilityContext } from "../context/viewer-visibility-context";

  const visibility = getViewerVisibilityContext();
  let open = $state(false);

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function close() {
    open = false;
  }

  function onDocumentClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as HTMLElement;
    if (!target.closest(".motion-vis-root")) close();
  }

  $effect(() => {
    if (!open) return;
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  });
</script>

<div class="motion-vis-root">
  <button
    type="button"
    class="motion-vis-btn"
    onclick={toggle}
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
      class="motion-vis-popover"
      role="dialog"
      aria-label="Motion visibility"
      in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
      out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
    >
      <button
        type="button"
        class="chip blue"
        class:active={visibility.blueMotion}
        onclick={() => visibility.toggleBlue()}
        aria-pressed={visibility.blueMotion}
      >
        Blue
      </button>
      <button
        type="button"
        class="chip red"
        class:active={visibility.redMotion}
        onclick={() => visibility.toggleRed()}
        aria-pressed={visibility.redMotion}
      >
        Red
      </button>
    </div>
  {/if}
</div>

<style>
  .motion-vis-root { position: relative; }

  .motion-vis-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: transparent;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    gap: 3px;
    padding: 0 6px;
  }
  .motion-vis-btn:hover { background: rgba(255, 255, 255, 0.06); }

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

  .motion-vis-popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 140px;
    padding: 8px;
    background: rgba(20, 22, 32, 0.95);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    display: flex;
    gap: 6px;
    z-index: 20;
  }

  .chip {
    flex: 1;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
  }
  .chip:hover { background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.95); }
  .chip.blue.active {
    background: color-mix(in srgb, var(--prop-blue, #2196f3) 22%, transparent);
    border-color: var(--prop-blue, #2196f3);
    color: #fff;
  }
  .chip.red.active {
    background: color-mix(in srgb, var(--prop-red, #f44336) 22%, transparent);
    border-color: var(--prop-red, #f44336);
    color: #fff;
  }
</style>
