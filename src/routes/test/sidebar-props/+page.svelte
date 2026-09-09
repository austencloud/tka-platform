<script lang="ts">
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import FanAppearancePicker from "$lib/shared/pictograph/prop/components/FanAppearancePicker.svelte";
  import LabeledColorPairPicker from "$lib/shared/ui/components/LabeledColorPairPicker.svelte";
  import {
    DEFAULT_FAN_APPEARANCE,
    type FanAppearance,
  } from "$lib/shared/pictograph/prop/domain/fan-appearance";
  import { getRecipeFamilies } from "$lib/shared/pictograph/prop/domain/prop-composition-recipes";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  let fan = $state<FanAppearance>({
    ...DEFAULT_FAN_APPEARANCE,
    build: "flat-grip",
  });
  let colors = $state({ left: "#36d6c5", right: "#ff8dba" });
  const families = getRecipeFamilies().map(({ propType }) => propType);
</script>

<svelte:head><title>Sidebar prop pairs</title></svelte:head>

<main>
  <h1>Sidebar prop pairs</h1>
  <p>
    The navigation artwork at its actual size. Change the fan build or either
    hand’s color.
  </p>
  <LabeledColorPairPicker
    left={colors.left}
    right={colors.right}
    onchange={(hand, color) => (colors = { ...colors, [hand]: color })}
  />
  <section aria-label="Prop pairs">
    {#each families as type}
      <article data-prop={type}>
        <div class="rail-button">
          <PropCompositionPreview
            propType={type}
            size={40}
            pairedGlyph
            darkBackground
            useSavedOverrides={false}
            {colors}
            appearanceOverride={{ fanAppearance: fan }}
          />
        </div>
        <div class="expanded-button">
          <PropCompositionPreview
            propType={type}
            size={40}
            pairedGlyph
            darkBackground
            useSavedOverrides={false}
            {colors}
            appearanceOverride={{ fanAppearance: fan }}
          />
          <span>{getPropTypeDisplayInfo(type).label}</span>
        </div>
      </article>
    {/each}
    <article data-prop="mixed">
      <div class="rail-button">
        <PropCompositionPreview
          propType={PropType.FAN}
          rightPropType={PropType.STAFF}
          size={40}
          pairedGlyph
          darkBackground
          useSavedOverrides={false}
          {colors}
          appearanceOverride={{ fanAppearance: fan }}
        />
      </div>
      <span>Fan + Staff</span>
    </article>
  </section>
  <FanAppearancePicker value={fan} onchange={(value) => (fan = value)} />
</main>

<style>
  main {
    max-width: 1100px;
    margin: auto;
    padding: 24px;
    color: var(--theme-text, white);
  }
  h1 {
    font-size: 24px;
  }
  p {
    font-size: 14px;
  }
  section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    margin-top: 24px;
  }
  article {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .rail-button,
  .expanded-button {
    display: flex;
    align-items: center;
    height: 44px;
    box-sizing: border-box;
    border: 1px solid var(--theme-stroke, #314047);
    border-radius: 12px;
    background: var(--theme-card-bg, #080f16);
  }
  .rail-button {
    width: 44px;
    flex: 0 0 44px;
    justify-content: center;
  }
  .expanded-button {
    flex: 1;
    padding-right: 12px;
    gap: 4px;
  }
  span {
    font-size: 14px;
  }
</style>
