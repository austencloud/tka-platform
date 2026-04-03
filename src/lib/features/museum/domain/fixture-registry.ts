/**
 * Light Fixture Registry
 *
 * Maps wing themes to their era-appropriate light fixture models.
 * Each era of the museum has a different style of lighting that tells
 * the story of the building being constructed across decades.
 *
 * Models are CC0 or CC-BY licensed GLB files in static/models/fixtures/.
 * Attribution is tracked in static/models/fixtures/CREDITS.md.
 */

import type { WingTheme } from "./museum-grid-types";

export interface FixtureConfig {
  /** Path to the GLB model relative to the static directory */
  modelPath: string;
  /** Display name for the showroom */
  label: string;
  /** What era this fixture represents */
  era: string;
  /** Size multiplier — 1.0 = 0.3m tall, 2.0 = 0.6m. Auto-scaled from bounding box. */
  scale: number;
  /** Y offset from the default wall mount height (1.25m) */
  yOffset: number;
  /** Light color tint for the point light */
  lightColor: string;
  /** Base intensity for the point light */
  lightIntensity: number;
  /** Whether this fixture has a flame effect overlay */
  hasFlame: boolean;
  /** Whether this fixture has ember particles */
  hasEmbers: boolean;
}

/**
 * Maps each wing theme to its light fixture configuration.
 * When a GLB model file doesn't exist yet, the component falls back
 * to the procedural torch geometry.
 */
export const FIXTURE_REGISTRY: Record<WingTheme, FixtureConfig> = {
  cave: {
    modelPath: "/models/fixtures/torch-cave.glb",
    label: "Wall Torch",
    era: "Ancient (~15,000 BCE)",
    scale: 1.5,
    yOffset: 0,
    lightColor: "#ff9020",
    lightIntensity: 4,
    hasFlame: true,
    hasEmbers: true,
  },
  classical: {
    modelPath: "/models/fixtures/lamp-classical.glb",
    label: "Oil Lamp",
    era: "Egyptian/Greek (~3,000 BCE)",
    scale: 1.0,
    yOffset: -0.1,
    lightColor: "#e8a040",
    lightIntensity: 3.5,
    hasFlame: true,
    hasEmbers: false,
  },
  renaissance: {
    modelPath: "/models/fixtures/sconce-renaissance.glb",
    label: "Candle Sconce",
    era: "Renaissance (~1500 CE)",
    scale: 1.0,
    yOffset: 0,
    lightColor: "#ffc060",
    lightIntensity: 3,
    hasFlame: true,
    hasEmbers: false,
  },
  industrial: {
    modelPath: "/models/fixtures/sconce-victorian.glb",
    label: "Gas Lamp Sconce",
    era: "Victorian (~1880 CE)",
    scale: 1.2,
    yOffset: 0,
    lightColor: "#e8c870",
    lightIntensity: 3.5,
    hasFlame: true,
    hasEmbers: false,
  },
  digital: {
    modelPath: "/models/fixtures/fluorescent-tube.glb",
    label: "Fluorescent Tube",
    era: "1990s",
    scale: 3.0,
    yOffset: 0.8,
    lightColor: "#c0d8ff",
    lightIntensity: 5,
    hasFlame: false,
    hasEmbers: false,
  },
  institutional: {
    modelPath: "/models/fixtures/fluorescent-tube.glb",
    label: "Fluorescent Tube",
    era: "Institutional (~2000s)",
    scale: 3.0,
    yOffset: 0.8,
    lightColor: "#d0e0ff",
    lightIntensity: 5,
    hasFlame: false,
    hasEmbers: false,
  },
  gallery: {
    modelPath: "/models/fixtures/sconce-victorian.glb",
    label: "Mismatched Sconce",
    era: "Handmade (2024+)",
    scale: 1.0,
    yOffset: 0,
    lightColor: "#ffe0b0",
    lightIntensity: 4,
    hasFlame: false,
    hasEmbers: false,
  },
  modern: {
    modelPath: "/models/fixtures/track-light.glb",
    label: "Spot Light",
    era: "Modern",
    scale: 1.5,
    yOffset: 0.3,
    lightColor: "#fff0e0",
    lightIntensity: 4,
    hasFlame: false,
    hasEmbers: false,
  },
  futuristic: {
    modelPath: "/models/fixtures/track-light.glb",
    label: "LED Strip",
    era: "Future",
    scale: 1.5,
    yOffset: 0.3,
    lightColor: "#e0f0ff",
    lightIntensity: 4,
    hasFlame: false,
    hasEmbers: false,
  },
  outdoor: {
    modelPath: "/models/fixtures/sconce-victorian.glb",
    label: "String Lights",
    era: "Festival",
    scale: 1.0,
    yOffset: 0,
    lightColor: "#ffe8c0",
    lightIntensity: 3,
    hasFlame: false,
    hasEmbers: false,
  },
  construction: {
    modelPath: "/models/fixtures/fluorescent-tube.glb",
    label: "Work Light",
    era: "Under Construction",
    scale: 2.0,
    yOffset: 0.3,
    lightColor: "#ffe0a0",
    lightIntensity: 4,
    hasFlame: false,
    hasEmbers: false,
  },
  retail: {
    modelPath: "/models/fixtures/track-light.glb",
    label: "Track Lighting",
    era: "Commercial",
    scale: 0.3,
    yOffset: 0.5,
    lightColor: "#fff8f0",
    lightIntensity: 5,
    hasFlame: false,
    hasEmbers: false,
  },
};

/** All unique fixture configs for the showroom display */
export function getAllFixtures(): { theme: WingTheme; config: FixtureConfig }[] {
  return (Object.entries(FIXTURE_REGISTRY) as [WingTheme, FixtureConfig][])
    .map(([theme, config]) => ({ theme, config }));
}
