<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy, untrack } from "svelte";
  import { createOceanGodRayShafts } from "../../../../worlds/ocean/ocean-god-ray-shafts";
  import { oceanDebugToggles } from "../../quality/ocean-debug-toggles.svelte";

  interface Props {
    halfRes?: boolean;
    worldYOffset?: number;
  }

  let { worldYOffset = 0 }: Props = $props();

  const localGroundY = $derived(userProportionsState.groundY);
  const world = untrack(() =>
    createOceanGodRayShafts({
      groundY: userProportionsState.groundY,
      worldYOffset,
      enabled: oceanDebugToggles.godRayShafts,
    })
  );

  $effect(() => world.setGroundY(localGroundY, worldYOffset));
  $effect(() => world.setEnabled(oceanDebugToggles.godRayShafts));

  useTask((delta) => world.update(delta));
  onDestroy(world.dispose);
</script>

<T is={world.object} />
