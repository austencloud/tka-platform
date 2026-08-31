<script lang="ts">
  /**
   * FallingParticles Primitive
   *
   * Generic particle emitter for atmospheric effects.
   * Supports leaves, snow, petals, embers, and stars.
   * Uses GPU-accelerated Points geometry with custom shaders.
   */

  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import {
    Vector2,
    Vector3,
    BufferGeometry,
    Float32BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
    NormalBlending,
    Color,
  } from "three";
  import type {
    ParticleRangeFalloff,
    ParticleType,
  } from "../domain/models/environment-models";
  import {
    prefersReducedMotion,
    resolveMotionScale,
  } from "./motion-preference";

  const _tempVel = new Vector3();

  /** Silhouettes the fragment shader can draw. */
  type ParticleShape =
    | "circle"
    | "diamond"
    | "petal"
    | "star"
    | "glow"
    | "snowflake"
    | "leaf";

  interface Props {
    /** Particle behavior type */
    type?: ParticleType;
    /** Maximum particle count */
    count?: number;
    /** Emission area dimensions */
    area?: { width: number; height: number; depth: number };
    /** Fall/drift speed */
    speed?: number;
    /** Particle colors (randomly selected) */
    colors?: string[];
    /** Size range [min, max] */
    sizeRange?: [number, number];
    /** Whether particles should spin */
    spin?: boolean;
    /** Whether emitter is active */
    enabled?: boolean;
    /** Overall particle opacity. */
    opacity?: number;
    /**
     * Overrides the silhouette this particle type normally draws. Left unset,
     * each type keeps its own default shape.
     */
    shape?: ParticleShape;
    /**
     * Forces the animation time multiplier. Left unset, the emitter follows the
     * operating-system reduced-motion preference.
     */
    motionScale?: number;
    /**
     * Shapes the horizontal spawn footprint. Ellipse keeps particles beneath
     * a rounded canopy instead of filling the corners of its bounding box.
     */
    emissionShape?: "box" | "ellipse";
    /**
     * Born at the floor of the area and accelerating upward for the whole
     * climb. Left off, a rising type keeps its legacy profile — born at the
     * ceiling, decelerating — which the other scenes are tuned against.
     */
    buoyant?: boolean;
    /**
     * Range treatment. Left unset the emitter draws exactly as before: the
     * uniforms below resolve to an identity multiply.
     */
    rangeFalloff?: ParticleRangeFalloff;
  }

  // Default values in meters (1 unit = 1 meter)
  let {
    type = "leaves",
    count = 80,
    area = { width: 4, height: 3, depth: 4 },
    speed = 0.15,
    colors = ["#d97706", "#dc2626", "#ea580c"],
    sizeRange = [0.04, 0.08],
    spin = true,
    enabled = true,
    opacity = 1,
    shape,
    motionScale,
    emissionShape = "box",
    buoyant = false,
    rangeFalloff,
  }: Props = $props();

  // Particle data
  interface Particle {
    position: Vector3;
    velocity: Vector3;
    rotation: number;
    rotationSpeed: number;
    size: number;
    colorIndex: number;
    swayPhase: number;
    swaySpeed: number;
    // Firefly-specific
    pulsePhase: number;
    pulseSpeed: number;
    baseSize: number;
    /** Blade narrowness for shapes that read as a silhouette, not a dot. */
    aspect: number;
  }

  let particles: Particle[] = [];
  // Must be $state for Svelte 5 reactivity - template needs to re-render after onMount
  let geometry = $state<BufferGeometry | null>(null);
  let material = $state<ShaderMaterial | null>(null);

  const reducedMotion = $derived(prefersReducedMotion());
  const activeMotionScale = $derived(
    resolveMotionScale(reducedMotion, motionScale)
  );

  // Type-specific behavior (values in meters)
  const typeConfigs = {
    leaves: {
      gravity: 0.1,
      swayAmount: 0.2,
      blending: NormalBlending,
      shape: "leaf",
      pulses: false,
    },
    snow: {
      gravity: 0.075,
      swayAmount: 0.18,
      blending: AdditiveBlending,
      shape: "snowflake",
      pulses: false,
    },
    petals: {
      gravity: 0.06,
      swayAmount: 0.25,
      blending: NormalBlending,
      shape: "petal",
      pulses: false,
    },
    embers: {
      gravity: -0.125, // Rise up
      swayAmount: 0.075,
      blending: AdditiveBlending,
      shape: "circle",
      pulses: false,
    },
    stars: {
      gravity: 0.025, // Very slow drift
      swayAmount: 0.05,
      blending: AdditiveBlending,
      shape: "star",
      pulses: false,
    },
    bubbles: {
      gravity: -0.1, // Rise up
      swayAmount: 0.125,
      blending: AdditiveBlending,
      shape: "circle",
      pulses: false,
    },
    fireflies: {
      gravity: 0, // No gravity - they float freely
      swayAmount: 0.15, // Very gentle meandering
      blending: AdditiveBlending,
      shape: "glow", // Special glowing shape
      pulses: true, // Pulsing glow effect
    },
    dust: {
      gravity: 0.01, // Very slow drift down
      swayAmount: 0.3, // Lots of wandering
      blending: AdditiveBlending,
      shape: "circle", // Tiny soft circles
      pulses: false,
    },
    smoke: {
      gravity: -0.04, // Rise slowly
      swayAmount: 0.2, // Gentle drift
      blending: AdditiveBlending,
      shape: "circle", // Soft puffs
      pulses: false,
    },
    steam: {
      // Like smoke but from heat hitting cold air - rises faster, drifts more,
      // fades wispier. Used by the winter campfire.
      gravity: -0.18,
      swayAmount: 0.45,
      blending: AdditiveBlending,
      shape: "circle",
      pulses: false,
    },
  };

  const config = $derived(typeConfigs[type]);

  // Vertex shader
  // Point size scaling: size is in meters, we convert to screen pixels
  // At 1 meter away, 1 meter size = ~1000 pixels (screen-filling)
  // So a 0.1m leaf at 5m distance = 0.1 * 1000 / 5 = 20 pixels
  const vertexShader = `
    attribute float size;
    attribute float rotation;
    attribute float colorIndex;
    attribute float aspect;

    uniform float uSubPixelFade;
    uniform vec2 uFadeRange;
    uniform vec2 uTintRange;

    varying float vRotation;
    varying float vColorIndex;
    varying float vAspect;
    varying float vRangeAlpha;
    varying float vRangeTint;

    void main() {
      vRotation = rotation;
      vColorIndex = colorIndex;
      vAspect = aspect;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float projected = size * (1000.0 / -mvPosition.z);
      gl_PointSize = projected;

      // A point below the driver's one-pixel floor is still rasterised a whole
      // pixel wide, so its coverage has to come off the alpha or a far mote
      // draws many times the light it earns.
      float subPixel = mix(1.0, clamp(projected, 0.0, 1.0), uSubPixelFade);

      float dist = -mvPosition.z;
      float fade = uFadeRange.y > uFadeRange.x
        ? 1.0 - smoothstep(uFadeRange.x, uFadeRange.y, dist)
        : 1.0;
      vRangeAlpha = subPixel * fade;
      vRangeTint = uTintRange.y > uTintRange.x
        ? smoothstep(uTintRange.x, uTintRange.y, dist)
        : 0.0;

      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  // Fragment shader with shape support
  const fragmentShader = `
    uniform vec3 uColors[4];
    uniform float uShape; // 0=circle 1=diamond 2=petal 3=star 4=glow 5=snowflake 6=leaf
    uniform float uOpacity;
    uniform vec3 uTintColor;

    varying float vRotation;
    varying float vColorIndex;
    varying float vAspect;
    varying float vRangeAlpha;
    varying float vRangeTint;

    void main() {
      vec2 center = gl_PointCoord - 0.5;

      // Apply rotation
      float c = cos(vRotation);
      float s = sin(vRotation);
      vec2 rotated = vec2(
        center.x * c - center.y * s,
        center.x * s + center.y * c
      );

      float dist = length(rotated);
      float alpha = 0.0;
      // Shape-local shading. Only the leaf uses it; everything else keeps the
      // flat colour it has always had.
      float shade = 1.0;

      if (uShape < 0.5) {
        // Circle (snow, embers)
        alpha = 1.0 - smoothstep(0.3, 0.5, dist);
      } else if (uShape < 1.5) {
        // Diamond - retained for any caller that explicitly asks for it.
        float diamond = abs(rotated.x) + abs(rotated.y);
        alpha = 1.0 - smoothstep(0.35, 0.5, diamond);
      } else if (uShape < 2.5) {
        // Petal
        float petal = dist + 0.3 * abs(rotated.x);
        alpha = 1.0 - smoothstep(0.3, 0.45, petal);
      } else if (uShape < 3.5) {
        // Star
        float angle = atan(rotated.y, rotated.x);
        float star = dist * (1.0 + 0.3 * sin(angle * 5.0));
        alpha = 1.0 - smoothstep(0.25, 0.4, star);
      } else if (uShape < 4.5) {
        // Glow (fireflies) - soft radial gradient with bright core
        float core = 1.0 - smoothstep(0.0, 0.15, dist);
        float halo = (1.0 - smoothstep(0.1, 0.5, dist)) * 0.6;
        alpha = core + halo;
      } else if (uShape < 5.5) {
        // Snowflake - four per-particle variants keyed to vColorIndex so the
        // field reads as real snow (mix of crystals, sparkles, soft blurs).
        float variant = floor(vColorIndex);
        float angle = atan(rotated.y, rotated.x);
        float shapeAlpha = 0.0;

        if (variant < 0.5) {
          // Classic 6-armed crystalline flake
          float arms = cos(angle * 6.0);
          float detail = cos(angle * 12.0);
          float armMask = dist + (1.0 - arms) * 0.14 + (1.0 - detail) * 0.03;
          shapeAlpha = 1.0 - smoothstep(0.22, 0.42, armMask);
        } else if (variant < 1.5) {
          // 8-armed delicate flake (thinner arms, tighter)
          float arms = cos(angle * 8.0);
          float armMask = dist + (1.0 - arms) * 0.09;
          shapeAlpha = 1.0 - smoothstep(0.20, 0.36, armMask);
        } else if (variant < 2.5) {
          // Tiny bright sparkle - short cross-spikes + bright core
          float spikes = max(0.0, cos(angle * 4.0) - 0.3);
          shapeAlpha = spikes * (1.0 - smoothstep(0.0, 0.32, dist)) * 1.2;
        } else {
          // Soft round flake (far-away / out-of-focus feel)
          shapeAlpha = (1.0 - smoothstep(0.15, 0.38, dist)) * 0.65;
        }

        // Gentle inner glow on every variant
        float core = 1.0 - smoothstep(0.0, 0.10, dist);
        alpha = min(shapeAlpha + core * 0.35, 1.0);
      } else {
        // Leaf - an ovate blade with a rounded base, a drawn-out tip, a shallow
        // lobed margin, a short petiole and a darker midrib. vAspect narrows
        // each blade on its own so a drift never reads as one stamp repeated
        // across the screen, which is what the old diamond did.
        vec2 p = vec2(rotated.x / max(vAspect, 0.20), rotated.y);
        float along = clamp(p.y + 0.5, 0.0, 1.0);      // 0 at petiole, 1 at tip
        float blade = clamp((along - 0.14) / 0.86, 0.0, 1.0);
        // The fractional power swells the profile quickly off the base, so the
        // blade reads rounded where it joins the stem and tapers to a point.
        float halfWidth = 0.30 * sin(pow(blade, 0.58) * 3.14159265);
        halfWidth *= 0.88 + 0.12 * cos(blade * 17.0);  // shallow margin lobes
        float aa = 0.018;
        float body =
          (1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(p.x))) *
          step(0.14, along);
        float stem =
          (1.0 - smoothstep(0.012, 0.028, abs(p.x))) *
          step(0.02, along) *
          (1.0 - step(0.18, along));
        alpha = clamp(body + stem, 0.0, 1.0);
        // Midrib reads as a darker spine; the margin catches a little more of
        // the sky, which is what separates a leaf from a coloured quad.
        shade =
          mix(0.60, 1.14, smoothstep(0.0, 0.055, abs(p.x))) *
          mix(0.84, 1.08, blade);
      }

      if (alpha < 0.01) discard;

      // Select color based on index
      int idx = int(floor(vColorIndex));
      vec3 color = uColors[min(idx, 3)] * shade;
      // Distance never carries a particle toward white: it settles on a colour
      // the look chose, so a far ember stays an ember.
      color = mix(color, uTintColor, vRangeTint);

      gl_FragColor = vec4(color, alpha * uOpacity * vRangeAlpha);
    }
  `;

  function spawnParticle(): Particle {
    let x: number;
    let z: number;
    if (emissionShape === "ellipse") {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random());
      x = Math.cos(angle) * radius * area.width * 0.5;
      z = Math.sin(angle) * radius * area.depth * 0.5;
    } else {
      x = (Math.random() - 0.5) * area.width;
      z = (Math.random() - 0.5) * area.depth;
    }

    // Fireflies spawn throughout the area, buoyant fields at the floor they
    // climb from, everything else at the top it falls from.
    const isFirefly = type === "fireflies";
    const y = isFirefly
      ? (Math.random() - 0.5) * area.height * 0.8 // Throughout area
      : buoyant
        ? -area.height * 0.4 - Math.random() * 0.25 // At the floor
        : area.height * 0.4 + Math.random() * 0.25; // At top (0.25m variation)

    // Fireflies have very slow random drift, others fall/rise (values in m/s)
    const vx = isFirefly
      ? (Math.random() - 0.5) * 0.025
      : (Math.random() - 0.5) * 0.05;
    const vy = isFirefly
      ? (Math.random() - 0.5) * 0.015 // Gentle vertical drift
      : buoyant
        ? speed * (0.5 + Math.random() * 0.5)
        : -speed * (0.5 + Math.random() * 0.5) * (type === "embers" ? -1 : 1);
    const vz = isFirefly
      ? (Math.random() - 0.5) * 0.025
      : (Math.random() - 0.5) * 0.05;

    const baseSize =
      sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);

    return {
      position: new Vector3(x, y, z),
      velocity: new Vector3(vx, vy, vz),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: spin ? (Math.random() - 0.5) * 3 : 0,
      size: baseSize,
      baseSize,
      colorIndex: Math.floor(Math.random() * colors.length),
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: isFirefly
        ? 0.15 + Math.random() * 0.25
        : 1 + Math.random() * 2,
      // Firefly pulse timing - slow, gentle glow
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: isFirefly
        ? 0.2 + Math.random() * 0.4
        : 0.5 + Math.random() * 1.5,
      // Narrow blades and broad blades in the same fall.
      aspect: 0.42 + Math.random() * 0.55,
    };
  }

  function getShapeIndex(): number {
    switch (shape ?? config.shape) {
      case "circle":
        return 0;
      case "diamond":
        return 1;
      case "petal":
        return 2;
      case "star":
        return 3;
      case "glow":
        return 4;
      case "snowflake":
        return 5;
      case "leaf":
        return 6;
      default:
        return 0;
    }
  }

  onMount(() => {
    // Create buffers for geometry attributes
    const positionBuffer = new Float32Array(count * 3);
    const sizeBuffer = new Float32Array(count);
    const rotationBuffer = new Float32Array(count);
    const colorIndexBuffer = new Float32Array(count);
    const aspectBuffer = new Float32Array(count);

    geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(positionBuffer, 3)
    );
    geometry.setAttribute("size", new Float32BufferAttribute(sizeBuffer, 1));
    geometry.setAttribute(
      "rotation",
      new Float32BufferAttribute(rotationBuffer, 1)
    );
    geometry.setAttribute(
      "colorIndex",
      new Float32BufferAttribute(colorIndexBuffer, 1)
    );
    geometry.setAttribute(
      "aspect",
      new Float32BufferAttribute(aspectBuffer, 1)
    );

    // Convert color strings to Color objects
    const colorArray = colors.slice(0, 4).map((c) => new Color(c));
    while (colorArray.length < 4) {
      colorArray.push(colorArray[0] || new Color("#ffffff"));
    }

    material = new ShaderMaterial({
      uniforms: {
        uColors: { value: colorArray },
        uShape: { value: getShapeIndex() },
        uOpacity: { value: opacity },
        uSubPixelFade: { value: rangeFalloff?.subPixel ? 1 : 0 },
        // An empty range is the off switch: the shaders compare y > x.
        uFadeRange: {
          value: new Vector2(
            rangeFalloff?.fade?.[0] ?? 0,
            rangeFalloff?.fade?.[1] ?? 0
          ),
        },
        uTintRange: {
          value: new Vector2(
            rangeFalloff?.tint?.start ?? 0,
            rangeFalloff?.tint?.end ?? 0
          ),
        },
        uTintColor: {
          value: new Color(rangeFalloff?.tint?.color ?? "#ffffff"),
        },
      },
      vertexShader,
      fragmentShader,
      blending: config.blending,
      depthWrite: false,
      transparent: true,
    });

    // Initialize particles distributed throughout the area
    for (let i = 0; i < count; i++) {
      const p = spawnParticle();
      p.position.y = (Math.random() - 0.5) * area.height;
      particles.push(p);
    }
  });

  onDestroy(() => {
    geometry?.dispose();
    material?.dispose();
    particles = [];
  });

  // Update colors when they change
  $effect(() => {
    if (material?.uniforms?.uColors) {
      const colorArray = colors.slice(0, 4).map((c) => new Color(c));
      while (colorArray.length < 4) {
        colorArray.push(colorArray[0] || new Color("#ffffff"));
      }
      material.uniforms.uColors.value = colorArray;
    }
  });

  // Update shape when type changes
  $effect(() => {
    if (material?.uniforms?.uShape) {
      material.uniforms.uShape.value = getShapeIndex();
    }
  });

  $effect(() => {
    if (material?.uniforms?.uOpacity) {
      material.uniforms.uOpacity.value = opacity;
    }
  });

  $effect(() => {
    const uniforms = material?.uniforms;
    if (!uniforms?.uSubPixelFade) return;
    uniforms.uSubPixelFade.value = rangeFalloff?.subPixel ? 1 : 0;
    (uniforms.uFadeRange?.value as Vector2 | undefined)?.set(
      rangeFalloff?.fade?.[0] ?? 0,
      rangeFalloff?.fade?.[1] ?? 0
    );
    (uniforms.uTintRange?.value as Vector2 | undefined)?.set(
      rangeFalloff?.tint?.start ?? 0,
      rangeFalloff?.tint?.end ?? 0
    );
    (uniforms.uTintColor?.value as Color | undefined)?.set(
      rangeFalloff?.tint?.color ?? "#ffffff"
    );
  });

  // Animation loop.
  //
  // `time` is a local accumulator fed by the useTask delta instead of
  // `performance.now()`. That matters during offline video export:
  // Cinema mode renders 4 sub-frames per output frame back-to-back at
  // CPU speed, so wall-clock time races ahead of the animation clock
  // and firefly pulses appear to oscillate rapidly. Accumulating from
  // delta keeps the pulse clock in lockstep with the rendered timeline
  // both during live playback (real delta) and during export
  // (synthetic delta = 1/(fps * subFrames)).
  //
  // The delta is scaled by the reduced-motion preference. At scale 0 the
  // particles hold their last pose and the buffers still upload once, so a
  // reduced-motion viewer gets a still field rather than an empty one.
  let localTime = 0;
  useTask((rawDelta) => {
    if (!geometry || !material || !enabled) return;

    const delta = rawDelta * activeMotionScale;
    localTime += delta;
    const time = localTime;
    const isFirefly = type === "fireflies";

    // Get direct references to geometry arrays (once per frame, not per particle)
    const posAttr = geometry.attributes.position;
    const sizeAttr = geometry.attributes.size;
    const rotAttr = geometry.attributes.rotation;
    const colorAttr = geometry.attributes.colorIndex;
    const aspectAttr = geometry.attributes.aspect;
    if (!posAttr || !sizeAttr || !rotAttr || !colorAttr || !aspectAttr) return;

    const posArray = posAttr.array as Float32Array;
    const sizeArray = sizeAttr.array as Float32Array;
    const rotArray = rotAttr.array as Float32Array;
    const colorArray = colorAttr.array as Float32Array;
    const aspectArray = aspectAttr.array as Float32Array;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p) continue;

      // Apply gravity (fireflies have none)
      if (config.gravity !== 0) {
        if (buoyant) {
          // Convection accelerates a climb. The legacy embers branch inverted
          // the sign a second time and decelerated instead, so a mote reached
          // its apex in about a second and hung there — the stalled dots that
          // read as stuck pixels rather than as anything rising.
          p.velocity.y += Math.abs(config.gravity) * delta;
        } else {
          p.velocity.y -= config.gravity * delta * (type === "embers" ? -1 : 1);
        }
      }

      // Apply sway - fireflies also sway in Z direction for 3D wandering
      const sway =
        Math.sin(time * p.swaySpeed + p.swayPhase) * config.swayAmount * delta;
      p.position.x += sway;
      if (isFirefly) {
        const swayZ =
          Math.cos(time * p.swaySpeed * 0.7 + p.swayPhase) *
          config.swayAmount *
          delta *
          0.5;
        p.position.z += swayZ;
      }

      // Update position
      p.position.add(_tempVel.copy(p.velocity).multiplyScalar(delta));

      p.rotation += p.rotationSpeed * delta;

      // Firefly pulsing - realistic blink pattern (mostly dark, occasional flash)
      if (isFirefly && config.pulses) {
        const pulseValue = Math.sin(time * p.pulseSpeed + p.pulsePhase);
        // Only flash when sine wave is above threshold (~30% of cycle)
        const flashThreshold = 0.5;
        if (pulseValue > flashThreshold) {
          // Map threshold-1.0 to 0-1 for intensity
          const rawIntensity =
            (pulseValue - flashThreshold) / (1 - flashThreshold);
          // Apply smoothstep for gentle fade in/out
          const smoothedIntensity =
            rawIntensity * rawIntensity * (3 - 2 * rawIntensity);
          p.size = p.baseSize * smoothedIntensity;
        } else {
          // Dark/invisible when not flashing
          p.size = 0;
        }
      }

      // Respawn if out of bounds
      const halfHeight = area.height / 2;
      const halfWidth = area.width / 2;
      const halfDepth = area.depth / 2;

      if (
        p.position.y < -halfHeight ||
        p.position.y > halfHeight + 0.5 || // 0.5m above area
        Math.abs(p.position.x) > halfWidth ||
        Math.abs(p.position.z) > halfDepth
      ) {
        const newP = spawnParticle();
        p.position.copy(newP.position);
        p.velocity.copy(newP.velocity);
        p.rotation = newP.rotation;
        p.rotationSpeed = newP.rotationSpeed;
        p.size = newP.size;
        p.baseSize = newP.baseSize;
        p.colorIndex = newP.colorIndex;
        p.swayPhase = newP.swayPhase;
        p.swaySpeed = newP.swaySpeed;
        p.pulsePhase = newP.pulsePhase;
        p.pulseSpeed = newP.pulseSpeed;
        p.aspect = newP.aspect;
      }

      // Write to geometry attribute arrays
      posArray[i * 3] = p.position.x;
      posArray[i * 3 + 1] = p.position.y;
      posArray[i * 3 + 2] = p.position.z;
      sizeArray[i] = p.size;
      rotArray[i] = p.rotation;
      colorArray[i] = p.colorIndex;
      aspectArray[i] = p.aspect;
    }

    // Mark attributes as needing update
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    rotAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    aspectAttr.needsUpdate = true;
  });
</script>

{#if geometry && material}
  <T.Points {geometry} {material} frustumCulled={false} />
{/if}
