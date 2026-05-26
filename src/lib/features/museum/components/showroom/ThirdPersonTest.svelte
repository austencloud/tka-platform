<script lang="ts">
  /**
   * Third-Person Controller Test
   *
   * Tests the `three-player-controller` library to see if it can replace
   * our hand-rolled UCC third-person mode. Uses a simple test scene
   * with a floor and some walls.
   */
  import { onMount, onDestroy } from "svelte";
  import {
    Scene, Color, PerspectiveCamera, WebGLRenderer,
    GridHelper, AmbientLight, DirectionalLight,
    PlaneGeometry, MeshStandardMaterial, Mesh,
    BoxGeometry, Vector3,
  } from "three";
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

  let container: HTMLDivElement;
  let cleanup: (() => void) | null = null;

  onMount(async () => {
    // Dynamic import to avoid SSR issues
    const { playerController } = await import("three-player-controller");

    // ── Setup Three.js scene ──
    const scene = new Scene();
    scene.background = new Color(0x1a1a2e);

    const camera = new PerspectiveCamera(
      70, container.clientWidth / container.clientHeight, 0.1, 1000
    );

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Start camera behind and above the spawn point
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.target.set(0, 1, 5); // Look at spawn point
    controls.update();

    // Grid helper for spatial reference
    scene.add(new GridHelper(50, 50, 0x444444, 0x222222));

    // ── Lighting ──
    scene.add(new AmbientLight(0xc8b890, 0.6));
    const dirLight = new DirectionalLight(0xfff0d0, 0.8);
    dirLight.position.set(10, 15, 5);
    scene.add(dirLight);

    // ── Floor ──
    const floorGeo = new PlaneGeometry(50, 50);
    const floorMat = new MeshStandardMaterial({ color: 0x3a3530, roughness: 0.9 });
    const floor = new Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ── Some walls to test collision ──
    const wallMat = new MeshStandardMaterial({ color: 0x2a2420 });
    for (let i = -2; i <= 2; i++) {
      const wall = new Mesh(new BoxGeometry(1, 4, 10), wallMat);
      wall.position.set(i * 8, 2, -8);
      scene.add(wall);
    }

    // ── Player Controller ──
    const player = playerController();

    try {
      await player.init({
        scene,
        camera,
        controls,
        playerModel: {
          url: "https://pub-f5505ed75927471cb198c54336317370.r2.dev/models/avatars/y-bot.glb",
          scale: 0.01,  // Mixamo models are ~100 units tall, need 0.01 to be ~1m
          idleAnim: "",
          walkAnim: "",
          runAnim: "",
          jumpAnim: "",
        },
        initPos: new Vector3(0, 0, 5),
      });

      // Switch to third-person (library defaults to first-person)
      player.changeView();

      player.setThirdMouseMode(1); // Camera-only mouse control
      player.setMinCamDistance(2);
      player.setMaxCamDistance(8);
      player.setPlayerSpeed(5);

    } catch (err) {
      console.error("[3P Test] Failed to init player controller:", err);
    }

    // ── Render loop ──
    function animate() {
      try {
        player.update();
      } catch { /* ignore if not initialized */ }
      renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(animate);

    // ── Resize ──
    function onResize() {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", onResize);

    cleanup = () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container?.removeChild(renderer.domElement);
    };
  });

  onDestroy(() => cleanup?.());
</script>

<div class="test-container" bind:this={container}>
  <div class="test-label">
    Third-Person Controller Test (three-player-controller library)
    <br>WASD move • Mouse orbit • Shift run • Space jump
  </div>
</div>

<style>
  .test-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .test-label {
    position: absolute;
    top: 12px;
    left: 12px;
    padding: 8px 14px;
    background: rgba(0, 0, 0, 0.7);
    color: rgba(200, 180, 140, 0.9);
    font-size: 13px;
    border-radius: 8px;
    z-index: 10;
    pointer-events: none;
  }
</style>
