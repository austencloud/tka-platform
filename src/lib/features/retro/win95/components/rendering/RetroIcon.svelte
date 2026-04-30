<!--
  RetroIcon - Pixel art SVG icon renderer for TKA-OS v1.0

  Renders a 32x32 pixel art SVG from the RETRO_ICONS library at the
  specified display size. Uses image-rendering: pixelated for crisp
  scaling. Icons use authentic Win95 3D beveling with TKA theming.

  Domain: Retro Rendering
-->
<script lang="ts">
  import { RETRO_ICONS, type RetroIconName } from "./retro-icons";

  let {
    name,
    size = 16,
  }: {
    name: RetroIconName;
    size?: number;
  } = $props();

  const svg = $derived(RETRO_ICONS[name] ?? "");
</script>

<span
  class="retro-icon"
  style="width: {size}px; height: {size}px;"
  aria-hidden="true"
>{@html svg}</span>

<style>
  .retro-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
  .retro-icon :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
</style>
