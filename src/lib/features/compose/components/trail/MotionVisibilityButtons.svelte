<!--
  MotionVisibilityButtons.svelte

  2026 Bento Box Design - Motion visibility toggles
  Blue and Red motion visibility toggle buttons.
-->
<script lang="ts">
  let {
    blueMotionVisible = true,
    redMotionVisible = true,
    onToggleBlue = () => {},
    onToggleRed = () => {},
  }: {
    blueMotionVisible?: boolean;
    redMotionVisible?: boolean;
    onToggleBlue?: () => void;
    onToggleRed?: () => void;
  } = $props();
</script>

<!-- Blue Motion Visibility Button -->
<button
  class="vis-btn blue-vis-btn"
  class:active={blueMotionVisible}
  onclick={onToggleBlue}
  type="button"
  title={blueMotionVisible ? "Hide blue motion" : "Show blue motion"}
  aria-label={blueMotionVisible ? "Hide blue motion" : "Show blue motion"}
>
  <i
    class="fas {blueMotionVisible ? 'fa-eye' : 'fa-eye-slash'}"
    aria-hidden="true"
  ></i>
</button>

<!-- Red Motion Visibility Button -->
<button
  class="vis-btn red-vis-btn"
  class:active={redMotionVisible}
  onclick={onToggleRed}
  type="button"
  title={redMotionVisible ? "Hide red motion" : "Show red motion"}
  aria-label={redMotionVisible ? "Hide red motion" : "Show red motion"}
>
  <i
    class="fas {redMotionVisible ? 'fa-eye' : 'fa-eye-slash'}"
    aria-hidden="true"
  ></i>
</button>

<style>
  /* ===========================
     2026 BENTO BOX DESIGN
     Motion Visibility Buttons
     =========================== */

  .vis-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    padding: 0;
    width: 100%;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    box-shadow:
      0 1px 3px var(--theme-shadow),
      inset 0 1px 0 color-mix(in srgb, var(--theme-text) 3%, transparent);
  }

  @media (hover: hover) and (pointer: fine) {
    .vis-btn:hover {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text, var(--theme-text-dim));
      transform: translateY(-1px);
      box-shadow:
        0 2px 8px var(--theme-shadow),
        inset 0 1px 0 color-mix(in srgb, var(--theme-text) 5%, transparent);
    }
  }

  .vis-btn:active {
    transform: scale(0.97);
  }

  /* Blue visibility button */
  .vis-btn.active.blue-vis-btn {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--prop-blue) 22%, transparent) 0%,
      color-mix(in srgb, var(--prop-blue) 16%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--prop-blue) 55%, transparent);
    color: color-mix(in srgb, var(--prop-blue) 35%, white);
    box-shadow:
      0 2px 12px color-mix(in srgb, var(--prop-blue) 22%, transparent),
      0 0 16px color-mix(in srgb, var(--prop-blue) 16%, transparent),
      inset 0 1px 0 var(--theme-stroke);
  }

  @media (hover: hover) and (pointer: fine) {
    .vis-btn.active.blue-vis-btn:hover {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--prop-blue) 32%, transparent) 0%,
        color-mix(in srgb, var(--prop-blue) 24%, transparent) 100%
      );
      border-color: color-mix(in srgb, var(--prop-blue) 70%, transparent);
      box-shadow:
        0 4px 16px color-mix(in srgb, var(--prop-blue) 30%, transparent),
        0 0 20px color-mix(in srgb, var(--prop-blue) 22%, transparent),
        inset 0 1px 0 var(--theme-card-hover-bg);
    }
  }

  /* Red visibility button */
  .vis-btn.active.red-vis-btn {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--prop-red) 22%, transparent) 0%,
      color-mix(in srgb, var(--prop-red) 16%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--prop-red) 55%, transparent);
    color: color-mix(in srgb, var(--prop-red) 35%, white);
    box-shadow:
      0 2px 12px color-mix(in srgb, var(--prop-red) 22%, transparent),
      0 0 16px color-mix(in srgb, var(--prop-red) 16%, transparent),
      inset 0 1px 0 var(--theme-stroke);
  }

  @media (hover: hover) and (pointer: fine) {
    .vis-btn.active.red-vis-btn:hover {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--prop-red) 32%, transparent) 0%,
        color-mix(in srgb, var(--prop-red) 24%, transparent) 100%
      );
      border-color: color-mix(in srgb, var(--prop-red) 70%, transparent);
      box-shadow:
        0 4px 16px color-mix(in srgb, var(--prop-red) 30%, transparent),
        0 0 20px color-mix(in srgb, var(--prop-red) 22%, transparent),
        inset 0 1px 0 var(--theme-card-hover-bg);
    }
  }


  @media (prefers-reduced-motion: reduce) {
    .vis-btn {
      transition: none;
    }

    .vis-btn:hover,
    .vis-btn:active {
      transform: none;
    }
  }
</style>
