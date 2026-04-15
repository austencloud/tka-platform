<script lang="ts">
  /**
   * RenderModeToggle
   *
   * A single pill that flips between 2D and 3D on any click. The active
   * side is highlighted, but the whole pill is the click target — you
   * don't have to hit the opposite label to switch.
   *
   * Lives in the Sequence Viewer footer, bottom-left.
   */

  interface Props {
    renderMode: "2d" | "3d";
    webgl2Available: boolean;
    onchange: (mode: "2d" | "3d") => void;
  }

  let { renderMode, webgl2Available, onchange }: Props = $props();

  function flip() {
    onchange(renderMode === "2d" ? "3d" : "2d");
  }
</script>

{#if webgl2Available}
  <button
    type="button"
    class="render-mode-toggle"
    role="switch"
    aria-checked={renderMode === "3d"}
    aria-label={renderMode === "3d" ? "Switch to 2D" : "Switch to 3D"}
    onclick={flip}
  >
    <span class="segment" class:active={renderMode === "2d"}>2D</span>
    <span class="segment" class:active={renderMode === "3d"}>3D</span>
  </button>
{/if}

<style>
  .render-mode-toggle {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 14px;
    gap: 6px;
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
    user-select: none;
  }

  .render-mode-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.22);
  }

  .render-mode-toggle:active {
    background: rgba(255, 255, 255, 0.14);
  }

  .render-mode-toggle:focus-visible {
    outline: 2px solid rgba(120, 160, 255, 0.6);
    outline-offset: 1px;
  }

  .segment {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    letter-spacing: 0.02em;
    color: rgba(255, 255, 255, 0.4);
    transition: color 150ms ease, font-weight 150ms ease;
    pointer-events: none; /* whole pill is the click target */
  }

  .segment.active {
    color: #fff;
    font-weight: 700;
  }
</style>
