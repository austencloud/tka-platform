<script lang="ts">
  import type { EffectPreset } from "./presets/types";
  import type { EffectLookPreviewModel } from "./effect-look-preview";
  import EffectLookPreview from "./EffectLookPreview.svelte";
  import BloomThumbnail from "./thumbnails/BloomThumbnail.svelte";
  import FireThumbnail from "./thumbnails/FireThumbnail.svelte";
  import TrailThumbnail from "./thumbnails/TrailThumbnail.svelte";
  import CoalThumbnail from "./thumbnails/CoalThumbnail.svelte";
  import LedThumbnail from "./thumbnails/LedThumbnail.svelte";

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
{:else if effectType === "trails"}
  <TrailThumbnail preset={preset as EffectPreset<"trails">} {active} />
{:else if effectType === "charcoal"}
  <CoalThumbnail preset={preset as EffectPreset<"charcoal">} {active} />
{:else if effectType === "led"}
  <!-- The one effect whose tile runs the shipping renderer rather than a 2D
       portrait of it. LED's look is a flux budget, a splat kernel, a streak
       integral, a shutter and a bloom pyramid, all of which live in GLSL - a
       hand-drawn tile is a second implementation free to drift, and the last
       one did: it read as convincing LEDs for weeks while the effect on stage
       was a formless blob. See led-thumbnail-renderer.ts. -->
  <LedThumbnail preset={preset as EffectPreset<"led">} {active} />
{:else}
  <!-- Each remaining effect replaces this fallback only after its thumbnail
       direction has passed the same visual review as Bloom: a stylised portrait
       of the look, composed from the preset's own parameters, exposed so it
       reads at ~304x114. Replaying the effect literally was tried for Bloom and
       lost - at tile size a real render is mostly empty frame. -->

  <EffectLookPreview model={legacyModel} {active} />
{/if}
