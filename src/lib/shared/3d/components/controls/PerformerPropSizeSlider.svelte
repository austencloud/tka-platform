<script lang="ts">
  import { inchesToCm } from "@austencloud/scene-3d";
  import type { AvatarInstanceState } from "../../state/avatar-instance-state.svelte";

  interface Props {
    performer: AvatarInstanceState;
    onSizeChange?: (cm: number) => void;
  }
  let { performer, onSizeChange }: Props = $props();

  const currentCm = $derived(performer.settings.staffLengthCm ?? 81);
  const displayInches = $derived(Math.round(currentCm / 2.54));

  function handleInput(e: Event) {
    const cm = Number((e.currentTarget as HTMLInputElement).value);
    if (onSizeChange) {
      onSizeChange(cm);
    } else {
      performer.setStaffLengthCm(cm);
    }
  }
</script>

<div class="prop-size">
  <div class="size-header">
    <span class="size-label">Prop size</span>
    <span class="size-value">{displayInches} in</span>
  </div>
  <input
    type="range"
    class="size-slider"
    min={inchesToCm(24)}
    max={inchesToCm(60)}
    step="1"
    value={currentCm}
    oninput={handleInput}
    aria-label="Prop size"
  />
</div>

<style>
  .prop-size {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .size-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .size-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.72);
  }
  .size-value {
    font-size: 12px;
    font-weight: 700;
    color: #cfe4ff;
    font-variant-numeric: tabular-nums;
    margin-left: auto;
  }
  .size-slider {
    width: 100%;
    height: 6px;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
    transition: background 180ms;
  }
  .size-slider:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .size-slider::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #60a5fa;
    border: 2.5px solid rgba(20, 22, 32, 1);
    cursor: pointer;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.35);
    transition: box-shadow 180ms, transform 180ms;
  }
  .size-slider::-webkit-slider-thumb:hover {
    box-shadow: 0 0 16px rgba(96, 165, 250, 0.55);
    transform: scale(1.1);
  }
  .size-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #60a5fa;
    border: 2.5px solid rgba(20, 22, 32, 1);
    cursor: pointer;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.35);
  }
</style>
