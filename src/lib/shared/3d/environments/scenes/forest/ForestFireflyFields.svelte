<script lang="ts">
  import { T } from "@threlte/core";
  import FallingParticles from "../../primitives/FallingParticles.svelte";
  import type { ForestSceneConfig } from "../../domain/models/scene-configs";
  import { FOREST_FIREFLY_FIELDS } from "./forest-firefly-fields";

  type FireflyConfig = NonNullable<ForestSceneConfig["fireflies"]>;

  interface Props {
    config: FireflyConfig;
    groundY: number;
  }

  let { config, groundY }: Props = $props();
</script>

{#each FOREST_FIREFLY_FIELDS as field (field.id)}
  <T.Group
    position.x={field.position[0]}
    position.y={groundY + field.position[1]}
    position.z={field.position[2]}
  >
    {#key `${field.id}-${config.count}`}
      <FallingParticles
        type={config.type}
        count={Math.max(8, Math.round(config.count * field.countScale))}
        area={field.area}
        speed={config.speed}
        colors={config.colors}
        sizeRange={config.sizeRange}
        spin={config.spin}
      />
    {/key}
  </T.Group>
{/each}
