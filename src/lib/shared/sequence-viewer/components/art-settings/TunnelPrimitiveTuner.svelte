<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import PerformerRing from "../../tunnel/PerformerRing.svelte";
  import type { TunnelViewController } from "../../tunnel/tunnel-view-controller.svelte";
  import { FOLD_OPTIONS, configsEqual } from "../../tunnel/tunnel-config";
  import { tunnelUserPresets } from "../../tunnel/tunnel-user-presets.svelte";
  import { changeArtSetting, reportArtSetting } from "./art-setting-change";
  import type {
    ArtSettingChangeHandler,
    ArtSettingValue,
  } from "./art-settings-types";

  interface Props {
    controller: TunnelViewController;
    onBack: () => void;
    onArtSettingChange?: ArtSettingChangeHandler;
  }

  let { controller, onBack, onArtSettingChange }: Props = $props();

  function reportSetting(
    group: string,
    setting: string,
    previousValue: ArtSettingValue,
    value: ArtSettingValue,
    coalesce = false
  ): void {
    reportArtSetting(
      onArtSettingChange,
      group,
      setting,
      previousValue,
      value,
      coalesce
    );
  }

  function changeSetting(
    group: string,
    setting: string,
    previousValue: ArtSettingValue,
    value: ArtSettingValue,
    mutate: () => void,
    coalesce = false
  ): void {
    changeArtSetting(
      onArtSettingChange,
      group,
      setting,
      previousValue,
      value,
      mutate,
      coalesce
    );
  }

  // Save-as-preset flow (in the tuner, when the config is a custom look).
  let savingPreset = $state(false);
  let presetName = $state("");

  // The saved user preset matching the live config (lights its card), and whether
  // the live config is a genuinely custom look (no built-in AND no saved match).
  const activeUserId = $derived(
    tunnelUserPresets.presets.find((p) =>
      configsEqual(p.config, controller.config)
    )?.id ?? null
  );
  const isCustom = $derived(
    controller.activePresetId === null && activeUserId === null
  );

  function saveCurrentPreset(): void {
    const previousCount = tunnelUserPresets.presets.length;
    tunnelUserPresets.add(presetName, controller.config);
    reportSetting(
      "art_tunnel",
      "saved_preset_count",
      previousCount,
      previousCount + 1
    );
    presetName = "";
    savingPreset = false;
  }

  function startSavingPreset(): void {
    if (savingPreset) return;
    savingPreset = true;
    presetName = "";
    reportSetting("art_tunnel", "save_preset_open", false, true);
  }

  function cancelSavingPreset(): void {
    if (!savingPreset) return;
    savingPreset = false;
    reportSetting("art_tunnel", "save_preset_open", true, false);
  }

  // Copies (fold) shown as a ×multiplier, not a count — so the segmented value
  // never collides with the "performers" total (×1 selected + Mirror ×2 = 2
  // performers, not "1 performer"). One base performer, everything multiplies it.
  const foldSegOptions = FOLD_OPTIONS.map((a) => ({
    value: String(a),
    label: `×${a}`,
  }));

  // Two families (per chip-primitives: independent booleans → N × FilterChipBase).
  // Twins GROW the cast: Mirror/Flip each add a reflected copy of every performer
  // (×2). Motion modulators change how copies move but add NONE (the count holds).
  const twinChips = $derived([
    {
      key: "mirror",
      label: "Mirror ×2",
      icon: "fas fa-arrows-left-right",
      active: controller.mirror,
      set: (v: boolean) => controller.setMirror(v),
    },
    {
      key: "flip",
      label: "Flip ×2",
      icon: "fas fa-arrows-up-down",
      active: controller.flip,
      set: (v: boolean) => controller.setFlip(v),
    },
  ]);
  const motionChips = $derived([
    {
      key: "invert",
      label: "Invert",
      icon: "fas fa-arrows-spin",
      active: controller.invert,
      set: (v: boolean) => controller.setInvert(v),
    },
    {
      key: "echo",
      label: "Echo",
      icon: "fas fa-backward",
      active: controller.echo,
      set: (v: boolean) => controller.setEcho(v),
    },
  ]);

  // Faint build-up under the big result: one base performer × each active
  // count-multiplier. Only factors >×1 show, so it reads "1 × 2 copies × 2 mirror".
  const tunnelFactors = $derived(
    [
      controller.fold > 1 ? { x: controller.fold, label: "copies" } : null,
      controller.mirror ? { x: 2, label: "mirror" } : null,
      controller.flip ? { x: 2, label: "flip" } : null,
    ].filter((f): f is { x: number; label: string } => f !== null)
  );
