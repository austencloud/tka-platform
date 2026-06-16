<script lang="ts">
  /**
   * Post-processing pipeline for the museum 3D scene.
   *
   * Bloom + vignette + ACES tone mapping run ONLY in FPS mode. Top-down and
   * flip animation use plain gl.render(). This is both a design choice (bloom
   * is cinematic immersion - wasted on a tactical overhead view) and a perf
   * requirement: running bloom in top-down then switching to plain render
   * during the flip causes Chrome to stall for 8+ seconds on render target
   * state transitions. By keeping bloom exclusively in FPS, the only
   * composer↔plain switch is one clean transition at the end of each flip.
   *
   * The first-ever composer.render() triggers GPU shader compilation in
   * UnrealBloomPass (~2-6 seconds). We pre-warm this behind the loading
   * overlay so it's invisible to the player.
   */
  import { useThrelte, useTask } from "@threlte/core";
  import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
  import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
  import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
  import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
  import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
  import { ACESFilmicToneMapping, Vector2, Vector3 } from "three";
  import type { WebGLRenderer, Scene, Camera, PerspectiveCamera } from "three";
  import { resolveRenderer, resolveScene, resolveCamera } from "../resolve-threlte-scene";

  interface Props {
    /** All geometry is in the scene - safe to pre-warm bloom shaders */
    geometryReady?: boolean;
    /** Player is in first-person/third-person mode - bloom is active */
    fpsActive?: boolean;
    /** Camera is mid-flip between top-down and FPS - skip bloom */
    animating?: boolean;
    /** Spawn position for FPS pre-warm (world coordinates) */
    spawnPosition?: { x: number; z: number };
    /** False when the museum is mounted-but-hidden (keep-alive) - skip rendering */
    visible?: boolean;
  }

  const props: Props = $props();

  const VignetteShader = {
    uniforms: {
      tDiffuse: { value: null },
      offset: { value: 0.95 },
      darkness: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float offset;
      uniform float darkness;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
        float vignette = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
        texel.rgb *= mix(1.0 - darkness, 1.0, vignette);
        gl_FragColor = texel;
      }
    `,
  };

  const ctx = useThrelte();

  const getRenderer = (): WebGLRenderer | null => resolveRenderer(ctx);
  const getScene = (): Scene | null => resolveScene(ctx);
  const getCamera = (): Camera | null => resolveCamera(ctx);

  let composer: EffectComposer | undefined;
  let bloomPreWarmed = false;
  let lastW = 0;
  let lastH = 0;
  const sizeVec = new Vector2();

  useTask(() => {
    // Keep-alive: skip all rendering while the museum is hidden. This is the
    // only render call in the museum, so gating it here stops GPU draw entirely
    // regardless of Threlte's frame-loop mode.
    if (props.visible === false) return;

    const gl = getRenderer();
    const sc = getScene();
    const cam = getCamera();
    if (!gl || !sc || !cam) return;

    // Build the EffectComposer once, but don't render through it yet
    if (!composer) {
      // Disable Threlte's auto-render so we control the render loop
      try { (ctx as any).autoRender?.set?.(false); } catch { /* ok */ }

      gl.toneMapping = ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.1;

      const c = new EffectComposer(gl);
      c.addPass(new RenderPass(sc, cam));
      c.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.35, 0.5, 0.85));
      c.addPass(new ShaderPass(VignetteShader));
      c.addPass(new OutputPass());

      composer = c;
    }

    // Pre-warm: first-ever composer.render() triggers GPU shader compilation
    // (~2-6s). We render from BOTH camera perspectives (top-down + FPS) to
    // force all shader variants to compile. Without the FPS pre-warm, the
    // first bloom render in FPS mode causes a ~1s stutter as new shader
    // variants compile for the close-up perspective.
    if (!bloomPreWarmed) {
      if (props.geometryReady) {
        bloomPreWarmed = true;
        gl.getSize(sizeVec);
        const dpr = gl.getPixelRatio();
        composer.setSize(Math.floor(sizeVec.x * dpr), Math.floor(sizeVec.y * dpr));
        composer.setPixelRatio(1);
        lastW = Math.floor(sizeVec.x * dpr);
        lastH = Math.floor(sizeVec.y * dpr);

        // Pass 1: top-down perspective (current camera position)
        composer.render();

        // Pass 2: FPS perspective - move camera to spawn at eye height,
        // render through bloom, then restore. Forces GPU to compile shader
        // variants for the close-up FPS frustum (different from top-down).
        const perspCam = cam as PerspectiveCamera;
        if (perspCam.isPerspectiveCamera && props.spawnPosition) {
          const savedPos = perspCam.position.clone();
          const savedFov = perspCam.fov;
          const savedQuat = perspCam.quaternion.clone();

          perspCam.position.set(props.spawnPosition.x, 1.6, props.spawnPosition.z);
          perspCam.fov = 65;
          perspCam.lookAt(
            props.spawnPosition.x,
            1.6,
            props.spawnPosition.z + 5,
          );
          perspCam.updateProjectionMatrix();
          composer.render();

          // Restore camera to top-down position
          perspCam.position.copy(savedPos);
          perspCam.fov = savedFov;
          perspCam.quaternion.copy(savedQuat);
          perspCam.updateProjectionMatrix();
        }

        return;
      }
      // Geometry still loading - plain render
      gl.render(sc, cam);
      return;
    }

    // Bloom runs ONLY in FPS mode (not animating).
    // Top-down and flip animation get plain render. This avoids the
    // composer↔plain render target switch in top-down mode, which causes
    // Chrome to stall for 8+ seconds on subsequent flips.
    if (!props.fpsActive || props.animating) {
      gl.render(sc, cam);
      return;
    }

    // FPS mode: render through EffectComposer (bloom + vignette + tone mapping)
    gl.getSize(sizeVec);
    const dpr = gl.getPixelRatio();
    const w = Math.floor(sizeVec.x * dpr);
    const h = Math.floor(sizeVec.y * dpr);
    if (w !== lastW || h !== lastH) {
      composer.setSize(w, h);
      composer.setPixelRatio(1);
      lastW = w;
      lastH = h;
    }

    composer.render();
  });
</script>
