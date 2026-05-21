<script lang="ts">
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import PerformerChipStrip from "$lib/shared/3d/components/controls/PerformerChipStrip.svelte";
  import FormationSelector from "$lib/shared/3d/components/controls/FormationSelector.svelte";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import MobileEffectsPanel from "$lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte";
  import EffortPalette from "$lib/shared/phrase-effort-lab/components/EffortPalette.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { PRESET_VALID_COUNTS } from "@austencloud/scene-3d";
  import { getPerformerColor } from "$lib/shared/3d/constants/performer-colors";
  import type { FormationPreset } from "@austencloud/scene-3d";
  import type { EffortId } from "$lib/shared/effort/domain/effort-types";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";

  // Per spec §6.3 - unified per-performer surface. Chip strip on top,
  // Prop/Effects/Effort tabs below, each scoped to the selected performer.

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "performers");

  type TabId = "formation" | "prop" | "effects" | "effort";
  const performerCount = $derived(viewer.performerManager.performers.length);
  let activeTab = $state<TabId>(viewer.performerManager.performers.length >= 2 ? "formation" : "effort");

  const disabledPresets = $derived.by(() => {
    const disabled = new Set<FormationPreset>();
    for (const [preset, validCounts] of Object.entries(PRESET_VALID_COUNTS)) {
      if (!validCounts.includes(performerCount)) {
        disabled.add(preset as FormationPreset);
      }
    }
    return disabled;
  });

  function handleFormationChange(preset: FormationPreset) {
    viewer.applyFormationFromUI(preset);
  }

  // "All" chip selected = no individual target for prop/effort/effects.
  // The sub-tabs each mutate a single performer's settings, so falling back
  // to performer 0 when null was silently writing to performer 0 while the
  // UI implied a group edit. Gate the controls instead: sub-tabs disable and
  // show a hint until the user picks a specific performer.
  const allSelected = $derived(viewer.selectedPerformerIndex === null);

  const selected = $derived.by(() => {
    if (allSelected) return null;
    const list = viewer.performerManager.performers;
    if (list.length === 0) return null;
    const idx = viewer.selectedPerformerIndex ?? 0;
    return list[idx] ?? null;
  });

  // Per-performer accent for BentoPropGrid. Reuses the shared performer
  // palette so the prop picker's selection glow matches the active chip
  // instead of collapsing everyone above index 0 onto the same red.
  const gridColor = $derived<string>(
    getPerformerColor(viewer.selectedPerformerIndex ?? 0),
  );
</script>

{#if open}
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="pop"
    role="dialog"
    aria-label="Performers"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
    out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">
      <div class="pop-title">Performers</div>
      <PerformerChipStrip />
    </div>

    <div class="pop-body">
      <div class="tabbar" role="tablist">
        {#if performerCount >= 2}
          <button
            class="tab"
            role="tab"
            aria-selected={activeTab === "formation"}
            onclick={() => (activeTab = "formation")}>Formation</button
          >
        {/if}
        <button
          class="tab"
          role="tab"
          aria-selected={activeTab === "prop"}
          disabled={allSelected}
          onclick={() => (activeTab = "prop")}>Prop</button
        >
        <button
          class="tab"
          role="tab"
          aria-selected={activeTab === "effects"}
          onclick={() => (activeTab = "effects")}>Effects</button
        >
        <button
          class="tab"
          role="tab"
          aria-selected={activeTab === "effort"}
          disabled={allSelected}
          onclick={() => (activeTab = "effort")}>Effort</button
        >
      </div>

      {#if activeTab === "formation"}
        <div class="formation-host">
          <FormationSelector
            value={viewer.activeFormation === "manual" ? "grid-2x2" : viewer.activeFormation}
            {performerCount}
            {disabledPresets}
            onchange={handleFormationChange}
          />
        </div>
      {:else if activeTab === "effects"}
        <!-- Effects are scene-wide (shared with the export Effects panel).
             Per-performer scoping is Phase 2.5 work. -->
        <div class="effects-host"><MobileEffectsPanel layout="grid" /></div>
      {:else if allSelected}
        <div class="empty">
          Select a performer to edit their prop or effort.
        </div>
      {:else if selected === null}
        <div class="empty">No performer selected.</div>
      {:else if activeTab === "prop"}
        <BentoPropGrid
          selectedPropType={selected.settings.prop ?? PropType.STAFF}
          color={gridColor}
          variant="inline"
          onSelect={(p: PropType) => selected.setProp(p)}
        />
      {:else if activeTab === "effort"}
        <EffortPalette
          selectedEffort={selected.settings.effortId ?? "linear"}
          onSelect={(e: EffortId) => selected.setEffort(e)}
        />
      {/if}
    </div>
  </div>
{/if}

<style>
  .pop {
    position: absolute;
    right: calc(100% + 10px);
    top: 0;
    width: 420px;
    background: rgba(20, 22, 32, 0.82);
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 18px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
    z-index: 100;
  }
  .pop-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .pop-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
    margin-bottom: 10px;
  }
  .pop-body {
    padding: 14px 16px 16px;
  }
  .tabbar {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 14px;
  }
  .tab {
    flex: 1;
    padding: 8px 10px;
    min-height: var(--min-touch-target);
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.42);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    text-align: center;
    transition: all 140ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }
  .tab:hover:not(:disabled) {
    color: rgba(255, 255, 255, 0.72);
  }
  .tab:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .tab[aria-selected="true"] {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
    color: white;
  }
  .empty {
    padding: 20px 8px;
    text-align: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.42);
  }
  .formation-host {
    --theme-panel-bg: rgba(0, 0, 0, 0.3);
    --theme-stroke: rgba(255, 255, 255, 0.08);
    --theme-text-dim: rgba(255, 255, 255, 0.5);
    --theme-text: rgba(255, 255, 255, 0.9);
    --theme-card-hover-bg: rgba(255, 255, 255, 0.08);
    --theme-accent: color-mix(in srgb, #60a5fa 30%, transparent);
  }
  .formation-host :global(.formation-btn.active) {
    background: color-mix(in srgb, #60a5fa 25%, transparent);
    border: 1px solid color-mix(in srgb, #60a5fa 45%, transparent);
    box-shadow: 0 2px 8px color-mix(in srgb, #60a5fa 18%, transparent);
  }
  .effects-host {
    /* PerformerPopover is 420px wide; the grid layout fits all 11 tiles
       without horizontal scroll, so we only need a vertical safety cap
       for very small screens (laptop notch / etc.). */
    max-height: 70vh;
    overflow-y: auto;
  }
</style>
