<script lang="ts">
  /**
   * Custom Avatar Test Page
   *
   * Tests loading a raw mesh from SAM 3D Body.
   * This is unrigged geometry, so no animation - just static display.
   */
  import { Canvas, T } from "@threlte/core";
  import { OrbitControls, useGltf } from "@threlte/extras";

  let showWireframe = $state(false);
  let rotationY = $state(0);

  // Auto-rotate the model slowly
  let autoRotate = $state(true);

  function onFrame(delta: number) {
    if (autoRotate) {
      rotationY += delta * 0.5;
    }
  }
</script>

<svelte:head>
  <title>Custom Avatar Test</title>
</svelte:head>

<div class="container">
  <header>
    <h1>Custom Avatar Test</h1>
    <p>SAM 3D Body mesh from your photo (unrigged - static display)</p>
  </header>

  <div class="controls">
    <label>
      <input type="checkbox" bind:checked={autoRotate} />
      Auto-rotate
    </label>
    <label>
      <input type="checkbox" bind:checked={showWireframe} />
      Wireframe
    </label>
  </div>

  <div class="canvas-container">
    <Canvas>
      <T.PerspectiveCamera makeDefault position={[0, 1.5, 3]} fov={50} />
      <OrbitControls enableDamping {autoRotate} autoRotateSpeed={1} />

      <T.AmbientLight intensity={0.5} />
      <T.DirectionalLight position={[5, 10, 5]} intensity={1} />
      <T.DirectionalLight position={[-5, 5, -5]} intensity={0.3} />

      {#await useGltf("/models/austen.glb")}
        <!-- Loading indicator -->
        <T.Mesh>
          <T.BoxGeometry args={[0.5, 0.5, 0.5]} />
          <T.MeshStandardMaterial color="gray" />
        </T.Mesh>
      {:then gltf}
        <T.Group scale={[1, 1, 1]} position={[0, -1, 0]}>
          <T is={gltf.scene}>
            {#if showWireframe}
              <!-- Override materials to wireframe -->
            {/if}
          </T>
        </T.Group>
      {:catch error}
        <T.Mesh>
          <T.BoxGeometry args={[0.5, 0.5, 0.5]} />
          <T.MeshStandardMaterial color="red" />
        </T.Mesh>
      {/await}

      <!-- Ground plane for reference -->
      <T.Mesh rotation.x={-Math.PI / 2} position.y={-1} receiveShadow>
        <T.PlaneGeometry args={[10, 10]} />
        <T.MeshStandardMaterial color="#333" transparent opacity={0.5} />
      </T.Mesh>
    </Canvas>
  </div>

  <footer>
    <p>
      <strong>Next step:</strong> Upload this mesh to
      <a href="https://www.mixamo.com/" target="_blank" rel="noopener">Mixamo</a
      >
      to auto-rig it for animation.
    </p>
  </footer>
</div>

<style>
  .container {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #1a1a2e;
    color: white;
  }

  header {
    padding: 1rem;
    text-align: center;
    background: rgba(0, 0, 0, 0.3);
  }

  header h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  header p {
    margin: 0.5rem 0 0;
    opacity: 0.7;
    font-size: 0.9rem;
  }

  .controls {
    display: flex;
    gap: 1.5rem;
    justify-content: center;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
  }

  .controls label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .canvas-container {
    flex: 1;
    position: relative;
  }

  footer {
    padding: 1rem;
    text-align: center;
    background: rgba(0, 0, 0, 0.3);
    font-size: 0.85rem;
  }

  footer a {
    color: #64b5f6;
  }
</style>
