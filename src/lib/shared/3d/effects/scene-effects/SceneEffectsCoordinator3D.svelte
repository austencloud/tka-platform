<script lang="ts">
  /** Advances all pooled effects once after every rig has published its tips. */
  import { useStage, useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import type { Object3D } from "three";
  import type { SceneEffectsManager3D } from "./scene-effects-manager-3d";

  interface Props {
    manager: SceneEffectsManager3D;
    parent?: Object3D;
  }
  let { manager, parent }: Props = $props();
  const { scene, mainStage, renderStage } = useThrelte();
  const effectsStage = useStage(Symbol("scene-particle-effects"), {
    after: mainStage,
    before: renderStage,
  });

  useTask(
    (delta) => {
      manager.initialize(parent ?? scene);
      manager.update(delta);
    },
    { stage: effectsStage }
  );

  onDestroy(() => manager.dispose());
</script>
