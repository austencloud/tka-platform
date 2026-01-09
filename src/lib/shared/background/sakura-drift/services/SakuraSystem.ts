import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { SakuraPetal, PetalDepth } from "../domain/models/sakura-models";
import {
  SAKURA_COUNTS,
  SAKURA_COUNTS_MOBILE,
  SAKURA_DISTRIBUTION,
  SAKURA_PHYSICS,
  SAKURA_PHYSICS_MOBILE,
  SAKURA_SIZE,
  SAKURA_ROTATION,
  SAKURA_OPACITY,
  SAKURA_COLORS,
  SAKURA_FLOWER,
  SAKURA_PETAL,
  SAKURA_BOUNDS,
  SAKURA_PARALLAX,
} from "../domain/constants/sakura-constants";

/**
 * Detect if viewport is mobile-sized
 */
function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

/**
 * Assign a random depth layer based on distribution percentages
 */
function assignDepth(): PetalDepth {
  const roll = Math.random();
  if (roll < SAKURA_PARALLAX.far.distribution) {
    return "far";
  } else if (roll < SAKURA_PARALLAX.far.distribution + SAKURA_PARALLAX.mid.distribution) {
    return "mid";
  } else {
    return "near";
  }
}

/**
 * Get parallax config for a depth layer
 */
function getDepthConfig(depth: PetalDepth) {
  return SAKURA_PARALLAX[depth];
}

/**
 * Creates and manages the sakura petal particle system
 */
