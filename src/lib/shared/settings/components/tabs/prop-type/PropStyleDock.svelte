<!--
  PropStyleDock.svelte
  The model / pictograph switch for the prop the picker currently has
  selected. Fans are not docked here: their build (DoodleGrip Fire, Lotus,
  Day, Moon LED, Pictograph) lives in the Fan styles popover of the prop grid
  itself, so the sheet never grows a second, scroll-away copy of that picker.
-->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PropLookPicker from "$lib/shared/pictograph/prop/components/PropLookPicker.svelte";
  import { isFanPropType } from "$lib/shared/pictograph/prop/domain/fan-appearance";
  import { hasModelSprite } from "$lib/shared/pictograph/prop/domain/prop-look";

  let {
    propType,
    compact = false,
  }: {
    propType: PropType | null;
    compact?: boolean;
  } = $props();

  const hasLook = $derived(
    propType !== null && !isFanPropType(propType) && hasModelSprite(propType)
  );
</script>

{#if propType !== null && hasLook}
  <div class="prop-style-dock" class:compact data-testid="prop-style-dock">
    <PropLookPicker {propType} {compact} />
  </div>
{/if}

<style>
  .prop-style-dock {
    flex: 0 0 auto;
    min-width: 0;
    padding: 10px 18px 14px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(
      in srgb,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 60%,
      transparent
    );
  }
</style>
