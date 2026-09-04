<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy, untrack } from "svelte";
  import { createOceanMarineParticles } from "../../../../worlds/ocean/ocean-marine-particles";

  interface Props {
    count?: number;
  }

  let { count = 4000 }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);
  const world = untrack(() =>
    createOceanMarineParticles({
      count,
      groundY: userProportionsState.groundY,
    })
  );

  $effect(() => world.setGroundY(groundY));

  useTask((delta) => world.update(delta));
  onDestroy(world.dispose);
</script>

<T is={world.object} />
