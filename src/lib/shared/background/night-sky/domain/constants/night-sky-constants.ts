// Night Sky Configuration Constants

// ============================================================================
// NIGHT SKY CONFIGURATION CONSTANTS
// ============================================================================

export const NightSkyConfig = {
  stars: {
    count: 200,
    // Internet consensus: Tight size range (1-3px) with opacity for depth
    minSize: 1,
    maxSize: 3,
    colors: ["#ffffff", "#f0f8ff", "#e6f3ff", "#ddeeff", "#ffff99"],
    twinkleSpeed: 0.02,
    parallaxLayers: 3,
    // Graduated opacity for modern depth perception (2025 standard)
    baseOpacityMin: 0.4,
    baseOpacityMax: 1.0,
    minTwinkleSpeed: 0.01,
    maxTwinkleSpeed: 0.05,
    twinkleChance: 0.7,
  },
  parallax: {
    // 3-Layer Classic (Internet Consensus 2023-2025)
    // Far layer: 70% of stars, 1px, 0.4 opacity, slowest animation
    far: {
      density: 0.00014, // 70% of total stars (increased from 0.00008)
      drift: 0.00002, // Slowest drift
      sizeMultiplier: 1.0, // 1px stars
      opacityMultiplier: 0.4, // Dimmest
      sparkleChance: 0.0, // No sparkles on distant stars
    },
    // Mid layer: 20% of stars, 2px, 0.6 opacity, medium animation
    mid: {
      density: 0.00004, // 20% of total stars (reduced from 0.00006)
      drift: 0.00004, // Medium drift
      sizeMultiplier: 2.0, // 2px stars
      opacityMultiplier: 0.6, // Medium brightness
      sparkleChance: 0.05, // 5% sparkles (internet consensus)
    },
    // Near layer: 10% of stars, 3px, 0.8 opacity, slowest animation (heavier feel)
    near: {
      density: 0.00002, // 10% of total stars (reduced from 0.00004)
      drift: 0.00006, // Fastest drift (but slower animation = heavier)
      sizeMultiplier: 3.0, // 3px stars (largest)
      opacityMultiplier: 0.8, // Brightest
      sparkleChance: 0.05, // 5% sparkles (only on brightest stars)
    },
  },
  nebula: {
    // Core dimensions
    count: 3,
    minRadius: 100,
    maxRadius: 200,
    // Structure complexity
    controlPointCount: 8, // Points defining irregular shape
    embeddedStarCount: 4, // Bright spots within cloud
    filamentCount: 3, // Wispy extensions
    // Emission nebula color palettes (pink/purple/blue like real nebulae)
    colorPalettes: [
      {
        primary: "rgba(255, 100, 180, 0.08)", // Pink (Orion-like)
        secondary: "rgba(180, 80, 255, 0.06)", // Purple
        accent: "rgba(100, 180, 255, 0.04)", // Blue edge
      },
      {
        primary: "rgba(100, 150, 255, 0.08)", // Blue (reflection nebula)
        secondary: "rgba(150, 100, 255, 0.06)", // Violet
        accent: "rgba(200, 150, 255, 0.04)", // Lavender edge
      },
      {
        primary: "rgba(255, 150, 100, 0.07)", // Orange/salmon (emission)
        secondary: "rgba(255, 100, 150, 0.05)", // Pink
        accent: "rgba(255, 200, 150, 0.03)", // Warm edge
      },
    ],
    // Animation speeds
    glowPulseSpeed: 0.0008, // Slow breathing
    shimmerSpeed: 0.0004, // Traveling highlight
    colorShiftSpeed: 0.0002, // Very slow hue shift
    filamentWaveSpeed: 0.0006, // Filament gentle wave
    // Appearance
    baseOpacity: 0.12, // Subtle, not overpowering
    // Quality gating
    enabledOnQuality: ["high", "medium"] as (
      | "high"
      | "medium"
      | "low"
      | "minimal"
    )[],
    // Quality-specific settings
    quality: {
      high: {
        filaments: true,
        embeddedStars: true,
        shimmer: true,
        colorShift: true,
      },
      medium: {
        filaments: false,
        embeddedStars: true,
        shimmer: false,
        colorShift: false,
      },
    },
  },
  constellations: {
    maxLines: 5, // Subtle - just a few constellation lines
    opacity: 0.3, // More subtle opacity
    twinkleSpeed: 0.003, // Much slower - gentle, calm twinkling
    enabledOnQuality: ["high", "medium"] as (
      | "high"
      | "medium"
      | "low"
      | "minimal"
    )[],
  },
  Moon: {
    radiusPercent: 0.04,
    maxRadiusPx: 60,
    color: "#f5f5dc",
    position: {
      x: 0.8,
      y: 0.2,
    },
    driftSpeed: 0.00001,
    enabledOnQuality: ["high", "medium", "low"] as (
      | "high"
      | "medium"
      | "low"
      | "minimal"
    )[],
  },
  celestialBodies: {
    moon: {
      size: 60,
      color: "#f5f5dc",
      glowRadius: 20,
      enabled: true,
    },
    planets: {
      count: 2,
      minSize: 3,
      maxSize: 8,
      colors: ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4"],
    },
  },
  shootingStars: {
    frequency: 0.001,
    minSpeed: 2,
    maxSpeed: 5,
    colors: ["#ffffff", "#ffff99", "#99ccff", "#ffcc99"],
    tailLength: 15,
  },
  spaceship: {
    size: 12,
    speed: 1.5,
    color: "#silver",
    blinkInterval: 2000,
    enabled: false, // Easter egg
    speedPercent: 0.001,
    enabledOnQuality: ["high"] as ("high" | "medium" | "low" | "minimal")[],
  },
  comet: {
    size: 8,
    speed: 0.8,
    tailLength: 30,
    color: "#87ceeb",
    enabled: false, // Easter egg
    interval: 45000,
    enabledOnQuality: ["high"] as ("high" | "medium" | "low" | "minimal")[],
  },
  milkyWay: {
    // Band dimensions
    bandWidthPercent: 0.15, // Width as fraction of screen diagonal
    pathPoints: 50, // Control points for smooth curve (was 5, caused blocky segments)
    // Internal structure
    dustLaneCount: 4, // Dark regions within the band
    starCloudCount: 6, // Bright clusters within the band
    // Appearance
    baseOpacity: 0.12, // Subtle, not overpowering
    coreOpacity: 0.2, // Brighter center
    edgeOpacity: 0.04, // Soft fade at edges
    // Colors - cool blues to warm center
    colors: {
      edge: "rgba(180, 200, 255, 1)", // Cool blue edge
      mid: "rgba(220, 210, 240, 1)", // Lavender mid
      core: "rgba(255, 240, 220, 1)", // Warm cream core
    },
    // Animation speeds
    shimmerSpeed: 0.0003, // Very slow traveling wave
    glowPulseSpeed: 0.0008, // Subtle breathing
    dustLaneDriftSpeed: 0.0001, // Almost imperceptible movement
    starCloudPulseSpeed: 0.002, // Individual cluster pulsing
    // Quality gating
    enabledOnQuality: ["high", "medium"] as (
      | "high"
      | "medium"
      | "low"
      | "minimal"
    )[],
    // Quality-specific settings
    quality: {
      high: {
        dustLanes: true,
        starClouds: true,
        shimmer: true,
        edgeDetail: true,
      },
      medium: {
        dustLanes: false,
        starClouds: true,
        shimmer: false,
        edgeDetail: false,
      },
    },
  },
  background: {
    gradientStops: [
      { position: 0, color: "#0a0a1a" }, // Deep space black
      { position: 0.2, color: "#0f0f24" }, // Dark midnight
      { position: 0.4, color: "#1a1a2e" }, // Rich indigo
      { position: 0.6, color: "#16213e" }, // Deep blue
      { position: 0.8, color: "#0f3460" }, // Ocean blue
      { position: 1, color: "#0a1e3d" }, // Deepest night
    ],
  },
  animation: {
    starDriftSpeed: 0.1,
    MoonDriftSpeed: 0.05,
    parallaxMultiplier: 0.3,
  },
};

export type NightSkyConfigType = typeof NightSkyConfig;
