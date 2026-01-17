import type { Dimensions } from "../../shared/domain/types/background-types";
import { SnowfallConfig } from "../../shared/domain/constants/BackgroundConfigs";
import type { Snowflake } from "../domain/models/snowfall-models";

export const createSnowflakeSystem = () => {
  const config = SnowfallConfig;
  let windStrength = 0;
  let windChangeTimer = 0;

  const generateSnowflakeShape = (size: number): Path2D => {
    const path = new Path2D();
    const branches = 6; // Classic 6-pointed snowflake
    const complexity = Math.random() > 0.2 ? 2 : 1; // 80% chance of detailed snowflakes (was 50%)

    // Use consistent length for all branches of this snowflake (determined once per snowflake)
    const branchLength = size * (0.8 + Math.random() * 0.4);

    for (let i = 0; i < branches; i++) {
      const angle = (i * Math.PI * 2) / branches;

      // Main branch - all branches use the same length for perfect symmetry
      const endX = Math.cos(angle) * branchLength;
      const endY = Math.sin(angle) * branchLength;

      path.moveTo(0, 0);
      path.lineTo(endX, endY);

      // Add delicate side branches for more complex snowflakes
      if (complexity > 1) {
        for (let j = 1; j <= 2; j++) {
          const branchPos = j / 3;
          const branchX = Math.cos(angle) * branchLength * branchPos;
          const branchY = Math.sin(angle) * branchLength * branchPos;

          // Left side branch - consistent length for symmetry
          const leftAngle = angle - Math.PI / 4;
          const leftLength = size * 0.3 * (1 - branchPos);
          path.moveTo(branchX, branchY);
          path.lineTo(
            branchX + Math.cos(leftAngle) * leftLength,
            branchY + Math.sin(leftAngle) * leftLength
          );

          // Right side branch - consistent length for symmetry
          const rightAngle = angle + Math.PI / 4;
          path.moveTo(branchX, branchY);
          path.lineTo(
            branchX + Math.cos(rightAngle) * leftLength,
            branchY + Math.sin(rightAngle) * leftLength
          );
        }
      }
    }

    return path;
  };

  const randomSnowflakeColor = (): string => {
    const colors = config.snowflake.colors;
    if (!colors.length) return "#FFFFFF";
    return colors[Math.floor(Math.random() * colors.length)] ?? "#FFFFFF";
  };

  const createSnowflake = (width: number, height: number): Snowflake => {
    const size =
      Math.random() * (config.snowflake.maxSize - config.snowflake.minSize) +
      config.snowflake.minSize;
    const depth = Math.random(); // Depth for layering effects

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      speed:
        (Math.random() *
          (config.snowflake.maxSpeed - config.snowflake.minSpeed) +
          config.snowflake.minSpeed) *
        (0.5 + depth * 0.5), // Vary speed by depth
      size: size * (0.4 + depth * 0.6), // Smaller flakes appear further away
      sway: (Math.random() * 1 - 0.5) * (1 + depth),
      opacity: (Math.random() * 0.6 + 0.3) * (0.6 + depth * 0.4),
      shape: generateSnowflakeShape(size),
      color: randomSnowflakeColor(),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02, // Gentle rotation
      sparkle: Math.random() > 0.7 ? Math.random() : 0, // Only some sparkle
      sparklePhase: Math.random() * Math.PI * 2,
      depth,
    };
  };

  const initialize = (
    { width, height }: Dimensions,
    quality: string
  ): Snowflake[] => {
    let adjustedDensity = config.snowflake.density;

    const screenArea = width * height;
    const desktopArea = 1920 * 1080;
    const screenSizeFactor = Math.min(1, screenArea / desktopArea);
    adjustedDensity *= screenSizeFactor;

    // Mobile boost: smaller screens get higher per-pixel density
    // so the scene doesn't look empty on phones
    const isMobile = width < 768;
    if (isMobile) {
      // Boost mobile density by 2.5x to compensate for smaller viewport
      adjustedDensity *= 2.5;
    }

    // Apply quality density adjustments
    if (quality === "low") {
      adjustedDensity *= 0.5;
    } else if (quality === "medium") {
      adjustedDensity *= 0.75;
    }

    const count = Math.floor(width * height * adjustedDensity);
    const flakes = Array.from({ length: count }, () => createSnowflake(width, height));

    // Pre-sort by depth at initialization (depth never changes)
    // This avoids sorting every frame in draw()
    flakes.sort((a, b) => a.depth - b.depth);

    return flakes;
  };

  const update = (
    flakes: Snowflake[],
    { width, height }: Dimensions,
    frameMultiplier: number = 1.0
  ): Snowflake[] => {
    windChangeTimer += frameMultiplier;
    if (windChangeTimer >= config.snowflake.windChangeInterval) {
      windChangeTimer = 0;
      // Very gentle wind - much softer movement
      windStrength = (Math.random() * 0.08 - 0.04) * width * 0.000008;
    }

    return flakes.map((flake) => {
      // Enhanced movement with gentle curves
      const swayOffset = Math.sin(flake.y * 0.01 + flake.sparklePhase) * 0.5;
      const newX =
        flake.x + (flake.sway + windStrength + swayOffset) * frameMultiplier;
      const newY = flake.y + flake.speed * frameMultiplier;

      // Update rotation for gentle spinning
      const newRotation =
        flake.rotation + flake.rotationSpeed * frameMultiplier;

      // Update sparkle animation
      const newSparklePhase = flake.sparklePhase + 0.05 * frameMultiplier;

      if (newY > height) {
        return {
          ...flake,
          y: Math.random() * -20 - 10,
          x: Math.random() * width,
          rotation: newRotation,
          sparklePhase: newSparklePhase,
        };
      }

      // Allow flakes to drift off-screen before recycling (buffer zone)
      const buffer = 50;
      if (newX > width + buffer) {
        // Drifted off right edge - reappear from left
        return {
          ...flake,
          x: -buffer + Math.random() * 10,
          rotation: newRotation,
          sparklePhase: newSparklePhase,
        };
      }
      if (newX < -buffer) {
        // Drifted off left edge - reappear from right
        return {
          ...flake,
          x: width + buffer - Math.random() * 10,
          rotation: newRotation,
          sparklePhase: newSparklePhase,
        };
      }

      return {
        ...flake,
        x: newX,
        y: newY,
        rotation: newRotation,
        sparklePhase: newSparklePhase,
      };
    });
  };

  const draw = (
    flakes: Snowflake[],
    ctx: CanvasRenderingContext2D,
    _dimensions: Dimensions
  ): void => {
    if (!ctx) return;

    // Flakes are pre-sorted by depth at initialization (depth never changes)
    // so we can iterate directly without sorting each frame
    flakes.forEach((flake) => {
      ctx.save();
      ctx.translate(flake.x, flake.y);
      ctx.rotate(flake.rotation);

      // Simple depth-based opacity (no sparkle - it caused visibility glitches)
      const depthFactor = 0.3 + flake.depth * 0.7;
      ctx.globalAlpha = flake.opacity * depthFactor;

      // Single stroke pass - no shadowBlur, no fills, no multi-pass rendering
      ctx.strokeStyle = flake.color;
      ctx.lineWidth = 0.4 + depthFactor * 0.5;
      ctx.stroke(flake.shape);

      ctx.restore();
    });
  };

  const adjustToResize = (
    flakes: Snowflake[],
    _oldDimensions: Dimensions,
    newDimensions: Dimensions,
    quality: string
  ): Snowflake[] => {
    const densityMultiplier =
      quality === "low" ? 0.4 : quality === "medium" ? 0.7 : 1;

    // Apply same mobile boost as initialize()
    const isMobile = newDimensions.width < 768;
    const mobileBoost = isMobile ? 2.5 : 1;

    const targetCount = Math.floor(
      newDimensions.width *
        newDimensions.height *
        config.snowflake.density *
        densityMultiplier *
        mobileBoost
    );

    const currentCount = flakes.length;

    if (targetCount > currentCount) {
      return [
        ...flakes,
        ...Array.from({ length: targetCount - currentCount }, () =>
          createSnowflake(newDimensions.width, newDimensions.height)
        ),
      ];
    } else if (targetCount < currentCount) {
      return flakes.slice(0, targetCount);
    }

    return flakes;
  };

  const setQuality = (_quality: string): void => {
    // future: adjust density dynamically
  };

  return {
    initialize,
    update,
    draw,
    adjustToResize,
    setQuality,
  };
};
