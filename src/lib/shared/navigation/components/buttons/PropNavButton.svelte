<!-- PropNavButton - Circular prop type button for bottom/side navigation -->
<script lang="ts">
  import NavButton from "./NavButton.svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { propDrawerState } from "$lib/shared/settings/state/prop-drawer-state.svelte";

  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
  const displayInfo = $derived(getPropTypeDisplayInfo(bluePropType));

  // Build an <img> tag string for NavButton's {@html icon} renderer
  const iconHtml = $derived(
    `<img src="${displayInfo.image}" alt="${displayInfo.label}" style="width: 26px; height: 26px; object-fit: contain; filter: brightness(1.3) saturate(1.3);" />`
  );

  function handleClick() {
    propDrawerState.toggle();
  }
</script>

<div
  class="prop-nav-button-wrapper"
  onclick={handleClick}
  onkeydown={(e) => e.key === "Enter" && handleClick()}
  role="button"
  tabindex="0"
>
  <div class="prop-button-container">
    <NavButton
      icon={iconHtml}
      label="Prop"
      type="special"
      color="var(--theme-accent, #818cf8)"
      gradient="var(--theme-accent, #818cf8)"
      ariaLabel="Change prop type. Current: {displayInfo.label}"
      active={false}
    />
  </div>
</div>

<style>
  .prop-nav-button-wrapper {
    display: contents;
    touch-action: manipulation;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .prop-button-container {
    position: relative;
    display: inline-flex;
    touch-action: manipulation;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  /* Give the prop button an accent border so it stands out */
  .prop-button-container :global(.nav-button.special) {
    border: 1px solid var(--theme-accent, #818cf8);
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-button-container :global(.nav-button.special) {
      transition: none;
    }
  }
</style>
