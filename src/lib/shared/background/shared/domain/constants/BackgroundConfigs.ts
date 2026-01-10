// Background Configuration Constants

/**
 * Snowfall configuration object
 */
export const SnowfallConfig = {
  snowflake: {
    colors: [
      "#ffffff", // Pure crystalline white
      "#f8faff", // Soft cloud white
      "#e8f4f8", // Icy blue-white
      "#e6f2ff", // Gentle sky blue
      "#f0f8ff", // Alice blue
      "#dde7ff", // Soft periwinkle
      "#e8e8ff", // Lavender mist
      "#f5f5ff", // Faint purple-white
      "#e0f0ff", // Winter morning blue
    ],
    minSize: 1.5,
    maxSize: 12,
    minSpeed: 0.3,
    maxSpeed: 2.5,
    density: 0.00015,
    windChangeInterval: 400,
  },
  shootingStar: {
    colors: [
      "#ffffff", // Pure white
      "#f8faff", // Soft white
      "#e8f4f8", // Icy blue
      "#dde7ff", // Soft blue
      "#f0f8ff", // Alice blue
      "#e6f2ff", // Gentle sky
      "#fff8e7", // Warm white
    ],
    minSize: 3,
    maxSize: 5,
    minSpeed: 0.012, // Graceful arc across sky (~1-1.5 seconds)
    maxSpeed: 0.02,
    minInterval: 8000,
    maxInterval: 20000,
    tailLength: {
      min: 50,
      max: 100,
    },
  },
};

/**
 * Core background configuration
 */
export const CoreBackgroundConfig = {
  gradientStops: [
    { position: 0, color: "#0a0e1a" }, // Deep midnight blue
    { position: 0.2, color: "#1a1d3a" }, // Rich indigo
    { position: 0.4, color: "#2d2560" }, // Deep purple-blue
    { position: 0.65, color: "#1e2a4a" }, // Winter evening blue
    { position: 0.85, color: "#0f1c3d" }, // Deep ocean blue
    { position: 1, color: "#041426" }, // Deepest night
  ],
} as const;

/**
 * Quality level configurations
 */
export const QUALITY_CONFIGS = {
  "ultra-minimal": {
    maxParticles: 5, // Extremely sparse for lowest-end devices
    animationFrameRate: 10, // Slowest frame rate for minimal CPU usage
    enableBlur: false,
    enableGlow: false,
    particleSize: 1,
    densityMultiplier: 0.1, // Minimal particle density
  },
  minimal: {
    maxParticles: 20,
    animationFrameRate: 15,
    enableBlur: false,
    enableGlow: false,
    particleSize: 1,
    densityMultiplier: 0.3,
  },
  low: {
    maxParticles: 50,
    animationFrameRate: 30,
    enableBlur: false,
    enableGlow: false,
    particleSize: 2,
    densityMultiplier: 0.5,
  },
  medium: {
    maxParticles: 100,
    animationFrameRate: 45,
    enableBlur: true,
    enableGlow: false,
    particleSize: 3,
    densityMultiplier: 0.75,
  },
  high: {
    maxParticles: 200,
    animationFrameRate: 60,
    enableBlur: true,
    enableGlow: true,
    particleSize: 4,
    densityMultiplier: 1.0,
  },
} as const;
