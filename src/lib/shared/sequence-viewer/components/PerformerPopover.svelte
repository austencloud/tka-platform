<script lang="ts">
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import PerformerChipStrip from "$lib/shared/3d/components/controls/PerformerChipStrip.svelte";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import EffectsSettingsPanel from "$lib/shared/3d/components/controls/EffectsSettingsPanel.svelte";
  import EffortPalette from "$lib/features/phrase-effort-lab/components/EffortPalette.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";

  // Per spec §6.3 — unified per-performer surface. Chip strip on top,
  // Prop/Effects/Effort tabs below, each scoped to the selected performer.

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "performers");

  type TabId = "prop" | "effects" | "effort";
  let activeTab = $state<TabId>("effort");

  // When selectedPerformerIndex is null ("All" chip), fall back to performer 0
  // so the panel shows something actionable. Mutations still target that performer.
  const selected = $derived.by(() => {
    const list = viewer.performerManager.performers;
    if (list.length === 0) return null;
    const idx = viewer.selectedPerformerIndex ?? 0;
    return list[idx] ?? null;
  });

  // BentoPropGrid color: performer 0 = blue, others = red. (BentoPropGrid only
  // supports "blue" | "red" — for indices 2+ we reuse red as a neutral tint.)
  const gridColor = $derived<"blue" | "red">(
    (viewer.selectedPerformerIndex ?? 0) === 0 ? "blue" : "red",
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
        <button
          class="tab"
          role="tab"
          aria-selected={activeTab === "prop"}
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
          onclick={() => (activeTab = "effort")}>Effort</button
        >
      </div>

      {#if selected === null}
        <div class="empty">No performer selected.</div>
      {:else if activeTab === "prop"}
        <BentoPropGrid
          selectedPropType={selected.settings.prop ?? PropType.STAFF}
          color={gridColor}
          variant="inline"
          onSelect={(p: PropType) => selected.setProp(p)}
        />
      {:else if activeTab === "effects"}
        <EffectsSettingsPanel performer={selected} />
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
  .tab:hover {
    color: rgba(255, 255, 255, 0.72);
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
</style>
