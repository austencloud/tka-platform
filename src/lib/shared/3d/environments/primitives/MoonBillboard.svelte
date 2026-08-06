<script lang="ts">
  /**
   * A distant moon that always faces the viewer.
   *
   * The moon is part of the sky rather than physical set dressing, so a
   * sprite keeps it crisp from every orbit angle without adding scene geometry.
   */
  import { T } from "@threlte/core";
  import { useTexture } from "@threlte/extras";
  import { AdditiveBlending } from "three";
  import type { MoonConfig } from "../domain/models/scene-configs";

  interface Props {
    config: MoonConfig;
  }

  let { config }: Props = $props();

  const moonTexture = useTexture(config.texture);
</script>

{#if config.enabled && $moonTexture}
  <T.Group position={config.position}>
    <T.Sprite
      scale={[
        config.diameter * config.glowScale,
        config.diameter * config.glowScale,
        1,
      ]}
      renderOrder={0}
    >
      <T.SpriteMaterial
        map={$moonTexture}
        transparent
        opacity={config.glowOpacity}
        blending={AdditiveBlending}
        depthWrite={false}
        fog={false}
        toneMapped={false}
      />
    </T.Sprite>

    <T.Sprite scale={[config.diameter, config.diameter, 1]} renderOrder={1}>
      <T.SpriteMaterial
        map={$moonTexture}
        transparent
        opacity={config.opacity}
        depthWrite={false}
        fog={false}
        toneMapped={false}
      />
    </T.Sprite>
  </T.Group>
{/if}
