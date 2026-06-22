<script lang="ts">
  /**
   * /test/autumn-scene
   *
   * Live verification harness for the Enchanted Autumn Dusk scene rebuild
   * (the "Ocean way"). Mounts the real 3D environment switcher
   * (Environment3D → AutumnScene) inside a Threlte <Canvas> with the same
   * renderer config + scene-feature context the real viewer uses, plus an
   * orbit camera so the scene can be inspected from any angle.
   *
   * This keeps working as AutumnScene evolves in later tasks: it routes through
   * Environment3D rather than importing AutumnScene directly, and tolerates the
   * scene still carrying legacy content. Disposable dev-only route.
   */
  import { Canvas, T } from "@threlte/core";
  import { WebGLRenderer } from "three";
  import { BackgroundType } from "@austencloud/backgrounds";

  import Environment3D from "$lib/shared/3d/environments/components/Environment3D.svelte";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import { createSceneFeatureState } from "$lib/shared/3d/scene-features/state/scene-feature-state.svelte";
  import { setSceneFeatureContext } from "$lib/shared/3d/scene-features/context/scene-feature-context";
  import HarnessToneMapping from "./HarnessToneMapping.svelte";

  // The Autumn scene calls getSceneFeatureContext() (for reportReady +
  // stage gating). Provide the same state factory the real Viewer3DCanvas
  // uses so the context resolves and the scene doesn't throw.
  const sceneFeatureState = createSceneFeatureState();
  setSceneFeatureContext(sceneFeatureState);
</script>

<svelte:head>
  <title>Autumn Scene — verification harness</title>
</svelte:head>

<div class="page">
  <Canvas
    createRenderer={(canvas) => new WebGLRenderer({ canvas, preserveDrawingBuffer: true })}
  >
    <!-- Match the real viewer's ScenePostProcessing tone mapping (AgX, 1.0)
         so colors read the same here as in the sequence viewer. -->
    <HarnessToneMapping />

    <!-- Orbit camera: backed by yomotsu/camera-controls via the shared
         OrbitControls wrapper. Sits at human eye height, looking at the
         clearing centre. -->
    <T.PerspectiveCamera makeDefault position={[0, 2.2, 7]} fov={50}>
      <OrbitControls
        enableDamping
        target={[0, 1, 0]}
        minDistance={1.5}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2 + 0.05}
      />
    </T.PerspectiveCamera>

    <!-- Real environment switcher. AUTUMN routes to AutumnScene, which
         supplies its own sky, ground, fog, trees, leaves and lighting. -->
    <Environment3D
      backgroundType={BackgroundType.AUTUMN}
      performerCount={1}
      stageWidth={6}
      stageDepth={6}
      stageZOffset={0}
    />
  </Canvas>
</div>

<style>
  .page {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    /* Warm dusk gradient backs the transparent canvas while the scene's
       own sky dome paints in. */
    background: linear-gradient(#1a1206 0%, #3a2410 60%, #5a3a1c 100%);
  }
</style>
