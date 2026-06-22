<script lang="ts">
  /**
   * EffectControlStack - renders an effect's control descriptors (from the
   * shared manifest) into the canonical primitives. Both the 2D customize
   * panels and the 3D viewer popover mount this against the same
   * EffectsConfigState, so the manifest is the single source of truth.
   *
   * Single-selects route to the shared SegmentedControl (chip-primitives rule);
   * sliders/colors centralize the inline markup the 2D panels repeated (there is
   * no shared input-component library). Toggles use the button + indicator
   * pattern (no checkboxes).
   */
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import type { EffectsConfigState, EffectId } from "$lib/shared/effects/state/effects-config-state.svelte";
  import {
    EFFECT_CONTROLS,
    type ControlDescriptor,
    type ControlTier,
  } from "$lib/shared/effects/domain/effect-control-manifest";

  interface Props {
    effect: EffectId;
    config: EffectsConfigState;
    /** Which tiers to render. Default = the Primary view. */
    tiers?: ControlTier[];
  }
  let { effect, config, tiers = ["primary", "tracking"] }: Props = $props();

  const intent = $derived(config.effect(effect) as unknown as Record<string, unknown>);
  const controls = $derived(
    EFFECT_CONTROLS[effect].filter(
      (c) => tiers.includes(c.tier) && (!c.showWhen || c.showWhen(intent)),
    ),
  );

  function get(field: string): unknown {
    return intent[field];
  }
  function set(field: string, value: unknown) {
    config.updateEffect(effect, { [field]: value } as never);
  }
  function fmt(c: ControlDescriptor, v: number): string {
    if (c.pct) return `${Math.round(v * 100)}%`;
    return Number.isInteger(v) ? `${v}` : v.toFixed(1);
  }
</script>

<div class="control-stack">
  {#each controls as c (c.id)}
    {#if c.type === "slider"}
      <div class="ctl-row">
        <span class="ctl-label">{c.label}</span>
        <input
          type="range"
          min={c.min}
          max={c.max}
          step={c.step}
          value={get(c.field) as number}
          oninput={(e) => set(c.field, parseFloat(e.currentTarget.value))}
          class="ctl-slider"
        />
        <span class="ctl-value">{fmt(c, get(c.field) as number)}</span>
      </div>
    {:else if c.type === "segmented" || c.type === "palette"}
      {@const opts =
        c.type === "palette"
          ? c.paletteOptions!.map((p) => ({ value: p.value, label: p.label }))
          : c.options!}
      <div class="ctl-row ctl-row-wide">
        <span class="ctl-label">{c.label}</span>
        <SegmentedControl
          options={opts}
          value={get(c.field) as string}
          onchange={(v) => set(c.field, v)}
          color="accent"
          size="sm"
        />
      </div>
    {:else if c.type === "toggle"}
      <div class="ctl-row">
        <span class="ctl-label">{c.label}</span>
        <button
          type="button"
          class="ctl-toggle"
          class:on={get(c.field) === true}
          aria-pressed={get(c.field) === true}
          aria-label={c.label}
          onclick={() => set(c.field, !(get(c.field) as boolean))}
        >
          <span class="ctl-toggle-dot"></span>
        </button>
      </div>
    {:else if c.type === "chip"}
      <div class="ctl-row ctl-row-wide">
        <span class="ctl-label">{c.label}</span>
        <button
          type="button"
          class="ctl-chip"
          class:active={get(c.field) === true}
          aria-pressed={get(c.field) === true}
          aria-label={c.label}
          onclick={() => set(c.field, !(get(c.field) as boolean))}
        >
          {#if c.swatch === "rainbow"}
            <span class="swatch rainbow" aria-hidden="true"></span>
          {/if}
          {c.label}
        </button>
      </div>
    {:else if c.type === "color"}
      <div class="ctl-row">
        <span class="ctl-label">{c.label}</span>
        <label class="ctl-color">
          <input
            type="color"
            value={get(c.field) as string}
            oninput={(e) => set(c.field, e.currentTarget.value)}
          />
        </label>
      </div>
    {:else if c.type === "colorPair"}
      <div class="ctl-row">
        <span class="ctl-label">{c.label}</span>
        <div class="ctl-pair">
          <label class="ctl-color">
            <input
              type="color"
              value={intent[c.pairFields![0]] as string}
              oninput={(e) => set(c.pairFields![0], e.currentTarget.value)}
            />
          </label>
          <label class="ctl-color">
            <input
              type="color"
              value={intent[c.pairFields![1]] as string}
              oninput={(e) => set(c.pairFields![1], e.currentTarget.value)}
            />
          </label>
        </div>
      </div>
    {/if}
    <!-- "ledPattern" + "paletteSwatches" are wired in Task 2b. -->
  {/each}
</div>

<style>
  .control-stack {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .ctl-row {
    display: grid;
    grid-template-columns: 4.5rem 1fr auto;
    align-items: center;
    gap: 0.5rem;
  }

  /* Segmented/palette rows let the control take the full remaining width. */
  .ctl-row-wide {
    grid-template-columns: 4.5rem 1fr;
  }

  .ctl-label {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim);
  }

  .ctl-slider {
    width: 100%;
    height: 6px;
    appearance: none;
    background: var(--theme-panel-bg);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
  }
  .ctl-slider::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--theme-accent, #4a9eff);
    border-radius: 50%;
    cursor: pointer;
  }
  .ctl-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--theme-accent, #4a9eff);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  .ctl-value {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text);
    text-align: right;
    font-variant-numeric: tabular-nums;
    min-width: 3ch;
  }

  .ctl-color {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid var(--theme-stroke);
  }
  .ctl-color input {
    width: 150%;
    height: 150%;
    margin: -25%;
    border: none;
    padding: 0;
    background: none;
    cursor: pointer;
  }

  .ctl-pair {
    display: flex;
    gap: 0.4rem;
  }

  /* Rainbow chip — the same chip the 2D EffectsPanel preset strip uses, so the
     boolean reads as a selectable chip rather than an iOS pill squashed to the
     touch-target floor. */
  .ctl-chip {
    justify-self: start;
    height: 32px;
    padding: 0 12px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all var(--duration-fast, 0.15s) ease;
  }
  .ctl-chip:hover {
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }
  .ctl-chip.active {
    background: color-mix(in srgb, var(--theme-accent, #4a9eff) 18%, transparent);
    border-color: var(--theme-accent, #4a9eff);
    color: var(--theme-text);
  }
  .ctl-chip .swatch {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  /* Literal spectrum hexes — these preview the rainbow itself, not UI chrome. */
  .ctl-chip .swatch.rainbow {
    background: conic-gradient(
      from 0deg,
      #ef4444,
      #f59e0b,
      #eab308,
      #22c55e,
      #06b6d4,
      #3b82f6,
      #8b5cf6,
      #ef4444
    );
  }

  .ctl-toggle {
    width: 40px;
    height: 22px;
    border-radius: 11px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
    position: relative;
    cursor: pointer;
    padding: 0;
  }
  .ctl-toggle.on {
    background: var(--theme-accent, #4a9eff);
    border-color: var(--theme-accent, #4a9eff);
  }
  .ctl-toggle-dot {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    transition: left var(--duration-fast, 0.15s);
  }
  .ctl-toggle.on .ctl-toggle-dot {
    left: 20px;
  }
</style>
