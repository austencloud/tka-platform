<!--
  PropStyleDock.svelte
  The look controls for the prop the picker currently has selected, so the
  Change Prop sheet is the one place to pick both the prop and how it looks.
  Fans get their build picker (DoodleGrip Fire, Lotus, Day, Moon LED,
  Pictograph); every other prop with a captured 3D model gets the model /
  pictograph switch. Both write the shared settings the animator reads.
-->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    getSettings,
    updateSettings,
  } from "$lib/shared/application/state/app-state.svelte";
  import FanAppearancePicker from "$lib/shared/pictograph/prop/components/FanAppearancePicker.svelte";
  import PropLookPicker from "$lib/shared/pictograph/prop/components/PropLookPicker.svelte";
  import {
    isFanPropType,
    normalizeFanAppearance,
    type FanAppearance,
  } from "$lib/shared/pictograph/prop/domain/fan-appearance";
  import { hasModelSprite } from "$lib/shared/pictograph/prop/domain/prop-look";

  let {
    propType,
    compact = false,
  }: {
    propType: PropType | null;
    compact?: boolean;
  } = $props();

  const settings = $derived(getSettings());
  const fanAppearance = $derived(normalizeFanAppearance(settings.fanAppearance));
  const isFan = $derived(isFanPropType(propType));
  const hasLook = $derived(propType !== null && hasModelSprite(propType));

  function changeFan(next: FanAppearance): void {
    void updateSettings({ fanAppearance: normalizeFanAppearance(next) });
  }
</script>

{#if propType !== null && (isFan || hasLook)}
  <div class="prop-style-dock" class:compact data-testid="prop-style-dock">
    {#if isFan}
      <FanAppearancePicker
        value={fanAppearance}
        onchange={changeFan}
        {compact}
      />
    {:else}
      <PropLookPicker {propType} {compact} />
    {/if}
  </div>
{/if}

<style>
  .prop-style-dock {
    flex: 0 0 auto;
    min-width: 0;
    /* The fan build picker is tall; keep the prop grid usable above it and
       let the dock scroll on its own. */
    max-height: 42%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 10px 18px 14px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(
      in srgb,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 60%,
      transparent
    );
  }
</style>
