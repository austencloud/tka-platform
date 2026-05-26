<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { ShaderMaterial, AdditiveBlending, DoubleSide, Color } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy } from "svelte";
  import fragmentShader from "../../shaders/atmosphere/voronoi-caustic.frag?raw";

  // ── Hardcoded config ──────────────────────────────────────────────────
  const INTENSITY = 0.3;
  const SPEED = 0.8;
  const SCALE = 8;
  const CAUSTIC_COLOR = "#3388aa";
  const GROUND_SIZE = 40;

  const groundY = $derived(userProportionsState.groundY);

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const material = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color(CAUSTIC_COLOR) },
      uIntensity: { value: INTENSITY },
      uScale: { value: SCALE },
    },
    vertexShader,
    fragmentShader,
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta * SPEED * 10;
  });

  onDestroy(() => {
    material.dispose();
  });
</script>

<T.Mesh position.y={groundY + 0.02} rotation.x={-Math.PI / 2} {material}>
  <T.PlaneGeometry args={[GROUND_SIZE * 0.8, GROUND_SIZE * 0.8]} />
</T.Mesh>
