<script lang="ts">
  import { onDestroy } from "svelte";
  import { useTask, useThrelte } from "@threlte/core";

  import { tryGetEnvironmentTransitionVisualContext } from "../context/environment-transition-visual-context";
  import { EnvironmentTransitionCompositor } from "../rendering/environment-transition-compositor";

  const context = useThrelte() as any;
  const transitionVisual = tryGetEnvironmentTransitionVisualContext();
  const compositor = new EnvironmentTransitionCompositor();

  useTask(
    () => {
      const camera = context.camera.current;
      const scene = context.scene;
      if (!camera || !scene) return;

      compositor.render(
        context.renderer,
        scene,
        camera,
        transitionVisual?.opacity ?? 0
      );
    },
    {
      stage: context.renderStage,
      after: context.autoRenderTask,
      autoInvalidate: false,
    }
  );

  onDestroy(() => compositor.dispose());
</script>
