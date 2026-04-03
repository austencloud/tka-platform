<script lang="ts">
  /**
   * Post-processing pipeline for the museum 3D scene.
   * Adds bloom, vignette, and ACES filmic tone mapping.
   */
  import { useThrelte, useTask } from "@threlte/core";
  import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
  import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
  import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
  import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
  import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
  import { ACESFilmicToneMapping, Vector2 } from "three";
  import type { WebGLRenderer, Scene, Camera } from "three";

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

  const getRenderer = (): WebGLRenderer | null => {
    const r = (ctx.renderer as any)?.current ?? ctx.renderer;
    return r?.domElement ? r : null;
  };
  const getScene = (): Scene | null => {
    const s = (ctx.scene as any)?.current ?? ctx.scene;
    return s?.isScene ? s : null;
  };
  const getCamera = (): Camera | null => {
    const c = (ctx.camera as any)?.current ?? ctx.camera;
    return c?.isCamera ? c : null;
  };

  let composer: EffectComposer | undefined;
  let initialized = false;
  let lastW = 0;
  let lastH = 0;
  const sizeVec = new Vector2();

  useTask(() => {
    const gl = getRenderer();
    const sc = getScene();
    const cam = getCamera();
    if (!gl || !sc || !cam) return;

    if (!initialized) {
      // Disable Threlte's auto-render so EffectComposer takes over
      try { (ctx as any).autoRender?.set?.(false); } catch { /* ok */ }

      // ACES filmic tone mapping for cinematic color response
      gl.toneMapping = ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.1;

      const c = new EffectComposer(gl);
      c.addPass(new RenderPass(sc, cam));
      c.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.35, 0.5, 0.85));
      c.addPass(new ShaderPass(VignetteShader));
      c.addPass(new OutputPass());

      composer = c;
      initialized = true;
    }

    if (!composer) return;

    // Sync composer size with renderer every frame — the canvas may resize
    // after init (layout shifts, fullscreen, etc.)
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
