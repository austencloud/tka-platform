<script lang="ts">
  import EffectLookChips from "./EffectLookChips.svelte";
  import type { EffectRegistration } from "./effect-registry";
  import type { PrimaryParamSpec } from "./effect-primary-param";

  /**
   * The active effect's controls, docked beneath the roster.
   *
   * The roster is the point: browsing effects must never navigate. So the one
   * thing you reach for right after picking an effect - its Look, and its
   * headline knob - lives here, under the grid, instead of behind a screen
   * transition. Deep tuning stays one click away via Tune.
   *
   * Three fixed rows. All sixteen effects register a primary param and the Look
   * rail always carries Default and Custom, so the dock's height never depends
   * on which effect is selected and nothing below it jumps when you switch
   * (no-layout-shift.md).
   */
  interface Props {
    registration: EffectRegistration;
    activePresetId: string | null;
    defaultChipId: string;
    customChipId: string;
    customDisabled?: boolean;
    customColors?: { blue: string; red: string } | null;
    primarySpec?: PrimaryParamSpec;
    primaryValue: number;
    onSelectPreset: (presetId: string) => void;
    onPrimaryInput: (value: number) => void;
    onTune: () => void;
    /** Sidebar opens the full inspector; the popover opens deep tuning. */
    tuneLabel?: string;
    /**
     * Show every look at once instead of on a scrolling rail. The tall desktop
     * sidebar passes this; the phone tray and the popover cannot spare the rows.
     */
    wrapLooks?: boolean;
  }

  const {
    registration,
    activePresetId,
    defaultChipId,
    customChipId,
    customDisabled = false,
    customColors = null,
    primarySpec,
    primaryValue,
    onSelectPreset,
    onPrimaryInput,
    onTune,
    tuneLabel = "Tune",
    wrapLooks = false,
  }: Props = $props();

  function handleSliderInput(ev: Event): void {
    onPrimaryInput(parseFloat((ev.currentTarget as HTMLInputElement).value));
  }
</script>

<section
  class="effect-dock"
  style:--effect-accent={registration.meta.color}
  aria-label="{registration.meta.label} controls"
>
  <div class="dock-head">
    <span class="dock-identity">
      <i
        class="fas {registration.meta.icon} dock-icon"
        aria-hidden="true"
      ></i>
      <span class="dock-name">{registration.meta.label}</span>
    </span>
    <button type="button" class="tune-btn" onclick={onTune}>
      <i class="fas fa-sliders" aria-hidden="true"></i>
      <span>{tuneLabel}</span>
    </button>
  </div>

  <EffectLookChips
    presetGroup={registration.presetGroup}
    {activePresetId}
    {defaultChipId}
    {customChipId}
    {customDisabled}
    {customColors}
    accentColor={registration.meta.color}
    effectLabel={registration.meta.label}
    onSelect={onSelectPreset}
    wrap={wrapLooks}
  />

  {#if primarySpec}
    <div class="slider-row">
      <span class="slider-label">{primarySpec.label}</span>
      <input
        type="range"
        class="slider"
        min={primarySpec.min}
        max={primarySpec.max}
        step={primarySpec.step}
        value={primaryValue}
        oninput={handleSliderInput}
        aria-label="{primarySpec.label} for {registration.meta.label}"
      />
      <span class="slider-val">{primarySpec.format(primaryValue)}</span>
    </div>
  {/if}
</section>

<style>
  .effect-dock {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.625rem;
    border-radius: 0.75rem;
    border: 1px solid
      color-mix(in srgb, var(--effect-accent) 28%, transparent);
    background: color-mix(in srgb, var(--effect-accent) 7%, transparent);
    min-width: 0;
  }

  .dock-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .dock-identity {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1 1 auto;
    min-width: 0;
  }

  .dock-icon {
    font-size: 1rem;
    color: var(--effect-accent);
    flex-shrink: 0;
  }

  .dock-name {
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--theme-text, white);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* A real button, not a text link - it is the primary action of this dock
     (clickables-look-like-buttons.md). */
  .tune-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid
      color-mix(in srgb, var(--effect-accent) 45%, transparent);
    background: color-mix(in srgb, var(--effect-accent) 16%, transparent);
    color: var(--theme-text, white);
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }

  .tune-btn:hover {
    background: color-mix(in srgb, var(--effect-accent) 26%, transparent);
    border-color: color-mix(in srgb, var(--effect-accent) 70%, transparent);
  }

  .tune-btn:focus-visible {
    outline: 2px solid var(--effect-accent);
    outline-offset: 2px;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .slider-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    flex-shrink: 0;
  }

  .slider {
    flex: 1 1 auto;
    min-width: 0;
    height: 22px;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    cursor: pointer;
  }
  .slider::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -5px;
    border-radius: 50%;
    background: var(--theme-text, white);
    box-shadow: 0 2px 6px var(--theme-shadow, rgba(0, 0, 0, 0.4));
    cursor: pointer;
  }
  .slider::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .slider::-moz-range-progress {
    height: 6px;
    border-radius: 3px;
    background: var(--effect-accent);
  }
  .slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: var(--theme-text, white);
    box-shadow: 0 2px 6px var(--theme-shadow, rgba(0, 0, 0, 0.4));
    cursor: pointer;
  }

  /* Tabular figures: the value changes as you drag, and a proportional 0.55 is
     a different width from 0.11 - which would shove the slider (no-layout-shift). */
  .slider-val {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, white);
    min-width: 2.75rem;
    text-align: right;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .tune-btn {
      transition: none;
    }
  }
</style>
