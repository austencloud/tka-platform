<script lang="ts">
  import type { EffectPreset } from "./presets/types";
  import type { EffectLookPreviewModel } from "./effect-look-preview";
  import EffectLookPreview from "./EffectLookPreview.svelte";
  import BloomLookThumbnail from "./thumbnails/BloomLookThumbnail.svelte";

  interface Props {
    effectType: string;
    preset: EffectPreset;
    legacyModel: EffectLookPreviewModel;
    active?: boolean;
  }

  const { effectType, preset, legacyModel, active = false }: Props = $props();
</script>

{#if effectType === "bloom"}
  <BloomLookThumbnail preset={preset as EffectPreset<"bloom">} {active} />
{:else}
  <!-- Each remaining effect replaces this fallback only after its thumbnail
       direction has passed the same visual review as Bloom. -->
  <EffectLookPreview model={legacyModel} {active} />
{/if}
