<script lang="ts">
  import type {
    EffectId,
    EffectsConfigState,
  } from "$lib/shared/effects/state/effects-config-state.svelte";
  import type { EffectControlOverrides } from "$lib/shared/effects/effect-control-fields";
  import { advancedControls } from "$lib/shared/effects/domain/effect-control-manifest";
  import EffectControlStack from "$lib/shared/effects/components/EffectControlStack.svelte";
  import EffectPresetsSection from "./EffectPresetsSection.svelte";
  import type { EffectRegistration } from "./effect-registry";

  type SettingValue = string | number | boolean | null;

  interface Props {
    effect: EffectId;
    registration: EffectRegistration;
    config: EffectsConfigState;
    activePresetId: string | null;
    defaultChipId: string;
    customChipId: string;
    customDisabled: boolean;
    customColors: { blue: string; red: string } | null;
    summary: string;
    propType?: string | null;
    overrides?: EffectControlOverrides;
    onBack: () => void;
    onDisable: () => void;
    onSelectPreset: (presetId: string) => void;
    onSettingChange?: (
      setting: string,
      previousValue: SettingValue,
      value: SettingValue,
      coalesce?: boolean
    ) => void;
  }

  let {
    effect,
    registration,
    config,
    activePresetId,
    defaultChipId,
    customChipId,
    customDisabled,
    customColors,
    summary,
    propType = null,
    overrides,
    onBack,
    onDisable,
    onSelectPreset,
    onSettingChange,
  }: Props = $props();

  let fineTuningOpen = $state(false);
  const fineControls = $derived(advancedControls(effect));
  const hasLooks = $derived(registration.presetGroup.presets.length > 0);
</script>

<div
  class="inspector"
  class:fine-open={fineTuningOpen}
  style:--effect-accent={registration.meta.color}
  style:--effect-accent-soft={`${registration.meta.color}22`}
