import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import { injectable } from "inversify";
import type {
  StarConfig,
  Star,
  MoonIllumination,
} from "../../domain/models/night-sky-models";
import type { INightSkyCalculationService } from "../contracts/INightSkyCalculationService";

// Lunar cycle constants
const SYNODIC_MONTH_DAYS = 29.53058868; // Average lunar cycle in days
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_LUNAR_CYCLE = SYNODIC_MONTH_DAYS * MS_PER_DAY;

// Reference new moon (known astronomical event)
const REFERENCE_NEW_MOON = new Date("2024-01-11T11:57:00Z").getTime();

@injectable()
export class NightSkyCalculationService implements INightSkyCalculationService {
  private observerLatitude = 40; // Default: NYC area (northern hemisphere)

  /**
   * Generate a random float between min and max
   */
  randFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Generate a random integer between min and max (inclusive)
   */
  randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Pick a random item from an array
   */
  randItem<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("randItem called with empty array");
    const item = arr[Math.floor(Math.random() * arr.length)];
    if (item === undefined) throw new Error("randItem returned undefined");
    return item;
  }

  /**
   * Create a star with randomized properties
   */
  makeStar(
    dimensions: Dimensions,
    config: StarConfig,
    accessibility: AccessibilitySettings
  ): Star {
    const r =
      this.randFloat(config.minSize, config.maxSize) *
      ((accessibility.visibleParticleSize ?? 1) > 2 ? 1.5 : 1);
    const tw = Math.random() < config.twinkleChance;

    // 30% of larger stars get the classic 4-pointed sparkle shape
    const isSparkle = r > 1.5 && Math.random() < 0.3;

    // Initialize atmospheric scintillation phases (4 frequency layers)
    // Real scintillation comes from turbulent air cells of varying sizes
    // causing rapid, irregular brightness fluctuations
    const scintillationPhases = [
      Math.random() * Math.PI * 2, // Low frequency (large air cells)
      Math.random() * Math.PI * 2, // Medium-low frequency
      Math.random() * Math.PI * 2, // Medium-high frequency
      Math.random() * Math.PI * 2, // High frequency (small air cells)
    ];

    // Scintillation intensity varies by star:
    // - Brighter stars scintillate more visibly
    // - Random variation for natural look
    const baseOpacity = this.randFloat(
      config.baseOpacityMin,
      config.baseOpacityMax
    );
    const scintillationIntensity = baseOpacity * (0.5 + Math.random() * 0.5);

    return {
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      radius: r,
      baseOpacity,
      currentOpacity: 1,
      twinkleSpeed: tw
        ? this.randFloat(config.minTwinkleSpeed, config.maxTwinkleSpeed)
        : 0,
      twinklePhase: Math.random() * Math.PI * 2,
      isTwinkling: tw,
      color: accessibility.highContrast
        ? "#FFFFFF"
        : this.randItem(config.colors),
      isSparkle,
      scintillationPhases,
      scintillationIntensity,
    };
  }

  setObserverLatitude(latitude: number): void {
    this.observerLatitude = Math.max(-90, Math.min(90, latitude));
  }

  getObserverLatitude(): number {
    return this.observerLatitude;
  }

  /**
   * Calculate comprehensive moon illumination data.
   *
   * This provides:
   * - Accurate phase position in the lunar cycle
   * - Illumination fraction
   * - Waxing/waning state
   * - Parallactic angle (orientation based on observer's latitude)
   * - Earthshine intensity (visible during crescent phases)
   */
  getMoonIllumination(date: Date, latitude?: number): MoonIllumination {
    const lat = latitude ?? this.observerLatitude;
    const currentTime = date.getTime();

    // Calculate position in lunar cycle (0 to 1)
    const timeSinceNewMoon = currentTime - REFERENCE_NEW_MOON;
    const cyclePosition =
      (((timeSinceNewMoon / MS_PER_LUNAR_CYCLE) % 1) + 1) % 1;

    // Determine waxing (0-0.5) or waning (0.5-1)
    const isWaxing = cyclePosition < 0.5;

    // Calculate illuminated fraction
    // Uses cosine for smooth transition: 0 at new moon, 1 at full moon
    const phaseAngle = cyclePosition * 2 * Math.PI;
    const fraction = (1 - Math.cos(phaseAngle)) / 2;

    // Calculate the angle of the bright limb
    // This determines which side of the moon is lit
    let angle = 0;
    if (isWaxing) {
      // Waxing: lit on the right in northern hemisphere
      angle = Math.PI / 2; // 90 degrees
    } else {
      // Waning: lit on the left in northern hemisphere
      angle = -Math.PI / 2; // -90 degrees
    }

    // Calculate parallactic angle based on latitude
    // This rotates the moon's orientation:
    // - Northern hemisphere: standard orientation
    // - Southern hemisphere: rotated 180 degrees
    // - Near equator: can appear tilted like a "Cheshire Cat smile"
    const parallacticAngle = this.calculateParallacticAngle(lat, date);

    // Calculate earthshine intensity
    // Earthshine is most visible during crescent phases (when moon is mostly dark)
    // Earth reflects sunlight onto the dark portion of the moon
    const earthshineIntensity = this.calculateEarthshineIntensity(fraction);

    return {
      fraction,
      phaseValue: cyclePosition,
      angle,
      parallacticAngle,
      isWaxing,
      earthshineIntensity,
    };
  }

  /**
   * Calculate parallactic angle - the rotation of the moon based on observer's position.
   *
   * This is a simplified calculation that captures the main effect:
   * - Northern latitudes see the moon oriented one way
   * - Southern latitudes see it "upside down"
   * - Near equator, the moon appears tilted
   */
  private calculateParallacticAngle(latitude: number, date: Date): number {
    // Get hour of day for moon's position in sky
    const hour = date.getHours() + date.getMinutes() / 60;

    // Moon's hour angle (simplified - assumes moon rises at 6pm, sets at 6am-ish)
    // This affects how much the moon appears tilted
    const hourAngle = ((hour - 18) / 24) * 2 * Math.PI;

    // Latitude effect: southern hemisphere sees moon "upside down"
    // The parallactic angle depends on both latitude and hour angle
    const latRad = (latitude * Math.PI) / 180;

    // Simplified parallactic angle calculation
    // At equator (lat=0): moon can appear horizontal during rise/set
    // At poles: minimal rotation through the night
    // At mid-latitudes: moderate rotation
    const parallacticAngle = Math.atan2(
      Math.sin(hourAngle),
      Math.tan(latRad) * Math.cos(0.4) - Math.sin(0.4) * Math.cos(hourAngle) // 0.4 rad ≈ moon's declination
    );

    // For southern hemisphere, add 180 degrees to flip the moon
    if (latitude < 0) {
      return parallacticAngle + Math.PI;
    }

    return parallacticAngle;
  }

  /**
   * Calculate earthshine intensity.
   *
   * Earthshine is the faint glow on the dark side of the moon
   * caused by sunlight reflected off Earth. It's most visible
   * during crescent phases when:
   * 1. The dark portion of the moon is large (low illumination)
   * 2. Earth is showing its "full" face to the moon (reflecting max light)
   */
  private calculateEarthshineIntensity(illuminationFraction: number): number {
    // Earthshine is strongest during thin crescents
    // As the moon becomes more illuminated, earthshine becomes less visible
    // (both because there's less dark area and because the bright part drowns it out)

    if (illuminationFraction > 0.4) {
      // Beyond crescent phase, earthshine is imperceptible
      return 0;
    }

    // Peak earthshine at about 10-15% illumination
    // Drops off toward new moon (Earth showing less light) and toward quarter (bright side dominates)
    const peakAt = 0.12;
    const falloffRate = 0.15;

    const distanceFromPeak = Math.abs(illuminationFraction - peakAt);
    const intensity = Math.max(0, 1 - distanceFromPeak / falloffRate);

    // Scale to a subtle but visible level (max 0.15)
    return intensity * 0.15;
  }
}
