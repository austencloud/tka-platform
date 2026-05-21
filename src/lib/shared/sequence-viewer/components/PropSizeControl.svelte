<script lang="ts">
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { userProportionsState, inchesToCm } from "@austencloud/scene-3d";
  import type { AvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";

  interface Props {
    performer: AvatarInstanceState | null;
  }

  let { performer }: Props = $props();

  const viewer = getViewer3DContext();
  const linked = $derived(viewer.propSizeLinked);
  const performerCount = $derived(viewer.performerManager.performers.length);
  const showLinkToggle = $derived(performerCount > 1);
  const selectedIndex = $derived(viewer.selectedPerformerIndex);

  const currentCm = $derived.by(() => {
    if (linked) return userProportionsState.staffLengthCm;
    if (performer?.settings.staffLengthCm != null) return performer.settings.staffLengthCm;
    return userProportionsState.staffLengthCm;
  });

  const displayValue = $derived.by(() => {
    const cm = currentCm;
    const inches = Math.round(cm / 2.54);
    return `${inches} in`;
  });

  const disabled = $derived(!linked && performer === null);

  const label = $derived.by(() => {
    if (linked) return "Prop size";
    if (selectedIndex != null) return `P${selectedIndex + 1} prop size`;
    return "Prop size";
  });

  function handleInput(e: Event) {
    const cm = Number((e.currentTarget as HTMLInputElement).value);
    if (linked) {
      userProportionsState.setStaffLengthCm(cm);
    } else if (performer) {
      performer.setStaffLengthCm(cm);
    }
  }
</script>

<div class="prop-size-control" class:disabled>
  <div class="control-header">
    <span class="control-label">{label}</span>
    <span class="control-value">{displayValue}</span>
    {#if showLinkToggle}
      <button
        type="button"
        class="link-toggle"
        aria-pressed={linked}
        aria-label={linked ? "Unlink performer prop sizes" : "Link all prop sizes"}
        onclick={(e) => { e.stopPropagation(); viewer.togglePropSizeLink(); }}
      >
        <i class="fas {linked ? 'fa-link' : 'fa-link-slash'}" aria-hidden="true"></i>
      </button>
    {/if}
  </div>
  {#if disabled}
    <div class="hint">Select a performer to set individual size</div>
  {:else}
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
  {/if}
</div>

<style>
  .prop-size-control {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: border-color 180ms;
  }

  .prop-size-control:hover:not(.disabled) {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .prop-size-control.disabled {
    opacity: 0.5;
  }

  .control-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .control-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.72);
  }

  .control-value {
    font-size: 12px;
    font-weight: 700;
    color: #cfe4ff;
    font-variant-numeric: tabular-nums;
    margin-left: auto;
  }

  .link-toggle {
    width: 28px;
    height: 28px;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 180ms;
    font-size: 12px;
    margin: -8px 0;
    padding: 0;
  }

  .link-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .link-toggle[aria-pressed="true"] {
    background: color-mix(in srgb, #60a5fa 15%, transparent);
    border-color: color-mix(in srgb, #60a5fa 40%, transparent);
    color: #60a5fa;
  }

  .hint {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    text-align: center;
    padding: 4px 0;
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
