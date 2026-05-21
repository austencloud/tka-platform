<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import FormationSelector from "./FormationSelector.svelte";
  import { PRESET_VALID_COUNTS } from "@austencloud/scene-3d";
  import type { FormationPreset } from "@austencloud/scene-3d";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "formation");
  const performerCount = $derived(viewer.performerManager.performers.length);

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
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="formation-popover"
    role="dialog"
    aria-label="Formation presets"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') viewer.closePopover(); }}
    in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
    out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">
      <span class="pop-title">Formation</span>
    </div>
    <div class="pop-body">
      <FormationSelector
        value={viewer.activeFormation === "manual" ? "grid-2x2" : viewer.activeFormation}
        {performerCount}
        {disabledPresets}
        onchange={handleFormationChange}
      />
    </div>
  </div>
{/if}

<style>
  .formation-popover {
    position: absolute;
    right: calc(100% + 10px);
    top: 0;
    z-index: 100;
    width: 420px;
    border-radius: 18px;
    transform-origin: top right;
    background: rgba(20, 22, 32, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(24px) saturate(150%);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  .pop-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .pop-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
  }
  .pop-body {
    padding: 12px 14px 14px;
    --theme-panel-bg: rgba(0, 0, 0, 0.3);
    --theme-stroke: rgba(255, 255, 255, 0.08);
    --theme-text-dim: rgba(255, 255, 255, 0.5);
    --theme-text: rgba(255, 255, 255, 0.9);
    --theme-card-hover-bg: rgba(255, 255, 255, 0.08);
    --theme-accent: color-mix(in srgb, #60a5fa 30%, transparent);
  }
  .pop-body :global(.formation-btn.active) {
    background: color-mix(in srgb, #60a5fa 25%, transparent);
    border: 1px solid color-mix(in srgb, #60a5fa 45%, transparent);
    box-shadow: 0 2px 8px color-mix(in srgb, #60a5fa 18%, transparent);
  }
</style>
