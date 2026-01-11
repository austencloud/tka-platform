import type { Firefly } from "../domain/models/firefly-models";
import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import {
  FIREFLY_COUNTS,
  FIREFLY_PHYSICS,
  FIREFLY_SIZE,
  FIREFLY_OPACITY,
  FIREFLY_COLORS,
  FIREFLY_DEPTH,
  RESPAWN_BUFFER,
  SPECIAL_FIREFLY,
} from "../domain/constants/firefly-constants";

function randomInRange(min: number, range: number): number {
  return min + Math.random() * range;
}

function createFireflyColor(): { r: number; g: number; b: number } {
  const colorVariant = Math.random();

  if (colorVariant < FIREFLY_COLORS.YELLOW_GREEN.probability) {
    return {
      r: FIREFLY_COLORS.YELLOW_GREEN.r,
      g: randomInRange(
        FIREFLY_COLORS.YELLOW_GREEN.gMin,
        FIREFLY_COLORS.YELLOW_GREEN.gMax - FIREFLY_COLORS.YELLOW_GREEN.gMin
      ),
      b: randomInRange(
        FIREFLY_COLORS.YELLOW_GREEN.bMin,
        FIREFLY_COLORS.YELLOW_GREEN.bMax - FIREFLY_COLORS.YELLOW_GREEN.bMin
      ),
    };
  } else if (colorVariant < FIREFLY_COLORS.BRIGHT_GREEN.probability) {
    return {
      r: FIREFLY_COLORS.BRIGHT_GREEN.r,
      g: randomInRange(
        FIREFLY_COLORS.BRIGHT_GREEN.gMin,
        FIREFLY_COLORS.BRIGHT_GREEN.gMax - FIREFLY_COLORS.BRIGHT_GREEN.gMin
      ),
      b: randomInRange(
        FIREFLY_COLORS.BRIGHT_GREEN.bMin,
        FIREFLY_COLORS.BRIGHT_GREEN.bMax - FIREFLY_COLORS.BRIGHT_GREEN.bMin
      ),
    };
  } else {
    return {
      r: randomInRange(
        FIREFLY_COLORS.WARM_GOLD.rMin,
        FIREFLY_COLORS.WARM_GOLD.rMax - FIREFLY_COLORS.WARM_GOLD.rMin
      ),
      g: randomInRange(
        FIREFLY_COLORS.WARM_GOLD.gMin,
        FIREFLY_COLORS.WARM_GOLD.gMax - FIREFLY_COLORS.WARM_GOLD.gMin
      ),
      b: randomInRange(
        FIREFLY_COLORS.WARM_GOLD.bMin,
        FIREFLY_COLORS.WARM_GOLD.bMax - FIREFLY_COLORS.WARM_GOLD.bMin
      ),
    };
  }
}

