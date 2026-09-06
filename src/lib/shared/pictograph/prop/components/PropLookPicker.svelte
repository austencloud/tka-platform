<!--
  One switch for how the 2D canvas draws every non-fan prop: the flat capture
  of the viewer's 3D model, or the pictograph artwork. Reads and writes the
  shared propArtwork setting directly, so the sidebar, the Tunnel art pane, and
  the engine all follow one value. Fan keeps FanAppearancePicker.
-->
<script lang="ts">
  import PropBuildPicker from "$lib/shared/3d/components/controls/PropBuildPicker.svelte";
  import {
    getSettings,
    updateSettings,
  } from "$lib/shared/application/state/app-state.svelte";
  import {
    hasModelSprite,
    normalizePropLook,
    propLookOptions,
    type PropLook,
  } from "../domain/prop-look";

  let {
    propType,
    compact = false,
  }: {
    propType: string;
    compact?: boolean;
  } = $props();

  const settings = $derived(getSettings());
  const look = $derived(normalizePropLook(settings.propArtwork));
  const available = $derived(hasModelSprite(propType));
  const options = $derived(propLookOptions(propType));

  function choose(next: PropLook): void {
    if (next === look) return;
    void updateSettings({ propArtwork: next });
  }
</script>

{#if available}
  <div
    class="prop-look-picker"
    class:compact
    data-prop-look={look}
    style:--prop-picker-accent="var(--theme-accent, #8b7cf6)"
    style:--prop-picker-stroke="var(--theme-stroke, rgba(255,255,255,0.12))"
  >
    <PropBuildPicker
      label="Prop look"
      value={look}
      {options}
      onchange={choose}
    />
  </div>
{/if}

<style>
  .prop-look-picker {
    --build-option-count: 2;
    container-type: inline-size;
    display: grid;
    min-width: 0;
  }
</style>
