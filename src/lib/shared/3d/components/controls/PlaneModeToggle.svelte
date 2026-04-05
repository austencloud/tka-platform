<script lang="ts">
  import { PlaneMode } from "../../domain/enums/PlaneMode";

  interface Props {
    mode: PlaneMode;
    onModeChange: (mode: PlaneMode) => void;
  }

  let { mode, onModeChange }: Props = $props();

  function toggle() {
    const next = mode === PlaneMode.WALL ? PlaneMode.DUAL_WHEEL : PlaneMode.WALL;
    onModeChange(next);
  }
</script>

<button
  class="plane-mode-toggle"
  onclick={toggle}
  title={mode === PlaneMode.WALL ? "Switch to dual wheel mode" : "Switch to wall mode"}
>
  <span class="label">{mode === PlaneMode.WALL ? "Wall" : "Dual Wheel"}</span>
</button>

<style>
  .plane-mode-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .plane-mode-toggle:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }
</style>
