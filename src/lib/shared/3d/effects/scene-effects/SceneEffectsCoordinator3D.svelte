<script lang="ts">
  /** Advances all pooled effects once after every rig has published its tips. */
  import { useStage, useTask, useThrelte, type Stage } from "@threlte/core";
  import { onDestroy } from "svelte";
  import type { Object3D } from "three";
  import {
    NEUTRAL_PETAL_ENVIRONMENT_PROFILE,
    type PetalEnvironmentProfile3D,
  } from "../petals/petal-world-art-direction";
  import type { SceneEffectsManager3D } from "./scene-effects-manager-3d";

  interface Props {
    manager: SceneEffectsManager3D;
    parent?: Object3D;
    petalEnvironmentProfile?: PetalEnvironmentProfile3D;
  }
  let {
    manager,
    parent,
    petalEnvironmentProfile = NEUTRAL_PETAL_ENVIRONMENT_PROFILE,
  }: Props = $props();
  const { scene, mainStage, renderStage } = useThrelte() as unknown as {
    scene: Object3D;
    mainStage: Stage;
    renderStage: Stage;
  };
  const effectsStage = useStage(Symbol("scene-particle-effects"), {
    after: mainStage,
    before: renderStage,
  });

  useTask(
    (delta) => {
      manager.setPetalEnvironmentProfile(petalEnvironmentProfile);
      manager.initialize(parent ?? scene);
      manager.update(delta);
    },
    { stage: effectsStage }
  );

  onDestroy(() => manager.dispose());
</script>
