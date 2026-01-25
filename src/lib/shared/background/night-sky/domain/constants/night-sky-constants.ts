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
    // DISABLED: Will be reimagined as noise-based procedural system
    enabledOnQuality: [] as ("high" | "medium" | "low" | "minimal")[],
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
    // DISABLED: Random lines between stars look geometric/artificial
    // TODO: Reimagine with real constellation patterns or remove entirely
    enabledOnQuality: [] as ("high" | "medium" | "low" | "minimal")[],
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
  ufo: {
    // Appearance
    size: 28,
    colors: {
      hull: "#b8c4e0",
      hullDark: "#6878a0",
      dome: "rgba(200, 220, 255, 0.6)",
      domeHighlight: "rgba(255, 255, 255, 0.8)",
      shield: "rgba(100, 180, 255, 0.12)",
      beam: "#fbbf24",
      beamGlow: "rgba(251, 191, 36, 0.3)",
      lights: ["#ff6b6b", "#4ecdc4", "#ffe66d", "#95e1d3", "#a78bfa", "#f472b6"],
    },
    // Movement - curious browser, moves in gentle curves
    speed: 0.0006, // Gentle cruising speed
    bounceMargin: 0.1, // Stay 10% away from edges
    // Curved exploration - alien moves in gentle arcs, not straight lines
    turnSpeed: 0.003, // How fast it changes direction (creates curves)
    turnVariation: 0.5, // Random variation in turn rate
    // Timing (in frames at 60fps)
    interval: 36000, // ~10 minutes between automatic appearances
    enterDuration: 120, // 2 seconds fade in
    exitDuration: 90, // 1.5 second fade out
    minActiveDuration: 2400, // Stay at least 40 seconds
    maxActiveDuration: 4200, // Stay at most 70 seconds
    // Behavior - browser that occasionally pauses
    pauseChance: 0.004, // Pauses occasionally, not constantly
    pauseDuration: { min: 90, max: 180 }, // 1.5-3 seconds pause (brief looks around)
    // Movement style
    driftChance: 0.15, // Only 15% chance to drift lazily
    driftSpeedMultiplier: 0.4, // When drifting, still moves noticeably
    // Beam behavior (when paused) - curious scanning
    scanStarChance: 0.6, // 60% chance to scan nearby star
    groundScanChance: 0.25, // 25% chance to scan ground
    justVibeChance: 0.15, // 15% chance to just hover (reduced)
    scanDuration: { min: 90, max: 180 }, // 1.5-3 seconds scan
    beamChargeFrames: 25, // Moderate beam charge
    // Animation speeds
    shieldPulseSpeed: 0.012,
    lightChaseSpeed: 0.05,
    hoverBobSpeed: 0.015,
    hoverBobAmount: 4,
    // Mood system
    mood: {
      // Decay times (frames at 60fps) - how long until mood returns to curious
      excitedDecay: 360, // 6 seconds
      startledDecay: 180, // 3 seconds
      playfulDecay: 480, // 8 seconds
      boredThreshold: 300, // 5 seconds without interest → bored
      // Tiredness accumulation
      tirednessRate: 0.0002, // Accumulates per frame
      tiredThreshold: 0.6, // When tiredness > this, enters tired mood
      // Visual modifiers per mood
      moodVisuals: {
        curious: { lightSpeed: 1.0, bobDepth: 1.0, shieldBrightness: 1.0 },
        excited: { lightSpeed: 1.8, bobDepth: 0.7, shieldBrightness: 1.4 },
        bored: { lightSpeed: 0.5, bobDepth: 1.5, shieldBrightness: 0.7 },
        startled: { lightSpeed: 2.5, bobDepth: 0.5, shieldBrightness: 1.8 },
        playful: { lightSpeed: 1.5, bobDepth: 1.2, shieldBrightness: 1.2 },
        tired: { lightSpeed: 0.3, bobDepth: 2.0, shieldBrightness: 0.5 },
      },
    },
    // Quality gating
    enabledOnQuality: ["high", "medium"] as ("high" | "medium" | "low" | "minimal")[],
  },
  comet: {
    size: 8,
    speed: 0.8,
    tailLength: 30,
    color: "#87ceeb",
    // interval in frames: ~9000 frames at 60fps = ~2.5 minutes between comets
    interval: 9000,
    enabledOnQuality: ["high", "medium"] as ("high" | "medium" | "low" | "minimal")[],
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
    // DISABLED: Current segment-based approach shows visible banding
    // TODO: Reimagine as particle-based system
    enabledOnQuality: [] as ("high" | "medium" | "low" | "minimal")[],
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
