import type { IBackgroundRenderingService } from "../contracts/IBackgroundRenderingService";
import type { Dimensions } from "../../domain/types/background-types";
import type { GradientStop } from "../../domain/models/background-models";

export class BackgroundRenderingService implements IBackgroundRenderingService {
  drawGradient(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    gradientStops: readonly GradientStop[]
  ): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, dimensions.height);

    gradientStops.forEach((stop) => {
      // Ensure position is a valid number between 0 and 1
      const position = isFinite(stop.position)
        ? Math.max(0, Math.min(1, stop.position))
        : 0;
      gradient.addColorStop(position, stop.color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  calculateParticleCount(
    dimensions: Dimensions,
    baseDensity: number,
    quality: "high" | "medium" | "low"
  ): number {
    let adjustedDensity = baseDensity;

    const screenSizeFactor = Math.min(
      1,
      (dimensions.width * dimensions.height) / (1920 * 1080)
    );
    adjustedDensity *= screenSizeFactor;

    if (quality === "low") {
      adjustedDensity *= 0.5;
    } else if (quality === "medium") {
      adjustedDensity *= 0.75;
    }

    return Math.floor(dimensions.width * dimensions.height * adjustedDensity);
  }

  shouldEnableSeasonalFeatures(): boolean {
    const date = new Date();
    const month = date.getMonth();
    const day = date.getDate();

    return month === 11 || (month === 0 && day <= 7);
  }
}
