<script lang="ts">
  import { Canvas, T } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import { Vector3, Matrix4, Data3DTexture, SphereGeometry, MeshStandardMaterial, Color } from 'three';
  import FishSchool from '$lib/shared/3d/environments/scenes/ocean/FishSchool.svelte';
  import { bakeSceneSDF } from '$lib/shared/3d/environments/scenes/ocean/scene-sdf-baker';

  const ROCK_POS = new Vector3(0, 3, 0);
  const ROCK_RADIUS = 3;

  const sdf = bakeSceneSDF(
    [{ x: ROCK_POS.x, y: ROCK_POS.y, z: ROCK_POS.z, r: ROCK_RADIUS }],
    new Vector3(-15, -2, -15),
    new Vector3(15, 12, 15),
  );

  const rockGeo = new SphereGeometry(ROCK_RADIUS, 32, 32);
  const rockMat = new MeshStandardMaterial({ color: new Color('#665544'), roughness: 0.9 });
</script>

<svelte:head>
  <title>Fish SDF Avoidance Test</title>
</svelte:head>

<div class="page">
  <div class="info">
    <h2>Fish SDF Avoidance Test</h2>
    <p>Brown sphere = obstacle with baked SDF. Fish should steer around it, never swim through.</p>
  </div>
  <div class="canvas-wrap">
    <Canvas>
      <T.PerspectiveCamera makeDefault position={[0, 5, 18]} fov={60}>
        <OrbitControls target={[0, 3, 0]} />
      </T.PerspectiveCamera>

      <T.AmbientLight intensity={0.6} />
      <T.DirectionalLight position={[5, 10, 5]} intensity={1.2} />

      <!-- The obstacle sphere -->
      <T.Mesh geometry={rockGeo} material={rockMat} position={[ROCK_POS.x, ROCK_POS.y, ROCK_POS.z]} />

      <!-- Fish with SDF avoidance -->
      <FishSchool
        stageRadius={2}
        boundRadius={12}
        swimHeight={[1, 6]}
        sceneSdfTexture={sdf.texture}
        sceneSdfInvMatrix={sdf.inverseMatrix}
      />
    </Canvas>
  </div>
</div>

<style>
  .page {
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #111;
    color: #eee;
  }
  .info {
    padding: 12px 20px;
    background: #1a1a2e;
    border-bottom: 1px solid #333;
  }
  .info h2 { margin: 0 0 4px; font-size: 16px; }
  .info p { margin: 0; font-size: 13px; opacity: 0.7; }
  .canvas-wrap {
    flex: 1;
    min-height: 0;
  }
</style>
