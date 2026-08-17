<script lang="ts">
  import type { EffectPreset } from "./presets/types";
  import type { EffectLookPreviewModel } from "./effect-look-preview";
  import EffectLookPreview from "./EffectLookPreview.svelte";
  import BloomThumbnail from "./thumbnails/BloomThumbnail.svelte";
  import FireThumbnail from "./thumbnails/FireThumbnail.svelte";
  import TrailThumbnail from "./thumbnails/TrailThumbnail.svelte";
  import CoalThumbnail from "./thumbnails/CoalThumbnail.svelte";

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
{:else}
  <!-- Each remaining effect replaces this fallback only after its thumbnail
       direction has passed the same visual review as Bloom: a stylised portrait
       of the look, composed from the preset's own parameters, exposed so it
       reads at ~304x114. Replaying the effect literally was tried for Bloom and
       lost - at tile size a real render is mostly empty frame.

       LED is deliberately back on this fallback. Its bespoke thumbnail was
       hand-drawn from constants invented to make the tile look plausible, and
       it shared no code with the renderer - so it kept reading as convincing
       LEDs for weeks while the actual effect on stage was a formless blob.
       A thumbnail that cannot be wrong about its own effect has to render
       through the real renderer offscreen; until it does, no tile beats an
       honest generic one. -->

  <EffectLookPreview model={legacyModel} {active} />
{/if}
