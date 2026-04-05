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
    gap: 5px;
    padding: 7px 12px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  .plane-mode-toggle:hover {
    background: rgba(0, 0, 0, 0.7);
    color: rgba(255, 255, 255, 0.9);
  }
</style>
