<!--
  FanStyleOptions.svelte
  The fan look (Pictograph, DoodleGrip Fire, Lotus Fire, DoodleGrip Day,
  Moon LED, plus the cover where a build has one), opened from the prop
  grid's look chip once a fan is selected. Bound to the shared fanAppearance
  setting, which the 2D canvas and the 3D scene both read. The frame color
  is a 3D-only detail and stays out of this 2D control.
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

  const settings = $derived(getSettings());
  const appearance = $derived(normalizeFanAppearance(settings.fanAppearance));

  function change(next: FanAppearance): void {
    void updateSettings({ fanAppearance: normalizeFanAppearance(next) });
  }
</script>

<div class="fan-style-options" data-testid="fan-style-options">
  <FanAppearancePicker
    value={appearance}
    onchange={change}
    frameColor={false}
  />
</div>

<style>
  .fan-style-options {
    container-type: inline-size;
    flex: 0 0 auto;
    min-width: 0;
    width: 100%;
  }

  /* Three builds per row even on a phone, so the five builds and the cover
     fit inside the chooser without an inner scrollbar; one row of five once
     the chooser is wide enough. */
  .fan-style-options :global(.fan-appearance-picker) {
    --build-option-count: 3;
  }

  @container (max-width: 539px) {
    .fan-style-options :global(.option-label) {
      min-height: 0;
      padding: 6px 8px;
      font-size: 11.5px;
      line-height: 1.15;
      white-space: normal;
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
