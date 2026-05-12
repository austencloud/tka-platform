<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    CylinderGeometry,
    ShaderMaterial,
    Color,
    DoubleSide,
  } from "three";
  import type { PlatformConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "../../../state/user-proportions-state.svelte";

  interface Props {
    config: PlatformConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const geometry = $derived.by(() => {
    const segments =
      config.shape === "hexagon" ? 6 : config.shape === "octagon" ? 8 : 64;
    return new CylinderGeometry(
      config.radius,
      config.radius,
      config.height,
      segments
    );
  });

  const vertexShader = /* glsl */ `
    varying vec3 vPosition;
    varying vec3 vNormal;
    void main() {
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uBaseColor;
    uniform vec3 uEmissiveColor;
    uniform float uEmissiveIntensity;
    uniform float uEdgeGlowWidth;
    uniform float uRadius;
    uniform float uHeight;
    uniform float uMetallic;
    uniform float uRoughness;
    uniform float uPulse;

    varying vec3 vPosition;
    varying vec3 vNormal;

    void main() {
      float distFromCenter = length(vPosition.xz) / uRadius;
      float edgeFactor = smoothstep(1.0 - uEdgeGlowWidth, 1.0, distFromCenter);

      float topFace = step(0.49, vNormal.y);
      float sideFace = 1.0 - abs(vNormal.y);

      float pulse = 1.0 + sin(uPulse) * 0.15;
      float glow = (edgeFactor * topFace + sideFace * 0.6) * uEmissiveIntensity * pulse;

      vec3 base = uBaseColor * (0.3 + uMetallic * 0.7);
      vec3 emissive = uEmissiveColor * glow;

      gl_FragColor = vec4(base + emissive, 1.0);
    }
  `;

  let pulseTime = 0;

  const material = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uBaseColor: { value: new Color(config.baseColor) },
        uEmissiveColor: { value: new Color(config.emissiveColor) },
        uEmissiveIntensity: { value: config.emissiveIntensity },
        uEdgeGlowWidth: { value: config.edgeGlowWidth },
        uRadius: { value: config.radius },
        uHeight: { value: config.height },
        uMetallic: { value: config.metallic },
        uRoughness: { value: config.roughness },
        uPulse: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      side: DoubleSide,
    });
  });

  useTask((delta) => {
    if (!material || config.pulseSpeed === 0) return;
    pulseTime += delta * config.pulseSpeed * Math.PI * 2;
    material.uniforms.uPulse!.value = pulseTime;
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uBaseColor!.value = new Color(config.baseColor);
    material.uniforms.uEmissiveColor!.value = new Color(config.emissiveColor);
    material.uniforms.uEmissiveIntensity!.value = config.emissiveIntensity;
    material.uniforms.uEdgeGlowWidth!.value = config.edgeGlowWidth;
    material.uniforms.uRadius!.value = config.radius;
    material.uniforms.uHeight!.value = config.height;
    material.uniforms.uMetallic!.value = config.metallic;
    material.uniforms.uRoughness!.value = config.roughness;
  });
</script>

{#if config.enabled}
  <T.Mesh
    {geometry}
    {material}
    position.y={groundY + config.height / 2}
  />
{/if}
