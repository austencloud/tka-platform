<script lang="ts">
  /**
   * Full torch assembly: iron bracket, wood shaft, FBM noise flame,
   * rising ember particles, volumetric light cone, and animated point light.
   */
  import { T, useTask } from "@threlte/core";
  import {
    PointLight,
    ShaderMaterial,
    PlaneGeometry,
    CylinderGeometry,
    TorusGeometry,
    ConeGeometry,
    MeshStandardMaterial,
    Points,
    BufferGeometry,
    Float32BufferAttribute,
    PointsMaterial,
    AdditiveBlending,
    DoubleSide,
    FrontSide,
    Color,
  } from "three";

  interface Props {
    x: number;
    z: number;
    y?: number;
    /** Offset from tile center toward room interior (away from wall) */
    wallOffsetX?: number;
    wallOffsetZ?: number;
    baseIntensity?: number;
    flameColor?: string;
    distance?: number;
  }

  let {
    x,
    z,
    y = 1.25,
    wallOffsetX = 0,
    wallOffsetZ = 0,
    baseIntensity = 4,
    flameColor = "#ff9020",
    distance = 8,
  }: Props = $props();

  // The torch's actual world position, offset from the wall into the room
  const tx = x + wallOffsetX;
  const tz = z + wallOffsetZ;

  // ── Bracket geometry (iron wall mount) ──
  const bracketRingGeo = new TorusGeometry(0.06, 0.012, 6, 12);
  const bracketArmGeo = new CylinderGeometry(0.01, 0.01, 0.12, 6);
  const bracketMat = new MeshStandardMaterial({
    color: "#3a3a3a",
    metalness: 0.85,
    roughness: 0.35,
  });

  // ── Shaft geometry (wood stick) ──
  const shaftGeo = new CylinderGeometry(0.018, 0.022, 0.3, 6);
  const shaftMat = new MeshStandardMaterial({
    color: "#5c3a1e",
    roughness: 0.9,
    metalness: 0.0,
  });

  // ── Flame billboard with noise shader ──
  const flameGeo = new PlaneGeometry(0.25, 0.4);
  const flameMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: Math.random() * 100 },
      uIntensity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        // Billboard: extract camera-right and camera-up from view matrix
        // to make the quad always face the camera
        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 billboardPos = camRight * position.x + camUp * position.y;
        vec4 worldPos = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        worldPos.xyz += billboardPos;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;

      // Simple hash-based noise
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // Fractal Brownian Motion — layered noise for organic fire shape
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p *= 2.1;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = vUv;

        // Teardrop mask: wide at bottom, narrow at top
        float xCenter = abs(uv.x - 0.5) * 2.0;
        float taper = 1.0 - pow(uv.y, 0.6);
        float mask = smoothstep(taper, taper - 0.3, xCenter);

        // Vertical fade: strong at base, transparent at tip
        float vertFade = smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.4, uv.y);

        // Animated noise scrolling upward
        vec2 noiseCoord = vec2(uv.x * 3.0, uv.y * 4.0 - uTime * 2.5);
        float n = fbm(noiseCoord);

        // Distort the mask with noise for flickering edges
        float flame = mask * vertFade * (0.6 + 0.4 * n);
        flame = smoothstep(0.1, 0.6, flame);

        // Color gradient: white core → yellow → orange → red tip
        vec3 white = vec3(1.0, 0.95, 0.85);
        vec3 yellow = vec3(1.0, 0.75, 0.2);
        vec3 orange = vec3(1.0, 0.4, 0.05);
        vec3 red = vec3(0.6, 0.1, 0.0);

        float coreMask = smoothstep(0.3, 0.8, flame);
        vec3 color = mix(red, orange, smoothstep(0.0, 0.3, flame));
        color = mix(color, yellow, smoothstep(0.3, 0.6, flame));
        color = mix(color, white, smoothstep(0.6, 0.9, flame));

        // Boost brightness for bloom pickup
        color *= 1.5 * uIntensity;

        gl_FragColor = vec4(color, flame * 0.9);
      }
    `,
  });

  // ── Volumetric light cone ──
  const coneGeo = new ConeGeometry(0.4, 0.8, 12, 1, true);
  const coneMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color(flameColor) },
      uIntensity: { value: 0.15 },
    },
    vertexShader: /* glsl */ `
      varying float vHeight;
      void main() {
        // Cone tip is at top (y=0.4), base at bottom (y=-0.4)
        vHeight = (position.y + 0.4) / 0.8;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying float vHeight;
      void main() {
        // Bright near the flame (top of cone), fading to nothing at bottom
        float alpha = vHeight * vHeight * uIntensity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  // ── Ember particles ──
  const EMBER_COUNT = 24;
  const emberPositions = new Float32Array(EMBER_COUNT * 3);
  const emberPhases = new Float32Array(EMBER_COUNT);
  const emberSpeeds = new Float32Array(EMBER_COUNT);
  const emberDrifts = new Float32Array(EMBER_COUNT * 2); // x,z drift per ember

  for (let i = 0; i < EMBER_COUNT; i++) {
    emberPhases[i] = Math.random() * Math.PI * 2;
    emberSpeeds[i] = 0.3 + Math.random() * 0.5;
    emberDrifts[i * 2] = (Math.random() - 0.5) * 0.15;
    emberDrifts[i * 2 + 1] = (Math.random() - 0.5) * 0.15;
    // Start at random heights in the lifecycle
    resetEmber(i, Math.random());
  }

  function resetEmber(i: number, heightFraction: number): void {
    emberPositions[i * 3] = (Math.random() - 0.5) * 0.08;
    emberPositions[i * 3 + 1] = heightFraction * 0.6;
    emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
  }

  const emberGeo = new BufferGeometry();
  emberGeo.setAttribute("position", new Float32BufferAttribute(emberPositions, 3));

  const emberMat = new PointsMaterial({
    color: "#ffaa40",
    size: 0.015,
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const emberPoints = new Points(emberGeo, emberMat);

  // ── Point light reference ──
  let light: PointLight | undefined = $state();
  let elapsed = Math.random() * 100;

  // ── Animation loop ──
  useTask((delta) => {
    elapsed += delta;

    // Update flame shader time
    flameMat.uniforms.uTime!.value = elapsed;

    // Animate point light intensity (same layered flicker as before)
    if (light) {
      const slow = Math.sin(elapsed * 1.2) * 0.15;
      const medium = Math.sin(elapsed * 4.7) * 0.1;
      const fast = Math.sin(elapsed * 13.3) * 0.05;
      const crackle = Math.sin(elapsed * 37.1) * Math.sin(elapsed * 23.7) * 0.08;
      const flicker = slow + medium + fast + crackle;

      light.intensity = baseIntensity + flicker * baseIntensity;
      light.color.setRGB(1.0, 0.56 + 0.02 * Math.sin(elapsed * 2.3), 0.13 - 0.01 * Math.sin(elapsed * 2.3));

      // Sync flame shader and light cone intensity with flicker
      flameMat.uniforms.uIntensity!.value = 0.85 + flicker * 0.5;
      (coneMat.uniforms.uIntensity as { value: number }).value = 0.12 + flicker * 0.06;
    }

    // Animate ember particles — drift upward, reset when they reach the top
    const posAttr = emberGeo.getAttribute("position") as Float32BufferAttribute;
    for (let i = 0; i < EMBER_COUNT; i++) {
      emberPositions[i * 3] += emberDrifts[i * 2]! * delta;
      emberPositions[i * 3 + 1] += emberSpeeds[i]! * delta;
      emberPositions[i * 3 + 2] += emberDrifts[i * 2 + 1]! * delta;

      // Reset when they drift too high
      if (emberPositions[i * 3 + 1]! > 0.6) {
        resetEmber(i, 0);
        // Re-randomize drift for variety
        emberDrifts[i * 2] = (Math.random() - 0.5) * 0.15;
        emberDrifts[i * 2 + 1] = (Math.random() - 0.5) * 0.15;
      }
    }
    posAttr.needsUpdate = true;
  });

  // Flame sits at top of shaft
  const flameY = y + 0.2;
  // Bracket at mounting height
  const bracketY = y - 0.05;
</script>

<!-- Iron bracket ring (holds the torch) -->
<T.Mesh
  geometry={bracketRingGeo}
  material={bracketMat}
  position.x={tx}
  position.y={bracketY}
  position.z={tz}
  rotation.x={Math.PI / 2}
/>

<!-- Bracket arm (connects ring to wall) -->
<T.Mesh
  geometry={bracketArmGeo}
  material={bracketMat}
  position.x={tx}
  position.y={bracketY}
  position.z={tz}
  rotation.z={Math.PI / 2}
/>

<!-- Wood shaft -->
<T.Mesh
  geometry={shaftGeo}
  material={shaftMat}
  position.x={tx}
  position.y={y + 0.02}
  position.z={tz}
/>

<!-- Flame billboard (noise shader) -->
<T.Mesh
  geometry={flameGeo}
  material={flameMat}
  position.x={tx}
  position.y={flameY}
  position.z={tz}
  frustumCulled={false}
/>

<!-- Volumetric light cone (pointing downward from flame) -->
<T.Mesh
  geometry={coneGeo}
  material={coneMat}
  position.x={tx}
  position.y={flameY - 0.5}
  position.z={tz}
/>

<!-- Ember particles rising from the flame -->
<T
  is={emberPoints}
  position.x={tx}
  position.y={flameY}
  position.z={tz}
/>

<!-- Animated point light for scene illumination -->
<T.PointLight
  bind:ref={light}
  position={[tx, flameY, tz]}
  intensity={baseIntensity}
  color={flameColor}
  {distance}
  decay={2}
/>