export function createFireflySystem() {
  /**
   * Assign a depth layer based on distribution weights
   */
  function assignDepthLayer(): number {
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < FIREFLY_DEPTH.NUM_LAYERS; i++) {
      cumulative += FIREFLY_DEPTH.LAYER_DISTRIBUTION[i]!;
      if (rand < cumulative) return i;
    }
    return FIREFLY_DEPTH.NUM_LAYERS - 1;
  }

  /**
   * Get normalized depth value (0-1) from layer index
   */
  function getDepthValue(layer: number): number {
    return layer / (FIREFLY_DEPTH.NUM_LAYERS - 1);
  }

  function createFirefly(
    dimensions: Dimensions,
    randomizePosition: boolean = true,
    depthLayer?: number
  ): Firefly {
    // Assign depth layer if not provided
    const layer = depthLayer ?? assignDepthLayer();
    const depth = getDepthValue(layer);

    // Get depth-specific zone constraints
    const zoneTop = dimensions.height * FIREFLY_DEPTH.ZONE_TOP[layer]!;
    const zoneBottom = dimensions.height * FIREFLY_DEPTH.ZONE_BOTTOM[layer]!;
    const zoneHeight = zoneBottom - zoneTop;

    // Easter egg: 1% chance for a special rose-colored firefly (only in near layers)
    const isSpecial = layer >= FIREFLY_DEPTH.NUM_LAYERS - 2 && Math.random() < SPECIAL_FIREFLY.CHANCE;

    // Apply depth-based size scaling
    const sizeScale = FIREFLY_DEPTH.SIZE_SCALE[layer]!;
    const baseSize = randomInRange(FIREFLY_SIZE.MIN, FIREFLY_SIZE.RANGE) * sizeScale;
    const size = isSpecial
      ? baseSize * SPECIAL_FIREFLY.SIZE_MULTIPLIER
      : baseSize;

    // Apply depth-based glow scaling
    const glowScale = FIREFLY_DEPTH.GLOW_SCALE[layer]!;
    const glowMultiplier = isSpecial
      ? SPECIAL_FIREFLY.GLOW_MULTIPLIER * glowScale
      : FIREFLY_PHYSICS.GLOW_MULTIPLIER * glowScale;

    // Apply depth-based speed scaling (far = slower for parallax effect)
    const speedScale = FIREFLY_DEPTH.SPEED_SCALE[layer]!;
    const wanderAngle = Math.random() * Math.PI * 2;
    const wanderSpeed = randomInRange(
      FIREFLY_PHYSICS.WANDER_SPEED_BASE,
      FIREFLY_PHYSICS.WANDER_SPEED_RANGE
    ) * speedScale;

    // Apply depth-based opacity scaling
    const opacityScale = FIREFLY_DEPTH.OPACITY_SCALE[layer]!;
    const baseOpacity = randomInRange(FIREFLY_OPACITY.MIN, FIREFLY_OPACITY.RANGE) * opacityScale;

    // Apply atmospheric color shift (far = cooler, near = warmer)
    let color = isSpecial ? { ...SPECIAL_FIREFLY.COLOR } : createFireflyColor();
    const colorShift = FIREFLY_DEPTH.COLOR_SHIFT[layer]!;
    color = {
      r: Math.max(0, Math.min(255, color.r + colorShift.r)),
      g: Math.max(0, Math.min(255, color.g + colorShift.g)),
      b: Math.max(0, Math.min(255, color.b + colorShift.b)),
    };

    return {
      x: randomizePosition ? Math.random() * dimensions.width : -RESPAWN_BUFFER,
      y: randomizePosition
        ? zoneTop + Math.random() * zoneHeight
        : zoneTop + Math.random() * zoneHeight,
      size,
      vx: Math.cos(wanderAngle) * wanderSpeed,
      vy: Math.sin(wanderAngle) * wanderSpeed,
      glowRadius: size * glowMultiplier,
      glowIntensity: Math.random(),
      blinkPhase:
        Math.random() *
        (FIREFLY_PHYSICS.BLINK_CYCLE_MIN + FIREFLY_PHYSICS.BLINK_CYCLE_RANGE),
      blinkCycleLength:
        FIREFLY_PHYSICS.BLINK_CYCLE_MIN +
        Math.random() * FIREFLY_PHYSICS.BLINK_CYCLE_RANGE,
      color,
      wanderAngle,
      wanderSpeed,
      baseOpacity,
      isSpecial,
      depth,
    };
  }

  function initialize(
    dimensions: Dimensions,
    quality: QualityLevel
  ): Firefly[] {
    const count = FIREFLY_COUNTS[quality];
    const fireflies: Firefly[] = [];

    for (let i = 0; i < count; i++) {
      fireflies.push(createFirefly(dimensions, true));
    }

    return fireflies;
  }

  /**
   * Get depth layer index from normalized depth value
   */
  function getLayerFromDepth(depth: number): number {
    return Math.round(depth * (FIREFLY_DEPTH.NUM_LAYERS - 1));
  }

  function update(
    fireflies: Firefly[],
    dimensions: Dimensions,
    frameMultiplier: number = 1.0,
    a11y?: AccessibilitySettings
  ): Firefly[] {
    const reducedMotion = a11y?.reducedMotion ?? false;

    // For reduced motion: 95% reduction in movement, static glow (no blinking)
    const effectiveMultiplier = reducedMotion
      ? frameMultiplier * 0.05
      : frameMultiplier;

    return fireflies.map((firefly) => {
      // Get depth-specific zone constraints
      const layer = getLayerFromDepth(firefly.depth);
      const zoneTop = dimensions.height * FIREFLY_DEPTH.ZONE_TOP[layer]!;
      const zoneBottom = dimensions.height * FIREFLY_DEPTH.ZONE_BOTTOM[layer]!;

      // Update wander angle with smooth random changes
      const angleChange =
        (Math.random() - 0.5) *
        FIREFLY_PHYSICS.WANDER_ANGLE_RANGE *
        effectiveMultiplier;
      let newWanderAngle = firefly.wanderAngle + angleChange;

      // Soft boundary correction - steer back toward center if near edges
      if (firefly.y < zoneTop + 50) {
        newWanderAngle += 0.05 * effectiveMultiplier; // Steer down
      } else if (firefly.y > zoneBottom - 50) {
        newWanderAngle -= 0.05 * effectiveMultiplier; // Steer up
      }

      // Calculate new velocities from wander angle
      const newVx = Math.cos(newWanderAngle) * firefly.wanderSpeed;
      const newVy = Math.sin(newWanderAngle) * firefly.wanderSpeed;

      // Update position
      let newX = firefly.x + newVx * effectiveMultiplier;
      let newY = firefly.y + newVy * effectiveMultiplier;

      let newBlinkPhase: number;
      let newGlowIntensity: number;

      if (reducedMotion) {
        // Reduced motion: disable blinking, keep static glow
        newBlinkPhase = 0;
        newGlowIntensity = 0.7; // Constant gentle glow
      } else {
        // Update blink phase
        newBlinkPhase = firefly.blinkPhase + frameMultiplier;
        if (newBlinkPhase >= firefly.blinkCycleLength) {
          newBlinkPhase = 0;
        }

        // Calculate glow intensity based on blink phase
        const blinkProgress = newBlinkPhase / firefly.blinkCycleLength;

        if (blinkProgress < FIREFLY_PHYSICS.BLINK_ON_DURATION) {
          // Lit phase - smooth fade in/out
          const litProgress = blinkProgress / FIREFLY_PHYSICS.BLINK_ON_DURATION;
          // Use sine for smooth fade: 0 -> 1 -> 0
          newGlowIntensity = Math.sin(litProgress * Math.PI);
        } else {
          // Dark phase
          newGlowIntensity = 0;
        }
      }

      // Wrap horizontally
      if (newX < -RESPAWN_BUFFER) {
        newX = dimensions.width + RESPAWN_BUFFER;
      } else if (newX > dimensions.width + RESPAWN_BUFFER) {
        newX = -RESPAWN_BUFFER;
      }

      // Clamp vertically within depth-specific zone
      newY = Math.max(zoneTop, Math.min(zoneBottom, newY));

      return {
        ...firefly,
        x: newX,
        y: newY,
        vx: newVx,
        vy: newVy,
        wanderAngle: newWanderAngle,
        blinkPhase: newBlinkPhase,
        glowIntensity: newGlowIntensity,
      };
    });
  }

  /**
   * Draw a single firefly
   */
  function drawFirefly(firefly: Firefly, ctx: CanvasRenderingContext2D): void {
    if (firefly.glowIntensity < 0.01) return; // Skip if nearly invisible

    const { x, y, size, glowRadius, glowIntensity, color, baseOpacity } =
      firefly;
    const opacity = baseOpacity * glowIntensity;

    // Draw outer glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    gradient.addColorStop(
      0,
      `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`
    );
    gradient.addColorStop(
      0.3,
      `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.5})`
    );
    gradient.addColorStop(
      0.6,
      `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.2})`
    );
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(
      x - glowRadius,
      y - glowRadius,
      glowRadius * 2,
      glowRadius * 2
    );

    // Draw bright core
    ctx.fillStyle = `rgba(${Math.min(255, color.r + 40)}, ${Math.min(255, color.g + 20)}, ${Math.min(255, color.b + 20)}, ${Math.min(1, opacity * FIREFLY_OPACITY.CORE_MULTIPLIER)})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw all fireflies (backwards compatibility)
   */
  function draw(fireflies: Firefly[], ctx: CanvasRenderingContext2D): void {
    for (const firefly of fireflies) {
      drawFirefly(firefly, ctx);
    }
  }

  /**
   * Draw fireflies within a specific depth range
   * @param fireflies All fireflies
   * @param ctx Canvas context
   * @param minDepth Minimum depth (0 = farthest)
   * @param maxDepth Maximum depth (1 = nearest)
   */
  function drawByDepthRange(
    fireflies: Firefly[],
    ctx: CanvasRenderingContext2D,
    minDepth: number,
    maxDepth: number
  ): void {
    for (const firefly of fireflies) {
      if (firefly.depth >= minDepth && firefly.depth <= maxDepth) {
        drawFirefly(firefly, ctx);
      }
    }
  }

  /**
   * Draw fireflies for a specific depth layer (for interleaving with tree layers)
   * @param fireflies All fireflies
   * @param ctx Canvas context
   * @param layer Depth layer index (0 = far, NUM_LAYERS-1 = near)
   */
  function drawLayer(
    fireflies: Firefly[],
    ctx: CanvasRenderingContext2D,
    layer: number
  ): void {
    const numLayers = FIREFLY_DEPTH.NUM_LAYERS;
    const minDepth = layer / (numLayers - 1) - 0.01;
    const maxDepth = (layer + 1) / (numLayers - 1) + 0.01;

    for (const firefly of fireflies) {
      if (firefly.depth >= minDepth && firefly.depth < maxDepth) {
        drawFirefly(firefly, ctx);
      }
    }
  }

  /**
   * Get the number of depth layers
   */
  function getNumDepthLayers(): number {
    return FIREFLY_DEPTH.NUM_LAYERS;
  }

  function adjustToResize(
    fireflies: Firefly[],
    oldDimensions: Dimensions,
    newDimensions: Dimensions,
    quality: QualityLevel
  ): Firefly[] {
    const scaleX = newDimensions.width / oldDimensions.width;
    const scaleY = newDimensions.height / oldDimensions.height;
    const targetCount = FIREFLY_COUNTS[quality];

    const adjusted = fireflies.map((f) => ({
      ...f,
      x: f.x * scaleX,
      y: f.y * scaleY,
    }));

    while (adjusted.length < targetCount) {
      adjusted.push(createFirefly(newDimensions, true));
    }
    while (adjusted.length > targetCount) {
      adjusted.pop();
    }

    return adjusted;
  }

  function setQuality(
    fireflies: Firefly[],
    dimensions: Dimensions,
    quality: QualityLevel
  ): Firefly[] {
    const targetCount = FIREFLY_COUNTS[quality];
    const adjusted = [...fireflies];

    while (adjusted.length < targetCount) {
      adjusted.push(createFirefly(dimensions, true));
    }
    while (adjusted.length > targetCount) {
      adjusted.pop();
    }

    return adjusted;
  }

  return {
    createFirefly,
    initialize,
    update,
    draw,
    drawLayer,
    drawByDepthRange,
    getNumDepthLayers,
    adjustToResize,
    setQuality,
  };
}
