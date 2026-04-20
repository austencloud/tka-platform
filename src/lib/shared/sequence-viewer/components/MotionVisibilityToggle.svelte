<!--
  MotionVisibilityToggle.svelte

  Per-viewer motion visibility control.

  - Wide viewports (≥768px): two inline chips (Left / Right) for one-tap
    toggles with direct state readability.
  - Narrow viewports: icon button + popover, so the header doesn't blow
    past its horizontal budget on phones.

  Reads/writes SequenceViewerVisibilityState via context.
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";
  import { getViewerVisibilityContext } from "../context/viewer-visibility-context";

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

  // Backdrop absorbs the dismiss click so it can't reach the choreo
  // card, canvas, or any other control beneath.
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
        <button
          type="button"
          class="chip blue"
          class:active={visibility.blueMotion}
          onclick={() => visibility.toggleBlue()}
          aria-pressed={visibility.blueMotion}
        >
          Left
        </button>
        <button
          type="button"
          class="chip red"
          class:active={visibility.redMotion}
          onclick={() => visibility.toggleRed()}
          aria-pressed={visibility.redMotion}
        >
          Right
        </button>
      </div>
    {/if}
  {:else}
    <div class="motion-vis-inline" role="group" aria-label="Motion visibility">
      <button
        type="button"
        class="chip blue"
        class:active={visibility.blueMotion}
        onclick={() => visibility.toggleBlue()}
        aria-pressed={visibility.blueMotion}
        aria-label={visibility.blueMotion ? "Hide left motion" : "Show left motion"}
      >
        Left
      </button>
      <button
        type="button"
        class="chip red"
        class:active={visibility.redMotion}
        onclick={() => visibility.toggleRed()}
        aria-pressed={visibility.redMotion}
        aria-label={visibility.redMotion ? "Hide right motion" : "Show right motion"}
      >
        Right
      </button>
    </div>
  {/if}
</div>

<style>
  .motion-vis-root { position: relative; }

  .motion-vis-inline {
    display: flex;
    gap: 6px;
    align-items: center;
  }

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
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    display: flex;
    gap: 6px;
    z-index: 20;
  }

  .chip {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
    /* Inline chips need a minimum height to feel like real controls. */
    min-height: 32px;
  }
  /* Popover chips stretch to fill the popover width evenly. */
  .motion-vis-popover .chip { flex: 1; }

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