>
  <header class="inspector-header">
    <button class="back-action" type="button" onclick={onBack}>
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      <span>All effects</span>
    </button>

    <span class="effect-identity">
      <span class="effect-icon" aria-hidden="true">
        <i class="fas {registration.meta.icon}"></i>
      </span>
      <span class="effect-name">{registration.meta.label}</span>
    </span>

    <button
      class="off-action"
      type="button"
      onclick={onDisable}
      aria-label="Turn off {registration.meta.label}"
    >
      <i class="fas fa-power-off" aria-hidden="true"></i>
      <span>Off</span>
    </button>
  </header>

  {#if hasLooks}
    <section class="inspector-section looks-section">
      <EffectPresetsSection
        presetGroup={registration.presetGroup}
        {activePresetId}
        {defaultChipId}
        {customChipId}
        {customDisabled}
        {customColors}
        {onSelectPreset}
        effectLabel={registration.meta.label}
        accentColor={registration.meta.color}
        {summary}
        showSummary={false}
        showCustomize={false}
      />
    </section>
  {/if}

  <div class="tuning-column">
    <section class="inspector-section tune-section">
      <div class="section-heading">
        <span class="section-title">Tune the look</span>
        <span class="section-help">Changes appear on the canvas</span>
      </div>
      <EffectControlStack
        {effect}
        {config}
        tiers={["primary", "tracking"]}
        {propType}
        {overrides}
        {onSettingChange}
      />
    </section>

    {#if fineControls.length > 0}
      <section class="inspector-section fine-section">
        <button
          class="fine-toggle"
          class:open={fineTuningOpen}
          type="button"
          aria-expanded={fineTuningOpen}
          onclick={() => (fineTuningOpen = !fineTuningOpen)}
        >
          <span class="fine-copy">
            <span class="section-title">Fine tuning</span>
            <span class="section-help">
              {fineControls.length}
              {fineControls.length === 1 ? "control" : "controls"}
            </span>
          </span>
          <i class="fas fa-chevron-down" aria-hidden="true"></i>
        </button>

        {#if fineTuningOpen}
          <div class="fine-controls">
            <EffectControlStack
              {effect}
              {config}
              tiers={["advanced"]}
              {propType}
              {overrides}
              {onSettingChange}
            />
          </div>
        {/if}
      </section>
    {/if}
  </div>
</div>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    min-width: 0;
    container: effect-inspector / inline-size;
    --theme-accent: var(--effect-accent);
  }

  .inspector-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "identity identity"
      "back off";
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.07));
  }

  .back-action,
  .off-action {
    min-height: var(--min-touch-target, 44px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 13px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 100ms) ease,
      background var(--duration-fast, 100ms) ease,
      color var(--duration-fast, 100ms) ease;
  }

  .back-action {
    grid-area: back;
    justify-self: start;
  }

  .back-action:hover {
    border-color: color-mix(in srgb, var(--effect-accent) 55%, transparent);
    background: var(--effect-accent-soft);
    color: var(--theme-text, white);
  }

  .off-action {
    grid-area: off;
    justify-self: end;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
  }

  .off-action:hover {
    border-color: color-mix(
      in srgb,
      var(--semantic-danger, #ef4444) 45%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--semantic-danger, #ef4444) 9%,
      transparent
    );
    color: var(--semantic-danger, #ef4444);
  }

  .back-action:focus-visible,
  .off-action:focus-visible,
  .fine-toggle:focus-visible {
    outline: 2px solid var(--effect-accent);
    outline-offset: 2px;
  }

  .effect-identity {
    grid-area: identity;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    min-width: 0;
  }

  .effect-icon {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--effect-accent) 35%, transparent);
    border-radius: 12px;
    background: var(--effect-accent-soft);
    color: var(--effect-accent);
    font-size: 19px;
  }

  .effect-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--theme-text, white);
    font-size: clamp(18px, 1.45vw, 22px);
    font-weight: 750;
    line-height: 1.1;
  }

  .inspector-section {
    padding: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.07));
  }

  .tune-section {
    display: grid;
    gap: 14px;
  }

  .tuning-column {
    display: contents;
  }

  .looks-section {
    border-top: 0;
  }

  .section-heading,
  .fine-copy {
    display: grid;
    gap: 2px;
  }

  .section-title {
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 720;
    line-height: 1.2;
  }

  .section-help {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
  }

  .fine-section {
    padding: 0;
  }

  .fine-toggle {
    width: 100%;
    min-height: 62px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    border: 0;
    background: transparent;
    color: var(--theme-text, white);
    text-align: left;
    cursor: pointer;
  }

  .fine-toggle:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.035));
  }

  .fine-toggle i {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: transform var(--duration-fast, 100ms) ease;
  }

  .fine-toggle.open i {
    transform: rotate(180deg);
  }

  .fine-controls {
    padding: 0 16px 16px;
  }

  @container effect-inspector (max-width: 26rem) {
    .off-action span {
      display: none;
    }

    .off-action {
      width: var(--min-touch-target, 44px);
      padding: 0;
    }
  }

  @container effect-inspector (min-width: 32rem) {
    .inspector-header {
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas: "back identity off";
    }

    .effect-identity {
      justify-content: center;
    }
  }

  /* Post Studio uses the available height by placing the look gallery beside
     its controls. The cards remain vertical at this first seam so their effect
     previews are still readable in a moderately wide inspector. */
  @container post-studio-animation-settings (min-width: 35rem) {
    .inspector {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(15rem, 0.92fr);
      grid-template-areas:
        "header header"
        "looks tuning";
      align-items: start;
    }

    .inspector-header {
      grid-area: header;
    }

    .looks-section {
      grid-area: looks;
      border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.07));
    }

    .tuning-column {
      grid-area: tuning;
      display: flex;
      flex-direction: column;
      min-width: 0;
      align-self: start;
    }

    .tune-section {
      border-top: 0;
    }

    .inspector-section {
      padding: 18px 20px;
    }

    .looks-section :global(.anchor-grid) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .fine-controls {
      padding-inline: 20px;
    }
  }

  /* A larger inspector turns each look into a horizontal study while keeping
     the same gallery-and-controls composition. */
  @container post-studio-animation-settings (min-width: 52rem) {
    .inspector {
      grid-template-columns: minmax(0, 1.12fr) minmax(20rem, 0.88fr);
    }

    .looks-section :global(.preset-grid) {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .looks-section :global(.preset-card) {
      display: grid;
      grid-template-columns: minmax(13rem, 1.45fr) minmax(8rem, 0.55fr);
      grid-template-rows: auto 1fr;
      align-items: center;
      column-gap: 14px;
      row-gap: 4px;
      padding: 10px;
    }

    .looks-section :global(.preview-area) {
      grid-column: 1;
      grid-row: 1 / span 2;
    }

    .looks-section :global(.preset-name),
    .looks-section :global(.preset-trait) {
      grid-column: 2;
    }

    .looks-section :global(.preset-name) {
      align-self: end;
    }

    .looks-section :global(.preset-trait) {
      align-self: start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .back-action,
    .off-action,
    .fine-toggle i {
      transition: none;
    }
  }
</style>
