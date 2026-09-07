<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy, untrack } from "svelte";
  import {
    createOceanRuinsPlatform,
    type OceanRuinsPlatformConfig,
  } from "../../../worlds/ocean/ocean-ruins-platform";

  interface Props {
    config: OceanRuinsPlatformConfig;
  }

  let { config }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);
  const world = untrack(() =>
    createOceanRuinsPlatform(config, userProportionsState.groundY)
  );

  $effect(() => world.setConfig(config));
  $effect(() => world.setGroundY(groundY));

  useTask((delta) => world.update(delta));
  onDestroy(world.dispose);
</script>

<T is={world.object} />
