<script lang="ts">
  import type { EffectPreset } from "./presets/types";
  import type { EffectLookPreviewModel } from "./effect-look-preview";
  import EffectLookPreview from "./EffectLookPreview.svelte";
  import BloomThumbnail from "./thumbnails/BloomThumbnail.svelte";
  import FireThumbnail from "./thumbnails/FireThumbnail.svelte";

  interface Props {
    effectType: string;
    preset: EffectPreset;
    legacyModel: EffectLookPreviewModel;
    active?: boolean;
  }

  const { effectType, preset, legacyModel, active = false }: Props = $props();
</script>

{#if effectType === "bloom"}
  <BloomThumbnail preset={preset as EffectPreset<"bloom">} {active} />
{:else if effectType === "fire"}
  <FireThumbnail preset={preset as EffectPreset<"fire">} {active} />
{:else}
  <!-- Each remaining effect replaces this fallback only after its thumbnail
       direction has passed the same visual review as Bloom: a stylised portrait
       of the look, composed from the preset's own parameters, exposed so it
       reads at ~304x114. Replaying the effect literally was tried for Bloom and
       lost - at tile size a real render is mostly empty frame. -->
  <EffectLookPreview model={legacyModel} {active} />
{/if}
