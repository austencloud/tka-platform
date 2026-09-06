<!--
  FanStyleOptions.svelte
  The fan builds (Pictograph, DoodleGrip Fire, Lotus Fire, DoodleGrip Day,
  Moon LED) and their details, rendered inside the Fan family chooser so the
  style is picked in the same place as the prop. Bound to the shared
  fanAppearance setting, which the 2D canvas, the 3D scene, and the sidebar
  picker all read.
-->
<script lang="ts">
  import {
    getSettings,
    updateSettings,
  } from "$lib/shared/application/state/app-state.svelte";
  import FanAppearancePicker from "$lib/shared/pictograph/prop/components/FanAppearancePicker.svelte";
  import {
    normalizeFanAppearance,
    type FanAppearance,
  } from "$lib/shared/pictograph/prop/domain/fan-appearance";

  let {
    compact = false,
    onPick,
  }: {
    compact?: boolean;
    /** Fires after a build is chosen, so the host can make a fan current. */
    onPick?: (appearance: FanAppearance) => void;
  } = $props();

  const settings = $derived(getSettings());
  const appearance = $derived(normalizeFanAppearance(settings.fanAppearance));

  function change(next: FanAppearance): void {
    const normalized = normalizeFanAppearance(next);
    void updateSettings({ fanAppearance: normalized });
    onPick?.(normalized);
  }
</script>

<div class="fan-style-options" data-testid="fan-style-options">
  <FanAppearancePicker value={appearance} onchange={change} {compact} />
</div>

<style>
  .fan-style-options {
    container-type: inline-size;
    flex: 0 0 auto;
    min-width: 0;
    width: 100%;
    padding-top: 6px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* The builds should read as one row wherever the chooser is wide enough;
     the two-column compact default belongs to narrow drawers only. */
  @container (min-width: 400px) {
    .fan-style-options :global(.fan-appearance-picker) {
      --build-option-count: 3;
    }
  }

  @container (min-width: 540px) {
    .fan-style-options :global(.fan-appearance-picker) {
      --build-option-count: 5;
    }

    /* Details are a footnote to the build; small cards keep them from
       dominating the chooser's height. */
    .fan-style-options :global(.picker.secondary .option-grid) {
      grid-template-columns: repeat(2, minmax(0, 150px));
    }
  }

  /* Five build names share one row here, so the label runs tighter than
     the inspector's full-width cards. */
  .fan-style-options :global(.option-label) {
    padding-inline: 10px;
    font-size: 12.5px;
  }
</style>