</script>

<!-- SECONDARY: the primitive tuner. Every tunnel is a combination of
         these. Even card grid for the toggles — no ragged wrap. -->
<button class="back-btn" type="button" onclick={onBack}>
  <i class="fas fa-chevron-left" aria-hidden="true"></i> Presets
</button>

<!-- Hero: the countable Performer Ring + the big result. One base
         performer ("you", haloed); every count-builder multiplies it. The
         faint line under it shows the build-up (1 × 2 copies × 2 mirror). -->
<div class="tuner-hero">
  <div class="ring-seat">
    <PerformerRing config={controller.config} size={104} />
  </div>
  <p class="tuner-result">
    <span class="tr-n">{controller.performerCount}</span>
    {controller.performerCount === 1 ? "performer" : "performers"}
    <span class="tr-mid">·</span>
    <span class="tr-n">{controller.propCount}</span> props
  </p>
  {#if tunnelFactors.length}
    <p class="tuner-build">
      <span class="tb-seed">1</span>
      {#each tunnelFactors as f (f.label)}
        <span class="tb-x">×</span> {f.x} {f.label}
      {/each}
    </p>
  {:else}
    <p class="tuner-build">just you</p>
  {/if}
</div>

<!-- Copies (fold) as a ×multiplier of the base performer + Grid toggle. -->
<div class="prim-row">
  <span class="row-lbl">Copies</span>
  <div class="seg-wrap">
    <SegmentedControl
      options={foldSegOptions}
      value={String(controller.fold)}
      onchange={(v) =>
        changeSetting("art_tunnel", "copies", controller.fold, Number(v), () =>
          controller.setFold(Number(v))
        )}
      color="accent"
      size="sm"
    />
  </div>
  <button
    class="grid-toggle"
    class:active={controller.gridVisible}
    type="button"
    aria-pressed={controller.gridVisible}
    aria-label="Toggle grid"
    data-ghost="safe"
    data-ghost-kind="view-toggle"
    data-ghost-label="Toggle grid"
    title="Grid"
    onclick={() =>
      changeSetting(
        "art_tunnel",
        "grid_visible",
        controller.gridVisible,
        !controller.gridVisible,
        () => (controller.gridVisible = !controller.gridVisible)
      )}
  >
    <i class="fas fa-border-all" aria-hidden="true"></i>
  </button>
</div>

<!-- Add twins — each doubles the cast (a reflected copy of every performer). -->
<div class="prim-group">
  <span class="group-lbl"
    >Add twins <span class="group-hint">— each doubles</span></span
  >
  <div class="prim-chip-grid">
    {#each twinChips as chip (chip.key)}
      <FilterChipBase
        mode="toggle"
        emphasis="solid"
        size="sm"
        label={chip.label}
        icon={chip.icon}
        active={chip.active}
        onclick={() =>
          changeSetting("art_tunnel", chip.key, chip.active, !chip.active, () =>
            chip.set(!chip.active)
          )}
      />
    {/each}
  </div>
</div>

<!-- Motion — changes how copies move; the count never changes. Stagger
         (canon offset) lives here: arm k shows the sequence k×N steps ahead. -->
<div class="prim-group">
  <span class="group-lbl"
    >Motion <span class="group-hint">— same count</span></span
  >
  <div class="prim-chip-grid">
    {#each motionChips as chip (chip.key)}
      <FilterChipBase
        mode="toggle"
        emphasis="solid"
        size="sm"
        label={chip.label}
        icon={chip.icon}
        active={chip.active}
        onclick={() =>
          changeSetting("art_tunnel", chip.key, chip.active, !chip.active, () =>
            chip.set(!chip.active)
          )}
      />
    {/each}
  </div>
  <div class="prim-row">
    <span class="row-lbl">Stagger</span>
    <div class="stepper">
      <button
        type="button"
        class="step-btn"
        aria-label="Less stagger"
        disabled={controller.staggerSteps <= 0}
        onclick={() =>
          changeSetting(
            "art_tunnel",
            "stagger_steps",
            controller.staggerSteps,
            controller.staggerSteps - 1,
            () => controller.setStagger(controller.staggerSteps - 1)
          )}
      >
        <i class="fas fa-minus" aria-hidden="true"></i>
      </button>
      <span class="step-val">{controller.staggerSteps}</span>
      <button
        type="button"
        class="step-btn"
        aria-label="More stagger"
        disabled={controller.staggerSteps >= controller.staggerMax}
        onclick={() =>
          changeSetting(
            "art_tunnel",
            "stagger_steps",
            controller.staggerSteps,
            controller.staggerSteps + 1,
            () => controller.setStagger(controller.staggerSteps + 1)
          )}
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</div>

<!-- Save the current mix as a personal preset (only when it's a genuinely
         custom look — matching a built-in or saved one needs no save). -->
{#if isCustom}
  {#if savingPreset}
    <div class="save-row">
      <input
        class="save-input"
        type="text"
        bind:value={presetName}
        maxlength="40"
        placeholder="Name this tunnel"
        aria-label="Preset name"
      />
      <button
        data-save-shortcut
        class="save-confirm"
        type="button"
        onclick={saveCurrentPreset}>Save</button
      >
      <button
        class="save-cancel"
        type="button"
        aria-label="Cancel save"
        onclick={cancelSavingPreset}
      >
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
  {:else}
    <button class="save-preset-btn" type="button" onclick={startSavingPreset}>
      <i class="fas fa-star" aria-hidden="true"></i> Save as preset
    </button>
  {/if}
{/if}

<style>
  .prim-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }
  .prim-row .row-lbl {
    flex: 0 0 52px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .seg-wrap {
    flex: 1;
    min-width: 0;
  }

  /* Tuner hero: countable performer ring + big result + a faint build-up line
     (one base performer × each active count-multiplier). */
  .tuner-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 4px 0 8px;
  }
  /* Seat the schematic on a real card so it reads against a dark stage (matches
     the card/stroke surface treatment; the ring's own contrast fix does the rest). */
  .ring-seat {
    display: grid;
    place-items: center;
    padding: 10px;
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
  .tuner-result {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    font-variant-numeric: tabular-nums;
  }
  .tuner-result .tr-n {
    font-weight: 700;
    color: var(--theme-text, #fff);
  }
  .tuner-result .tr-mid {
    opacity: 0.4;
    margin: 0 5px;
  }
  .tuner-build {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-variant-numeric: tabular-nums;
  }
  .tuner-build .tb-seed {
    color: var(--theme-accent, #c79bff);
    font-weight: 700;
  }
  .tuner-build .tb-x {
    opacity: 0.5;
    margin: 0 1px;
  }

  /* A labeled group of related controls (Add twins / Motion). */
  .prim-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .group-lbl {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .group-hint {
    text-transform: none;
    letter-spacing: 0;
    opacity: 0.75;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    min-height: var(--min-touch-target, 44px);
    padding: 6px 8px;
    background: none;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
  }
  .back-btn:hover {
    color: var(--theme-text, #fff);
  }
  .back-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
    border-radius: 6px;
  }
  .prim-chip-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
    gap: 6px;
  }
  .prim-chip-grid :global(.filter-chip) {
    width: 100%;
    justify-content: center;
  }

  /* Save-as-preset: a dashed CTA that becomes a name row. */
  .save-preset-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 14px;
    border: 1.5px dashed
      color-mix(in srgb, var(--theme-accent) 45%, transparent);
    border-radius: 10px;
    background: transparent;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.12s ease,
      border-color 0.12s ease;
  }
  .save-preset-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 65%, transparent);
  }
  .save-preset-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }
  .save-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .save-input {
    flex: 1;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    padding: 6px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 9px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
  }
  .save-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }
  .save-input:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 1px;
  }
  .save-confirm {
    flex: 0 0 auto;
    min-height: var(--min-touch-target, 44px);
    padding: 6px 14px;
    border: 1.5px solid var(--theme-accent);
    border-radius: 9px;
    background: var(--theme-accent);
    color: var(--theme-text-on-accent, #fff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
  }
  .save-cancel {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 9px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: inherit;
    cursor: pointer;
  }
  .save-confirm:focus-visible,
  .save-cancel:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Compact icon toggle for the grid — a small square, keeping the 44px floor. */
  .grid-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 9px;
    color: inherit;
    cursor: pointer;
    transition:
      background 0.12s,
      border-color 0.12s;
  }
  .grid-toggle.active {
    background: var(--theme-accent, #8b5cf6);
    border-color: transparent;
    color: #fff;
  }
  .step-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 9px;
    color: inherit;
    cursor: pointer;
    transition:
      background 0.12s,
      border-color 0.12s;
  }
  .step-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .step-val {
    min-width: 2ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
  }

  .stepper {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  /* Dock composition preserves the shared touch floor while tightening gaps. */
  :global(.dock-dense) .prim-chip-grid {
    gap: 4px;
  }
  :global(.dock-dense) .prim-row {
    min-height: 40px;
    gap: 6px;
  }
</style>
