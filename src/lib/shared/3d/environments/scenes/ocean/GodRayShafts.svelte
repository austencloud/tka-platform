<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    ShaderMaterial,
    AdditiveBlending,
    DoubleSide,
    Color,
    PlaneGeometry,
    InstancedMesh,
    InstancedBufferAttribute,
    Matrix4,
    Vector3,
    Quaternion,
    Euler,
  } from "three";
  import type { OceanGodRayShaftConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy } from "svelte";

  interface Props {
    config: OceanGodRayShaftConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const vertexShader = /* glsl */ `
    attribute float aOpacityMult;
    varying vec2 vUv;
    varying float vWorldY;
    varying float vNormY;
    varying float vOpacityMult;
    uniform float uHeight;
    uniform float uGroundY;

    void main() {
      vUv = uv;
      vOpacityMult = aOpacityMult;
      vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWorldY = worldPos.y;
      vNormY = clamp((worldPos.y - uGroundY) / uHeight, 0.0, 1.0);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uColorTop;
    uniform vec3 uColorBottom;
    uniform float uIntensity;
    varying vec2 vUv;
    varying float vWorldY;
    varying float vNormY;
    varying float vOpacityMult;

    void main() {
      float cx = (vUv.x - 0.48) * 2.0;
      float centerFade = exp(-cx * cx * 2.5);
      float verticalFade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.5, vUv.y);

      float s1 = sin(vWorldY * 1.7 + uTime * 1.2);
      float s2 = sin(vWorldY * 3.3 - uTime * 0.7 + 1.3);
      float s3 = sin(vWorldY * 0.8 + uTime * 2.1 + 3.7);
      float s4 = cos(vWorldY * 5.1 - uTime * 1.5 + 0.9);
      float shimmer = 0.55 + 0.2 * s1 + 0.12 * s2 + 0.08 * s3 + 0.05 * s4;

      vec3 color = mix(uColorBottom, uColorTop, vNormY);
      float alpha = centerFade * verticalFade * shimmer * uIntensity * vOpacityMult;
      gl_FragColor = vec4(color * alpha, alpha * 0.35);
    }
  `;

  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  const material = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColorTop: { value: new Color("#d4e8f0") },
      uColorBottom: { value: new Color(config.color) },
      uIntensity: { value: config.intensity },
      uHeight: { value: config.height },
      uGroundY: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });

  const instancedMesh = $derived.by(() => {
    const geo = new PlaneGeometry(config.width, config.height);
    const rng = seededRandom(777);

    const count = config.count;
    const opacities = new Float32Array(count);

    const inst = new InstancedMesh(geo, material, count);
    inst.frustumCulled = false;

    const mat = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3(1, 1, 1);

    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.5) * 22;
      const z = (rng() - 0.5) * 22;
      const rotY = rng() * Math.PI * 2;
      const tilt = 0.04 + rng() * 0.12;
      const widthScale = 0.5 + rng() * 0.8;
      opacities[i] = 0.4 + rng() * 0.6;

      q.setFromEuler(new Euler(0, rotY, tilt));
      s.set(widthScale, 1, 1);
      mat.compose(
        new Vector3(x, groundY + config.height * 0.5, z),
        q,
        s,
      );
      inst.setMatrixAt(i, mat);
    }

    inst.instanceMatrix.needsUpdate = true;
    geo.setAttribute('aOpacityMult', new InstancedBufferAttribute(opacities, 1));

    return inst;
  });

  $effect(() => {
    material.uniforms.uColorBottom!.value = new Color(config.color);
    material.uniforms.uIntensity!.value = config.intensity;
    material.uniforms.uGroundY!.value = groundY;
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta * config.speed * 5;
  });

  onDestroy(() => {
    material.dispose();
    instancedMesh.geometry.dispose();
  });
</script>

<T is={instancedMesh} />
