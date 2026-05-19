<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { ShaderMaterial, AdditiveBlending, DoubleSide, Color } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    intensity: number;
    speed: number;
    scale: number;
    color: string;
    groundSize: number;
  }

  let { intensity, speed, scale, color, groundSize }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uScale;
    varying vec2 vUv;

    vec2 hash22(vec2 p) {
      return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
      )) * 43758.5453);
    }

    float voronoi(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float md = 8.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 n = vec2(float(x), float(y));
          vec2 o = hash22(i + n);
          o = 0.5 + 0.5 * sin(uTime * 0.8 + 6.2831 * o);
          vec2 r = n + o - f;
          float d = dot(r, r);
          md = min(md, d);
        }
      }
      return sqrt(md);
    }

    void main() {
      vec2 p = (vUv - 0.5) * uScale;

      float v1 = voronoi(p + vec2(uTime * 0.1, uTime * 0.05));
      float v2 = voronoi(p * 1.4 + vec2(-uTime * 0.08, uTime * 0.12) + 3.7);
      float v3 = voronoi(p * 0.7 + vec2(uTime * 0.06, -uTime * 0.09) + 7.3);

      float pattern = v1 * v2 + v3 * 0.3;
      pattern = pow(1.0 - pattern, 3.5);

      float edgeFade = 1.0 - smoothstep(0.3, 0.5, length(vUv - 0.5));
      float alpha = pattern * uIntensity * edgeFade;

      gl_FragColor = vec4(uColor * alpha, alpha);
    }
  `;

  const material = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color(color) },
      uIntensity: { value: intensity },
      uScale: { value: scale },
    },
    vertexShader,
    fragmentShader,
  });

  $effect(() => {
    material.uniforms.uColor!.value = new Color(color);
    material.uniforms.uIntensity!.value = intensity;
    material.uniforms.uScale!.value = scale;
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta * speed * 10;
  });
</script>

<T.Mesh
  position.y={groundY + 0.02}
  rotation.x={-Math.PI / 2}
  {material}
>
  <T.PlaneGeometry args={[groundSize * 0.8, groundSize * 0.8]} />
</T.Mesh>
