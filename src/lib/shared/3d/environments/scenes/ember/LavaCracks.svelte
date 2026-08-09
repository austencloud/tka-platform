<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    ShaderMaterial,
    AdditiveBlending,
    DoubleSide,
    Color,
  } from "three";
  import type { LavaCracksConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: LavaCracksConfig;
    groundSize: number;
    /**
     * Where to hang the crust. Omitted, it lies on the ground plane exactly as
     * it always has - the crater floor of the ember scene.
     *
     * Supplied, the same crust shader can face any direction, which is what
     * lets it read as banked coal on a wall or in a bed rather than only as
     * cracked ground. The shader is the material; the plane is just where it
     * happens to be pointing.
     */
    placement?: {
      position?: [number, number, number];
      rotation?: [number, number, number];
      size?: [number, number];
    };
    /**
     * 1 keeps the radial vignette that fades the crust out before its own
     * edges - correct for one large ground decal with nothing to hide its
     * border. 0 carries the crust to the edge of the plane, which is what a
     * wall panel or a contained coal bed needs, because its border is a real
     * edge in the geometry.
     */
    edgeFade?: number;
  }

  let { config, groundSize, placement, edgeFade = 1 }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const meshPosition = $derived<[number, number, number]>(
    placement?.position ?? [0, groundY + 0.02, 0]
  );
  const meshRotation = $derived<[number, number, number]>(
    placement?.rotation ?? [-Math.PI / 2, 0, 0]
  );
  const meshSize = $derived<[number, number]>(
    placement?.size ?? [groundSize * 0.7, groundSize * 0.7]
  );

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Multi-scale Voronoi with traveling glow pulse
  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uCrackColor;
    uniform float uIntensity;
    uniform float uScale;
    uniform float uPulseSpeed;
    uniform float uPulseIntensity;
    uniform float uEdgeFade;
    varying vec2 vUv;

    vec2 hash22(vec2 p) {
      return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
      )) * 43758.5453);
    }

    // Returns (F1, F2) — distances to closest and second-closest Voronoi cells
    vec2 voronoi(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float minDist = 1.0;
      float secondDist = 1.0;
      vec2 closestPoint = vec2(0.0);
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          vec2 neighbor = vec2(float(x), float(y));
          vec2 point = hash22(i + neighbor);
          point = 0.5 + 0.5 * sin(uTime * 0.2 + 6.283 * point);
          vec2 diff = neighbor + point - f;
          float d = length(diff);
          if (d < minDist) {
            secondDist = minDist;
            minDist = d;
            closestPoint = i + neighbor + point;
          } else if (d < secondDist) {
            secondDist = d;
          }
        }
      }
      return vec2(minDist, secondDist);
    }

    void main() {
      vec2 scaledUv = (vUv - 0.5) * uScale * 6.0;

      // Primary crack network
      vec2 v1 = voronoi(scaledUv);
      float crackEdge = v1.y - v1.x;

      // Secondary finer crack network (overlaid)
      vec2 v2 = voronoi(scaledUv * 2.3 + 50.0);
      float fineCrack = v2.y - v2.x;

      // Thin bright cracks
      float crackLine = 1.0 - smoothstep(0.0, 0.06, crackEdge);
      float fineLines = 1.0 - smoothstep(0.0, 0.04, fineCrack);

      // Glow around cracks
      float crackGlow = 1.0 - smoothstep(0.0, 0.2, crackEdge);
      float fineGlow = 1.0 - smoothstep(0.0, 0.15, fineCrack);

      // Combine scales — primary dominates
      float combinedCrack = crackLine + fineLines * 0.4;
      float combinedGlow = crackGlow + fineGlow * 0.3;

      // Traveling pulse wave — radiates outward from center
      float distFromCenter = length(vUv - 0.5);
      float pulse = sin(distFromCenter * 8.0 - uTime * uPulseSpeed * 6.0) * 0.5 + 0.5;
      pulse = pow(pulse, 3.0);
      float pulsedIntensity = uIntensity * (1.0 + pulse * uPulseIntensity);

      float alpha = (combinedCrack * 0.9 + combinedGlow * 0.25) * pulsedIntensity;

      // Edge fadeout. Full strength on an unbounded ground decal; dialled out
      // when the plane's own border is real geometry doing the containing.
      float dist = length(vUv - 0.5) * 2.0;
      alpha *= mix(1.0, 1.0 - smoothstep(0.6, 1.0, dist), uEdgeFade);

      // Color — brighter at pulse peaks
      vec3 color = uCrackColor * (combinedCrack * 1.5 + combinedGlow * 0.5);
      color += uCrackColor * pulse * combinedGlow * 0.8;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  let material = $state<ShaderMaterial | null>(null);

  $effect(() => {
    if (!config.enabled) {
      material = null;
      return;
    }
    const nextMat = new ShaderMaterial({
      transparent: true,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uCrackColor: { value: new Color(config.crackColor) },
        uIntensity: { value: config.intensity },
        uScale: { value: config.scale },
        uPulseSpeed: { value: config.pulseSpeed },
        uPulseIntensity: { value: config.pulseIntensity },
        uEdgeFade: { value: edgeFade },
      },
      vertexShader,
      fragmentShader,
    });
    material = nextMat;
    return () => {
      nextMat.dispose();
    };
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uCrackColor!.value = new Color(config.crackColor);
    material.uniforms.uIntensity!.value = config.intensity;
    material.uniforms.uScale!.value = config.scale;
    material.uniforms.uPulseSpeed!.value = config.pulseSpeed;
    material.uniforms.uPulseIntensity!.value = config.pulseIntensity;
    material.uniforms.uEdgeFade!.value = edgeFade;
  });

  useTask((delta) => {
    if (!material) return;
    material.uniforms.uTime!.value += delta * config.speed * 10;
  });
</script>

{#if config.enabled && material}
  <T.Mesh position={meshPosition} rotation={meshRotation} {material}>
    <T.PlaneGeometry args={meshSize} />
  </T.Mesh>
{/if}
