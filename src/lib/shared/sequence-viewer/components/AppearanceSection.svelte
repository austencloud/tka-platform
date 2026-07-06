<!--
  AppearanceSection.svelte

  The Performer Set editor for the Tunnel Art panel. Each overlaid copy is a
  "performer"; this picks each performer's per-hand prop, cycling a short ordered
  cast around the ring (see tunnel-appearance.ts). Structure mirrors the mandala
  preset surface in ArtSettingsPanel: a preset grid (built-in + user-saved), then
  a roster of performers with a per-hand prop picker, a color mode, and save.

  Reuses BentoPropGrid (the compose per-hand prop picker) and SegmentedControl —
  no hand-rolled prop grid or toggle.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { TunnelViewController } from "../tunnel/tunnel-view-controller.svelte";
  import { APPEARANCE_PRESETS, MAX_SKINS, skinsEqual } from "../tunnel/tunnel-appearance";
  import { tunnelUserAppearances } from "../tunnel/tunnel-user-appearances.svelte";

  let { controller }: { controller: TunnelViewController } = $props();

  // Which performer's hand is being edited (inline picker open), or null.
  let editing = $state<{ index: number; hand: "blue" | "red" } | null>(null);
  // Save-as-appearance flow.
  let savingCast = $state(false);
  let castName = $state("");

  const activeUserId = $derived(
    tunnelUserAppearances.appearances.find((a) => skinsEqual(a.skins, controller.skins))?.id ?? null,
  );
  const isCustomCast = $derived(
    controller.activeAppearancePresetId === null && activeUserId === null,
  );

  // Color mode maps onto the existing spectrum toggle (rainbow fan vs base pair).
  const colorOptions = [
    { value: "rainbow", label: "Rainbow" },
    { value: "uniform", label: "Uniform" },
  ];
  const colorValue = $derived(controller.spectrum ? "rainbow" : "uniform");

  function prettyProp(v: string): string {
    return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function togglePicker(index: number, hand: "blue" | "red"): void {
    editing =
      editing && editing.index === index && editing.hand === hand ? null : { index, hand };
  }

  function pick(prop: PropType): void {
    if (!editing) return;
    controller.setSkinProp(editing.index, editing.hand, prop);
    editing = null;
  }

  function removePerformer(index: number): void {
    // Keep an open picker from pointing at a shifted/removed row.
    editing = null;
    controller.removeSkin(index);
  }

  function saveCast(): void {
    tunnelUserAppearances.add(castName, controller.skins);
    castName = "";
    savingCast = false;
  }

  const selectedForEditing = $derived(
    editing
      ? (controller.skins[editing.index]?.[editing.hand === "blue" ? "blueProp" : "redProp"] ??
          "staff")
      : "staff",
  );
</script>

<div class="appearance">
  <!-- PRESETS: built-in casts + your saved ones. A cast is a named performer set. -->
  <span class="lbl">Choose a cast</span>
  <div class="preset-grid" role="radiogroup" aria-label="Performer set">
    {#each APPEARANCE_PRESETS as p (p.id)}
      <button
        class="preset-card"
        class:active={controller.activeAppearancePresetId === p.id}
        type="button"
        role="radio"
        aria-checked={controller.activeAppearancePresetId === p.id}
        onclick={() => controller.applyAppearance(p.appearance)}
      >
        <i class="fas fa-users" aria-hidden="true"></i>
        <span>{p.name}</span>
      </button>
    {/each}
    {#each tunnelUserAppearances.appearances as a (a.id)}
      <div class="preset-card-wrap">
        <button
          class="preset-card user"
          class:active={activeUserId === a.id}
          type="button"
          role="radio"
          aria-checked={activeUserId === a.id}
          onclick={() => controller.applyAppearance(a.skins)}
        >
          <i class="fas fa-star" aria-hidden="true"></i>
          <span>{a.name}</span>
        </button>
        <button
          class="preset-del"
          type="button"
          aria-label={`Delete cast ${a.name}`}
          title="Delete cast"
          onclick={() => tunnelUserAppearances.remove(a.id)}
        >
          <i class="fas fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    {/each}
  </div>

  <!-- ROSTER: one row per performer; each hand opens the shared prop picker. -->
  <span class="lbl">Performers</span>
  <div class="roster">
    {#each controller.skins as skin, i (i)}
      <div class="performer" class:custom={isCustomCast}>
        <span class="perf-name">{i === 0 ? "Center" : `Performer ${i + 1}`}</span>
        <div class="hands">
          <button
            class="hand hand-blue"
            class:open={editing?.index === i && editing?.hand === "blue"}
            type="button"
            aria-label={`Performer ${i + 1} blue prop: ${prettyProp(skin.blueProp)}`}
            onclick={() => togglePicker(i, "blue")}
          >
            <span class="dot"></span>{prettyProp(skin.blueProp)}
          </button>
          <button
            class="hand hand-red"
            class:open={editing?.index === i && editing?.hand === "red"}
            type="button"
            aria-label={`Performer ${i + 1} red prop: ${prettyProp(skin.redProp)}`}
            onclick={() => togglePicker(i, "red")}
          >
            <span class="dot"></span>{prettyProp(skin.redProp)}
          </button>
        </div>
        {#if controller.skins.length > 1}
          <button
            class="perf-del"
            type="button"
            aria-label={`Remove performer ${i + 1}`}
            title="Remove performer"
            onclick={() => removePerformer(i)}
          >
            <i class="fas fa-xmark" aria-hidden="true"></i>
          </button>
        {/if}
      </div>

      {#if editing?.index === i}
        <!-- Inline per-hand picker (the compose prop grid) for this performer. -->
        <div class="picker">
          <span class="picker-title">
            {editing.hand === "blue" ? "Blue" : "Red"} hand — {i === 0
              ? "Center"
              : `Performer ${i + 1}`}
          </span>
          <BentoPropGrid
            selectedPropType={selectedForEditing as PropType}
            color={editing.hand}
            variant="inline"
            flat
            onSelect={pick}
          />
        </div>
      {/if}
    {/each}
  </div>

  {#if controller.skins.length < MAX_SKINS}
    <button class="add-btn" type="button" onclick={() => controller.addSkin()}>
      <i class="fas fa-plus" aria-hidden="true"></i> Add performer
    </button>
  {/if}

  <!-- COLOR MODE: rainbow fan vs base pair (maps onto the spectrum toggle). -->
  <div class="color-row">
    <span class="lbl inline">Colors</span>
    <SegmentedControl
      options={colorOptions}
      value={colorValue}
      onchange={(v) => (controller.spectrum = v === "rainbow")}
      color="accent"
      size="sm"
    />
  </div>
  <p class="hint">
    {controller.spectrum
      ? "Each performer fans across the spectrum."
      : "Every performer uses the base blue/red."}
  </p>

  <!-- SAVE: the current cast as a personal preset. -->
  {#if isCustomCast}
    {#if savingCast}
      <div class="save-row">
        <input
          class="save-input"
          type="text"
          bind:value={castName}
          maxlength="40"
          placeholder="Name this cast"
          aria-label="Cast name"
        />
        <button class="save-confirm" type="button" onclick={saveCast}>Save</button>
        <button
          class="save-cancel"
          type="button"
          aria-label="Cancel save"
          onclick={() => (savingCast = false)}
        >
          <i class="fas fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    {:else}
      <button
        class="save-cast-btn"
        type="button"
        onclick={() => {
          savingCast = true;
          castName = "";
        }}
      >
        <i class="fas fa-star" aria-hidden="true"></i> Save as cast
      </button>
    {/if}
  {/if}

  {#if controller.appearanceCustomized}
    <button class="reset-btn" type="button" onclick={() => controller.resetAppearance()}>
      <i class="fas fa-rotate-left" aria-hidden="true"></i> Reset to your prop
    </button>
  {/if}
</div>

<style>
  .appearance {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .lbl {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .lbl.inline {
    flex: 0 0 auto;
  }

  /* Preset cards — mirrors the mandala preset grid. */
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
    gap: 6px;
  }
  .preset-card {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    cursor: pointer;
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .preset-card i {
    font-size: 14px;
    width: 1.1em;
    text-align: center;
    flex-shrink: 0;
  }
  .preset-card > span {
    font-size: var(--font-size-compact, 12px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .preset-card.active {
    border-color: var(--theme-accent, #8b5cf6);
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    color: var(--theme-text, #fff);
  }
  .preset-card:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }
  .preset-card-wrap {
    position: relative;
    display: flex;
  }
  .preset-card-wrap .preset-card {
    flex: 1;
    min-width: 0;
    padding-right: 34px;
  }
  .preset-del {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    width: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 0 10px 10px 0;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
  }
  .preset-del:hover,
  .preset-del:focus-visible {
    background: color-mix(in srgb, var(--semantic-danger, #ef4444) 18%, transparent);
    color: var(--semantic-danger, #ef4444);
  }
  .preset-del:focus-visible {
    outline: 2px solid var(--semantic-danger, #ef4444);
    outline-offset: -2px;
  }
  .preset-del i {
    font-size: 11px;
  }

  /* Performer roster. */
  .roster {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .performer {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }
  .perf-name {
    flex: 0 0 auto;
    min-width: 68px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }
  .hands {
    display: flex;
    flex: 1;
    min-width: 0;
    gap: 6px;
  }
  .hand {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    padding: 6px 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 9px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .hand .dot {
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .hand-blue .dot {
    background: var(--tka-blue, #2e3192);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25);
  }
  .hand-red .dot {
    background: var(--tka-red, #ed1c24);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25);
  }
  .hand.open {
    border-color: var(--theme-accent, #8b5cf6);
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
  }
  .hand:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 1px;
  }
  .perf-del {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 9px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
  }
  .perf-del:hover,
  .perf-del:focus-visible {
    background: color-mix(in srgb, var(--semantic-danger, #ef4444) 16%, transparent);
    color: var(--semantic-danger, #ef4444);
  }
  .perf-del:focus-visible {
    outline: 2px solid var(--semantic-danger, #ef4444);
    outline-offset: 1px;
  }

  /* Inline per-hand prop picker (BentoPropGrid). Capped height so the long prop
     list scrolls inside the row instead of pushing the panel. */
  .picker {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-accent) 5%, transparent);
  }
  .picker-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .picker :global(.prop-grid-root) {
    max-height: 240px;
  }

  .add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 14px;
    border: 1.5px dashed color-mix(in srgb, var(--theme-accent) 45%, transparent);
    border-radius: 10px;
    background: transparent;
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  .add-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 65%, transparent);
  }
  .add-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--min-touch-target, 44px);
  }
  .color-row :global(.segmented-control) {
    flex: 1;
    min-width: 0;
  }

  .hint {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.4;
    margin: 0;
  }

  /* Save-as-cast — dashed CTA that becomes a name row (mirrors the mandala
     save-as-preset flow). */
  .save-cast-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 14px;
    border: 1.5px dashed color-mix(in srgb, var(--theme-accent) 45%, transparent);
    border-radius: 10px;
    background: transparent;
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  .save-cast-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 65%, transparent);
  }
  .save-cast-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
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

  .reset-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    align-self: center;
    min-height: var(--min-touch-target, 44px);
    padding: 6px 12px;
    background: none;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
  }
  .reset-btn:hover {
    color: var(--theme-text, #fff);
  }
  .reset-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
    border-radius: 6px;
  }

  @media (prefers-reduced-motion: reduce) {
    .preset-card,
    .hand,
    .add-btn,
    .save-cast-btn {
      transition: none;
    }
  }
</style>