export function createSakuraSystem() {
  /**
   * Initialize petals with stratified vertical distribution
   * This ensures even spacing across the screen instead of random clusters
   */
  function initialize(
    dimensions: Dimensions,
    quality: QualityLevel
  ): SakuraPetal[] {
    const count = getPetalCount(quality);
    const petals: SakuraPetal[] = [];

    // Use stratified sampling for even vertical distribution
    // Divide screen into horizontal bands, place one particle per band with jitter
    const bandHeight = dimensions.height / count;

    for (let i = 0; i < count; i++) {
      const bandStart = i * bandHeight;
      // Random Y position within this band (stratified with jitter)
      const stratifiedY = bandStart + Math.random() * bandHeight;
      petals.push(createPetalWithPosition(dimensions, stratifiedY));
    }

    return petals;
  }

  /**
   * Create petal at a specific Y position (for stratified initialization)
   * Used during initial population - starts with zero horizontal velocity
   * so petals appear in place rather than flying in from the side
   */
  function createPetalWithPosition(
    dimensions: Dimensions,
    y: number
  ): SakuraPetal {
    const x = Math.random() * dimensions.width;

    // 30% chance of being a full flower, 70% single petal
    const isFlower = Math.random() < SAKURA_DISTRIBUTION.FLOWER_PROBABILITY;

    // Size variation - flowers are larger
    const size = isFlower
      ? SAKURA_SIZE.FLOWER.MIN + Math.random() * SAKURA_SIZE.FLOWER.RANGE
      : SAKURA_SIZE.PETAL.MIN + Math.random() * SAKURA_SIZE.PETAL.RANGE;

    // Base falling speed - slower for larger items (parallax effect)
    const baseVy =
      (SAKURA_PHYSICS.FALLING_SPEED_BASE +
        Math.random() * SAKURA_PHYSICS.FALLING_SPEED_RANGE) *
      (1 / (size / 4));

    // Drift bias determines the petal's tendency to drift one direction
    // but initial velocity is ZERO so petals don't fly in from the side
    const driftBias =
      (Math.random() - 0.5) * 2 * SAKURA_PHYSICS.DRIFT_BIAS_RANGE;
    // Start with no horizontal velocity - wind will gradually move them
    const vx = 0;

    // Rotation properties - flowers rotate slower
    const rotationSpeed = isFlower
      ? (Math.random() - SAKURA_ROTATION.RANDOMNESS) *
        SAKURA_ROTATION.FLOWER_SPEED
      : (Math.random() - SAKURA_ROTATION.RANDOMNESS) *
        SAKURA_ROTATION.PETAL_SPEED;

    // Sway properties - primary oscillation
    const swayAmplitude =
      SAKURA_PHYSICS.SWAY_AMPLITUDE_MIN +
      Math.random() * SAKURA_PHYSICS.SWAY_AMPLITUDE_RANGE;
    const swayOffset = Math.random() * Math.PI * 2;

    // Secondary sway - different phase for complexity
    const secondarySwayOffset = Math.random() * Math.PI * 2;

    // Tumble properties - controls fall speed variation
    const tumblePhase = Math.random() * Math.PI * 2;
    const tumbleSpeed =
      SAKURA_PHYSICS.TUMBLE_SPEED_MIN +
      Math.random() * SAKURA_PHYSICS.TUMBLE_SPEED_RANGE;

    // Flutter intensity - petals flutter more than flowers
    const flutterIntensity = isFlower
      ? Math.random() * 0.3
      : 0.4 + Math.random() * 0.6;

    // Color variation - vibrant flowers, varied petals
    const colorVariant = Math.random();
    let r: number, g: number, b: number;

    if (isFlower) {
      // Flowers get vibrant, saturated colors
      if (colorVariant < SAKURA_COLORS.FLOWER_MAGENTA.probability) {
        // Vibrant magenta-pink (showstoppers)
        r = SAKURA_COLORS.FLOWER_MAGENTA.r;
        g =
          SAKURA_COLORS.FLOWER_MAGENTA.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_MAGENTA.gMax -
                SAKURA_COLORS.FLOWER_MAGENTA.gMin)
          );
        b =
          SAKURA_COLORS.FLOWER_MAGENTA.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_MAGENTA.bMax -
                SAKURA_COLORS.FLOWER_MAGENTA.bMin)
          );
      } else if (colorVariant < SAKURA_COLORS.FLOWER_PINK.probability) {
        // Bright cherry pink
        r = SAKURA_COLORS.FLOWER_PINK.r;
        g =
          SAKURA_COLORS.FLOWER_PINK.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_PINK.gMax - SAKURA_COLORS.FLOWER_PINK.gMin)
          );
        b =
          SAKURA_COLORS.FLOWER_PINK.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_PINK.bMax - SAKURA_COLORS.FLOWER_PINK.bMin)
          );
      } else {
        // Soft blush (lighter accent)
        r = SAKURA_COLORS.FLOWER_BLUSH.r;
        g =
          SAKURA_COLORS.FLOWER_BLUSH.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_BLUSH.gMax -
                SAKURA_COLORS.FLOWER_BLUSH.gMin)
          );
        b =
          SAKURA_COLORS.FLOWER_BLUSH.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_BLUSH.bMax -
                SAKURA_COLORS.FLOWER_BLUSH.bMin)
          );
      }
    } else {
      // Petals get a mix of deep and soft colors
      if (colorVariant < SAKURA_COLORS.PETAL_ROSE.probability) {
        // Deep rose (adds depth)
        r = SAKURA_COLORS.PETAL_ROSE.r;
        g =
          SAKURA_COLORS.PETAL_ROSE.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_ROSE.gMax - SAKURA_COLORS.PETAL_ROSE.gMin)
          );
        b =
          SAKURA_COLORS.PETAL_ROSE.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_ROSE.bMax - SAKURA_COLORS.PETAL_ROSE.bMin)
          );
      } else if (colorVariant < SAKURA_COLORS.PETAL_PINK.probability) {
        // Soft pink
        r = SAKURA_COLORS.PETAL_PINK.r;
        g =
          SAKURA_COLORS.PETAL_PINK.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_PINK.gMax - SAKURA_COLORS.PETAL_PINK.gMin)
          );
        b =
          SAKURA_COLORS.PETAL_PINK.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_PINK.bMax - SAKURA_COLORS.PETAL_PINK.bMin)
          );
      } else if (colorVariant < SAKURA_COLORS.PETAL_CREAM.probability) {
        // Cream (contrast)
        r = SAKURA_COLORS.PETAL_CREAM.r;
        g =
          SAKURA_COLORS.PETAL_CREAM.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_CREAM.gMax - SAKURA_COLORS.PETAL_CREAM.gMin)
          );
        b =
          SAKURA_COLORS.PETAL_CREAM.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_CREAM.bMax - SAKURA_COLORS.PETAL_CREAM.bMin)
          );
      } else {
        // Soft lavender (subtle variety)
        r =
          SAKURA_COLORS.PETAL_LAVENDER.r +
          Math.floor(Math.random() * SAKURA_COLORS.PETAL_LAVENDER.rRange);
        g =
          SAKURA_COLORS.PETAL_LAVENDER.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_LAVENDER.gMax -
                SAKURA_COLORS.PETAL_LAVENDER.gMin)
          );
        b = SAKURA_COLORS.PETAL_LAVENDER.b;
      }
    }

    return {
      x,
      y,
      size,
      vx,
      vy: baseVy,
      baseVy,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed,
      opacity: isFlower
        ? SAKURA_OPACITY.FLOWER.MIN +
          Math.random() * SAKURA_OPACITY.FLOWER.RANGE
        : SAKURA_OPACITY.PETAL.MIN + Math.random() * SAKURA_OPACITY.PETAL.RANGE,
      swayOffset,
      swayAmplitude,
      secondarySwayOffset,
      tumblePhase,
      tumbleSpeed,
      flutterIntensity,
      driftBias,
      color: { r, g, b },
      isFlower,
    };
  }

  /**
   * Get petal count based on quality level and viewport size
   */
  function getPetalCount(quality: QualityLevel): number {
    const counts = isMobile() ? SAKURA_COUNTS_MOBILE : SAKURA_COUNTS;
    switch (quality) {
      case "high":
        return counts.high;
      case "medium":
        return counts.medium;
      case "low":
        return counts.low;
      default:
        return counts.medium;
    }
  }

  /**
   * Create a single sakura petal or flower
   */
  function createPetal(
    dimensions: Dimensions,
    randomizeY: boolean = false
  ): SakuraPetal {
    const x = Math.random() * dimensions.width;
    const y = randomizeY
      ? Math.random() * dimensions.height
      : -SAKURA_BOUNDS.RESPAWN_BUFFER;

    // 30% chance of being a full flower, 70% single petal
    const isFlower = Math.random() < SAKURA_DISTRIBUTION.FLOWER_PROBABILITY;

    // Size variation - flowers are larger
    const size = isFlower
      ? SAKURA_SIZE.FLOWER.MIN + Math.random() * SAKURA_SIZE.FLOWER.RANGE
      : SAKURA_SIZE.PETAL.MIN + Math.random() * SAKURA_SIZE.PETAL.RANGE;

    // Base falling speed - slower for larger items (parallax effect)
    const baseVy =
      (SAKURA_PHYSICS.FALLING_SPEED_BASE +
        Math.random() * SAKURA_PHYSICS.FALLING_SPEED_RANGE) *
      (1 / (size / 4));

    // Initial horizontal drift with bias
    const driftBias =
      (Math.random() - 0.5) * 2 * SAKURA_PHYSICS.DRIFT_BIAS_RANGE;
    const vx =
      (Math.random() - 0.5) * SAKURA_PHYSICS.DRIFT_AMPLITUDE + driftBias;

    // Rotation properties - flowers rotate slower
    const rotationSpeed = isFlower
      ? (Math.random() - SAKURA_ROTATION.RANDOMNESS) *
        SAKURA_ROTATION.FLOWER_SPEED
      : (Math.random() - SAKURA_ROTATION.RANDOMNESS) *
        SAKURA_ROTATION.PETAL_SPEED;

    // Sway properties - primary oscillation
    const swayAmplitude =
      SAKURA_PHYSICS.SWAY_AMPLITUDE_MIN +
      Math.random() * SAKURA_PHYSICS.SWAY_AMPLITUDE_RANGE;
    const swayOffset = Math.random() * Math.PI * 2;

    // Secondary sway - different phase for complexity
    const secondarySwayOffset = Math.random() * Math.PI * 2;

    // Tumble properties - controls fall speed variation
    const tumblePhase = Math.random() * Math.PI * 2;
    const tumbleSpeed =
      SAKURA_PHYSICS.TUMBLE_SPEED_MIN +
      Math.random() * SAKURA_PHYSICS.TUMBLE_SPEED_RANGE;

    // Flutter intensity - petals flutter more than flowers
    const flutterIntensity = isFlower
      ? Math.random() * 0.3
      : 0.4 + Math.random() * 0.6;

    // Color variation - vibrant flowers, varied petals
    const colorVariant = Math.random();
    let r: number, g: number, b: number;

    if (isFlower) {
      // Flowers get vibrant, saturated colors
      if (colorVariant < SAKURA_COLORS.FLOWER_MAGENTA.probability) {
        r = SAKURA_COLORS.FLOWER_MAGENTA.r;
        g =
          SAKURA_COLORS.FLOWER_MAGENTA.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_MAGENTA.gMax -
                SAKURA_COLORS.FLOWER_MAGENTA.gMin)
          );
        b =
          SAKURA_COLORS.FLOWER_MAGENTA.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_MAGENTA.bMax -
                SAKURA_COLORS.FLOWER_MAGENTA.bMin)
          );
      } else if (colorVariant < SAKURA_COLORS.FLOWER_PINK.probability) {
        r = SAKURA_COLORS.FLOWER_PINK.r;
        g =
          SAKURA_COLORS.FLOWER_PINK.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_PINK.gMax - SAKURA_COLORS.FLOWER_PINK.gMin)
          );
        b =
          SAKURA_COLORS.FLOWER_PINK.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_PINK.bMax - SAKURA_COLORS.FLOWER_PINK.bMin)
          );
      } else {
        r = SAKURA_COLORS.FLOWER_BLUSH.r;
        g =
          SAKURA_COLORS.FLOWER_BLUSH.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_BLUSH.gMax -
                SAKURA_COLORS.FLOWER_BLUSH.gMin)
          );
        b =
          SAKURA_COLORS.FLOWER_BLUSH.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.FLOWER_BLUSH.bMax -
                SAKURA_COLORS.FLOWER_BLUSH.bMin)
          );
      }
    } else {
      // Petals get a mix of deep and soft colors
      if (colorVariant < SAKURA_COLORS.PETAL_ROSE.probability) {
        r = SAKURA_COLORS.PETAL_ROSE.r;
        g =
          SAKURA_COLORS.PETAL_ROSE.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_ROSE.gMax - SAKURA_COLORS.PETAL_ROSE.gMin)
          );
        b =
          SAKURA_COLORS.PETAL_ROSE.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_ROSE.bMax - SAKURA_COLORS.PETAL_ROSE.bMin)
          );
      } else if (colorVariant < SAKURA_COLORS.PETAL_PINK.probability) {
        r = SAKURA_COLORS.PETAL_PINK.r;
        g =
          SAKURA_COLORS.PETAL_PINK.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_PINK.gMax - SAKURA_COLORS.PETAL_PINK.gMin)
          );
        b =
          SAKURA_COLORS.PETAL_PINK.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_PINK.bMax - SAKURA_COLORS.PETAL_PINK.bMin)
          );
      } else if (colorVariant < SAKURA_COLORS.PETAL_CREAM.probability) {
        r = SAKURA_COLORS.PETAL_CREAM.r;
        g =
          SAKURA_COLORS.PETAL_CREAM.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_CREAM.gMax - SAKURA_COLORS.PETAL_CREAM.gMin)
          );
        b =
          SAKURA_COLORS.PETAL_CREAM.bMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_CREAM.bMax - SAKURA_COLORS.PETAL_CREAM.bMin)
          );
      } else {
        r =
          SAKURA_COLORS.PETAL_LAVENDER.r +
          Math.floor(Math.random() * SAKURA_COLORS.PETAL_LAVENDER.rRange);
        g =
          SAKURA_COLORS.PETAL_LAVENDER.gMin +
          Math.floor(
            Math.random() *
              (SAKURA_COLORS.PETAL_LAVENDER.gMax -
                SAKURA_COLORS.PETAL_LAVENDER.gMin)
          );
        b = SAKURA_COLORS.PETAL_LAVENDER.b;
      }
    }

    return {
      x,
      y,
      size,
      vx,
      vy: baseVy,
      baseVy,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed,
      opacity: isFlower
        ? SAKURA_OPACITY.FLOWER.MIN +
          Math.random() * SAKURA_OPACITY.FLOWER.RANGE
        : SAKURA_OPACITY.PETAL.MIN + Math.random() * SAKURA_OPACITY.PETAL.RANGE,
      swayOffset,
      swayAmplitude,
      secondarySwayOffset,
      tumblePhase,
      tumbleSpeed,
      flutterIntensity,
      driftBias,
      color: { r, g, b },
      isFlower,
    };
  }

  /**
   * Update petal positions and properties with wind-driven physics
   * Wind force replaces rigid sine-wave sway for natural movement
   */
  function update(
    petals: SakuraPetal[],
    dimensions: Dimensions,
    frameMultiplier: number,
    windForce: number = 0
  ): SakuraPetal[] {
    // Use mobile physics if on mobile viewport
    const physics = isMobile() ? SAKURA_PHYSICS_MOBILE : SAKURA_PHYSICS;

    return petals.map((petal) => {
      // Update phase animations
      const newSwayOffset =
        petal.swayOffset + physics.SWAY_SPEED * frameMultiplier;
      const newSecondarySwayOffset =
        petal.secondarySwayOffset + physics.SECONDARY_SWAY_SPEED * frameMultiplier;
      const newTumblePhase =
        petal.tumblePhase + petal.tumbleSpeed * frameMultiplier;

      // Tumble factor (0-1): represents how "flat" the petal is to airflow
      // When tumbleFactor is high (near 1), petal is flat = more drag = slower fall
      // When tumbleFactor is low (near 0), petal is edge-on = less drag = faster fall
      const tumbleFactor = (Math.sin(newTumblePhase) + 1) / 2;

      // Calculate current fall speed based on tumble (tumble-drag coupling)
      // Flat petals (high tumbleFactor) fall slower, edge-on petals fall faster
      const dragModifier = 1 - tumbleFactor * physics.TUMBLE_DRAG_FACTOR;
      const currentVy = petal.baseVy * dragModifier;

      // === WIND-DRIVEN HORIZONTAL MOVEMENT ===
      // Apply wind force as acceleration (scaled by how "flat" the petal is)
      // Flat petals catch more wind
      const windCatchFactor = 0.5 + tumbleFactor * 0.5;
      let newVx = petal.vx + windForce * windCatchFactor * 0.08 * frameMultiplier;

      // Air resistance / damping (petals slow down when wind stops)
      newVx *= 0.992;

      // Subtle flutter - very small, just adds life (not the primary motion)
      const flutterPhase =
        newSwayOffset * (physics.FLUTTER_SPEED / physics.SWAY_SPEED);
      const flutter =
        Math.sin(flutterPhase) *
        physics.FLUTTER_AMPLITUDE *
        petal.flutterIntensity *
        tumbleFactor *
        0.3; // Reduced flutter intensity

      // Position update: velocity-based movement + tiny flutter
      let newX =
        petal.x + (newVx + petal.driftBias * 0.5 + flutter) * frameMultiplier;
      const newY = petal.y + currentVy * frameMultiplier;

      // Rotation varies with horizontal velocity - faster movement = more spin
      const velocityRotationBoost = Math.abs(newVx) * 0.02;
      const rotationModifier = 1 + tumbleFactor * physics.ROTATION_TUMBLE_FACTOR + velocityRotationBoost;
      const newRotation =
        petal.rotation +
        petal.rotationSpeed * rotationModifier * frameMultiplier;

      // Respawn if petal has fallen below the viewport
      if (newY > dimensions.height + SAKURA_BOUNDS.RESPAWN_BUFFER) {
        return createPetal(dimensions, false);
      }

      // Wrap horizontally
      if (newX < -SAKURA_BOUNDS.RESPAWN_BUFFER) {
        newX = dimensions.width + SAKURA_BOUNDS.RESPAWN_BUFFER;
      } else if (newX > dimensions.width + SAKURA_BOUNDS.RESPAWN_BUFFER) {
        newX = -SAKURA_BOUNDS.RESPAWN_BUFFER;
      }

      return {
        ...petal,
        x: newX,
        y: newY,
        vx: newVx,
        vy: currentVy,
        rotation: newRotation,
        swayOffset: newSwayOffset,
        secondarySwayOffset: newSecondarySwayOffset,
        tumblePhase: newTumblePhase,
      };
    });
  }

  /**
   * Draw petals and flowers with soft edges
   */
  function draw(
    petals: SakuraPetal[],
    ctx: CanvasRenderingContext2D,
    _dimensions: Dimensions
  ): void {
    petals.forEach((petal) => {
      const { x, y, size, rotation, opacity, color, isFlower } = petal;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      if (isFlower) {
        // Draw glow effect behind flower
        const glowRadius = size * SAKURA_FLOWER.GLOW.RADIUS;
        const glowGradient = ctx.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          glowRadius
        );
        glowGradient.addColorStop(
          0,
          `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * SAKURA_FLOWER.GLOW.INNER_OPACITY})`
        );
        glowGradient.addColorStop(
          0.4,
          `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * SAKURA_FLOWER.GLOW.OPACITY})`
        );
        glowGradient.addColorStop(
          1,
          `rgba(${color.r}, ${color.g}, ${color.b}, 0)`
        );
        ctx.fillStyle = glowGradient;
        ctx.fillRect(-glowRadius, -glowRadius, glowRadius * 2, glowRadius * 2);

        // Draw a full cherry blossom flower (5 petals)
        for (let i = 0; i < SAKURA_FLOWER.PETAL_COUNT; i++) {
          const angle = (i * Math.PI * 2) / SAKURA_FLOWER.PETAL_COUNT;
          ctx.save();
          ctx.rotate(angle);

          // Petal gradient
          const gradient = ctx.createRadialGradient(
            0,
            size * SAKURA_FLOWER.CURVE.WIDTH_FACTOR,
            0,
            0,
            size * SAKURA_FLOWER.CURVE.WIDTH_FACTOR,
            size * 0.6
          );
          gradient.addColorStop(
            SAKURA_FLOWER.GRADIENT_INNER,
            `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`
          );
          gradient.addColorStop(
            SAKURA_FLOWER.GRADIENT_MID,
            `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * SAKURA_FLOWER.MID_OPACITY})`
          );
          gradient.addColorStop(
            SAKURA_FLOWER.GRADIENT_OUTER,
            `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * SAKURA_FLOWER.OUTER_OPACITY})`
          );

          ctx.fillStyle = gradient;
          ctx.beginPath();
          // Heart-shaped petal
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(
            size * SAKURA_FLOWER.CURVE.WIDTH_FACTOR,
            size * SAKURA_FLOWER.CURVE.TOP_Y,
            size * SAKURA_FLOWER.CURVE.WIDTH_FACTOR,
            size * SAKURA_FLOWER.CURVE.MID_Y
          );
          ctx.quadraticCurveTo(
            size * SAKURA_FLOWER.CURVE.WIDTH_FACTOR,
            size * SAKURA_FLOWER.CURVE.BOTTOM_Y,
            0,
            size * SAKURA_FLOWER.CURVE.END_Y
          );
          ctx.quadraticCurveTo(
            -size * SAKURA_FLOWER.CURVE.WIDTH_FACTOR,
            size * SAKURA_FLOWER.CURVE.BOTTOM_Y,
            -size * SAKURA_FLOWER.CURVE.WIDTH_FACTOR,
            size * SAKURA_FLOWER.CURVE.MID_Y
          );
          ctx.quadraticCurveTo(
            -size * SAKURA_FLOWER.CURVE.WIDTH_FACTOR,
            size * SAKURA_FLOWER.CURVE.TOP_Y,
            0,
            0
          );
          ctx.fill();

          ctx.restore();
        }

        // Draw yellow center
        const centerGradient = ctx.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          size * SAKURA_FLOWER.CENTER.RADIUS_MULTIPLIER
        );
        centerGradient.addColorStop(
          0,
          `rgba(${SAKURA_FLOWER.CENTER.COLOR.r}, ${SAKURA_FLOWER.CENTER.COLOR.g}, ${SAKURA_FLOWER.CENTER.COLOR.b}, ${opacity})`
        );
        centerGradient.addColorStop(
          1,
          `rgba(${SAKURA_FLOWER.CENTER.OUTER_COLOR.r}, ${SAKURA_FLOWER.CENTER.OUTER_COLOR.g}, ${SAKURA_FLOWER.CENTER.OUTER_COLOR.b}, ${opacity * SAKURA_FLOWER.CENTER.OUTER_OPACITY})`
        );
        ctx.fillStyle = centerGradient;
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          size * SAKURA_FLOWER.CENTER.RADIUS_MULTIPLIER,
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else {
        // Draw single petal
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        gradient.addColorStop(
          SAKURA_PETAL.GRADIENT.INNER,
          `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`
        );
        gradient.addColorStop(
          SAKURA_PETAL.GRADIENT.MID,
          `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * SAKURA_PETAL.OPACITY.MID})`
        );
        gradient.addColorStop(
          SAKURA_PETAL.GRADIENT.OUTER,
          `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * SAKURA_PETAL.OPACITY.OUTER})`
        );

        ctx.fillStyle = gradient;
        ctx.beginPath();

        // Draw stylized petal shape (two overlapping ellipses)
        ctx.ellipse(
          0,
          0,
          size * SAKURA_PETAL.ELLIPSE.PRIMARY.width,
          size * SAKURA_PETAL.ELLIPSE.PRIMARY.height,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          size * SAKURA_PETAL.ELLIPSE.SECONDARY.width,
          size * SAKURA_PETAL.ELLIPSE.SECONDARY.height,
          SAKURA_PETAL.ELLIPSE.SECONDARY.rotation,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      ctx.restore();
    });
  }

  /**
   * Adjust petals when viewport resizes
   * Handles edge cases like zero dimensions gracefully
   */
  function adjustToResize(
    petals: SakuraPetal[],
    oldDimensions: Dimensions,
    newDimensions: Dimensions,
    quality: QualityLevel
  ): SakuraPetal[] {
    const targetCount = getPetalCount(quality);

    // Safety check: if old dimensions are invalid, reinitialize completely
    if (oldDimensions.width <= 0 || oldDimensions.height <= 0) {
      return initialize(newDimensions, quality);
    }

    // Safety check: if new dimensions are invalid, keep existing petals
    if (newDimensions.width <= 0 || newDimensions.height <= 0) {
      return petals;
    }

    const scaleX = newDimensions.width / oldDimensions.width;
    const scaleY = newDimensions.height / oldDimensions.height;

    // Safety check: if scale is unreasonable (>10x change), reinitialize
    if (scaleX > 10 || scaleX < 0.1 || scaleY > 10 || scaleY < 0.1 ||
        !isFinite(scaleX) || !isFinite(scaleY)) {
      return initialize(newDimensions, quality);
    }

    // Scale existing petals and clamp to valid range
    const adjusted = petals.map((petal) => {
      const newX = petal.x * scaleX;
      const newY = petal.y * scaleY;

      // Clamp positions to valid viewport range (with buffer)
      const clampedX = Math.max(-SAKURA_BOUNDS.RESPAWN_BUFFER,
                        Math.min(newDimensions.width + SAKURA_BOUNDS.RESPAWN_BUFFER, newX));
      const clampedY = Math.max(-SAKURA_BOUNDS.RESPAWN_BUFFER,
                        Math.min(newDimensions.height + SAKURA_BOUNDS.RESPAWN_BUFFER, newY));

      return {
        ...petal,
        x: clampedX,
        y: clampedY,
        // Reset velocity on resize to prevent weird momentum
        vx: petal.vx * 0.5,
      };
    });

    // Add or remove petals to match target count
    while (adjusted.length < targetCount) {
      adjusted.push(createPetal(newDimensions, true));
    }
    while (adjusted.length > targetCount) {
      adjusted.pop();
    }

    return adjusted;
  }

  /**
   * Update quality level
   */
  function setQuality(
    petals: SakuraPetal[],
    dimensions: Dimensions,
    quality: QualityLevel
  ): SakuraPetal[] {
    const targetCount = getPetalCount(quality);

    if (petals.length < targetCount) {
      // Add more petals
      const toAdd = targetCount - petals.length;
      for (let i = 0; i < toAdd; i++) {
        petals.push(createPetal(dimensions, true));
      }
    } else if (petals.length > targetCount) {
      // Remove excess petals
      petals = petals.slice(0, targetCount);
    }

    return petals;
  }

  return {
    initialize,
    update,
    draw,
    adjustToResize,
    setQuality,
  };
}
