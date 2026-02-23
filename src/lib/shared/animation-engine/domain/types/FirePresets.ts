/**
 * Fire Physics Presets
 *
 * @deprecated Use FuelSourceTypes and BuiltInFuelSources instead.
 * This file is retained for migration compatibility only.
 *
 * 8 named tuning variations for the Navier-Stokes fire simulation.
 * Each preset defines a complete set of physics parameters that produce
 * a distinct visual character. Users compare presets visually and pick
 * favorites, then fine-tune with intensity/flameHeight sliders.
 *
 * Physics parameter cheat sheet:
 *   - dissipation closer to 1.0 = slower decay = longer trails
 *   - dissipation closer to 0.85 = fast decay = short/tight
 *   - vorticity = turbulence/flickering
 *   - buoyancy = upward pull (needs ~30-150 for visible rise in the advection math)
 *   - upwardBias = local upward velocity injected at each wick tip (~1-6)
 *   - coolingRate = how fast the combustion shader cools spent fuel
 *
 * Buoyancy math: equilibrium upward velocity ≈ buoyancy * temp * dt / (1 - velDiss).
 * With dt=0.016 and velDiss=0.955: buoyancy=40 → ~14 texels/s (subtle),
 * buoyancy=120 → ~43 texels/s (clearly visible).
 */

import type { FirePhysicsParams } from "./FireTypes";

/** @deprecated Use FuelSource from FuelSourceTypes.ts instead */
export interface FirePreset {
  id: string;
  name: string;
  description: string;
  params: FirePhysicsParams;
}

/** @deprecated Use BUILT_IN_FUEL_SOURCES from BuiltInFuelSources.ts instead */
export const FIRE_PRESETS: FirePreset[] = [
  {
    id: "candlewick",
    name: "Candlewick",
    description: "Tight, steady flame. Minimal trail.",
    params: {
      splatRadius: 0.008,
      fuelAmount: 0.4,
      velocityInjectScale: 0.0003,
      velocityDissipation: 0.93,
      temperatureDissipation: 0.92,
      fuelDissipation: 0.91,
      vorticityStrength: 2.5,
      buoyancyStrength: 30,
      burnRate: 3.0,
      fuelEfficiency: 2.0,
      coolingRate: 4.5,
      pressureDissipation: 0.8,
      temperatureInjection: 0.8,
      upwardBias: 1.5,
      sootYield: 0.02,
      sootCoolThreshold: 0.3,
      sootCoolRate: 0.5,
      sootDissipation: 2.0,
      sootAdvectionDissipation: 0.96,
    },
  },
  {
    id: "torch",
    name: "Torch",
    description: "Classic torch flame. Moderate trail, visible rise.",
    params: {
      splatRadius: 0.012,
      fuelAmount: 0.7,
      velocityInjectScale: 0.0004,
      velocityDissipation: 0.96,
      temperatureDissipation: 0.95,
      fuelDissipation: 0.94,
      vorticityStrength: 5.0,
      buoyancyStrength: 80,
      burnRate: 3.5,
      fuelEfficiency: 2.5,
      coolingRate: 3.0,
      pressureDissipation: 0.8,
      temperatureInjection: 1.4,
      upwardBias: 4.0,
      sootYield: 0.04,
      sootCoolThreshold: 0.3,
      sootCoolRate: 0.8,
      sootDissipation: 2.5,
      sootAdvectionDissipation: 0.97,
    },
  },
  {
    id: "comet",
    name: "Comet",
    description: "Long trailing tail. Smooth, speed-reactive.",
    params: {
      splatRadius: 0.010,
      fuelAmount: 0.5,
      velocityInjectScale: 0.001,
      velocityDissipation: 0.985,
      temperatureDissipation: 0.975,
      fuelDissipation: 0.96,
      vorticityStrength: 2.0,
      buoyancyStrength: 15,
      burnRate: 3.0,
      fuelEfficiency: 3.0,
      coolingRate: 1.5,
      pressureDissipation: 0.85,
      temperatureInjection: 1.0,
      upwardBias: 0.5,
      sootYield: 0.01,
      sootCoolThreshold: 0.25,
      sootCoolRate: 0.3,
      sootDissipation: 1.5,
      sootAdvectionDissipation: 0.98,
    },
  },
  {
    id: "wildfire",
    name: "Wildfire",
    description: "Chaotic, turbulent. Lots of flickering.",
    params: {
      splatRadius: 0.015,
      fuelAmount: 0.7,
      velocityInjectScale: 0.0005,
      velocityDissipation: 0.97,
      temperatureDissipation: 0.96,
      fuelDissipation: 0.95,
      vorticityStrength: 15.0,
      buoyancyStrength: 120,
      burnRate: 4.0,
      fuelEfficiency: 3.0,
      coolingRate: 2.5,
      pressureDissipation: 0.8,
      temperatureInjection: 1.6,
      upwardBias: 5.0,
      sootYield: 0.10,
      sootCoolThreshold: 0.4,
      sootCoolRate: 1.5,
      sootDissipation: 3.0,
      sootAdvectionDissipation: 0.96,
    },
  },
  {
    id: "ember",
    name: "Ember",
    description: "Barely burning. Warm, dim glow.",
    params: {
      splatRadius: 0.006,
      fuelAmount: 0.25,
      velocityInjectScale: 0.0002,
      velocityDissipation: 0.92,
      temperatureDissipation: 0.90,
      fuelDissipation: 0.89,
      vorticityStrength: 2.0,
      buoyancyStrength: 20,
      burnRate: 2.0,
      fuelEfficiency: 1.5,
      coolingRate: 5.0,
      pressureDissipation: 0.75,
      temperatureInjection: 0.5,
      upwardBias: 1.0,
      sootYield: 0.08,
      sootCoolThreshold: 0.35,
      sootCoolRate: 1.0,
      sootDissipation: 2.0,
      sootAdvectionDissipation: 0.97,
    },
  },
  {
    id: "solar-flare",
    name: "Solar Flare",
    description: "Bright, expansive. Slow cooling, wide flames.",
    params: {
      splatRadius: 0.020,
      fuelAmount: 0.9,
      velocityInjectScale: 0.0005,
      velocityDissipation: 0.98,
      temperatureDissipation: 0.975,
      fuelDissipation: 0.965,
      vorticityStrength: 6.0,
      buoyancyStrength: 50,
      burnRate: 4.5,
      fuelEfficiency: 3.5,
      coolingRate: 1.5,
      pressureDissipation: 0.85,
      temperatureInjection: 1.8,
      upwardBias: 2.5,
      sootYield: 0.03,
      sootCoolThreshold: 0.3,
      sootCoolRate: 0.6,
      sootDissipation: 2.0,
      sootAdvectionDissipation: 0.98,
    },
  },
  {
    id: "ghost",
    name: "Ghost Fire",
    description: "Wispy, ethereal. Fast-dissipating tendrils.",
    params: {
      splatRadius: 0.010,
      fuelAmount: 0.35,
      velocityInjectScale: 0.0004,
      velocityDissipation: 0.91,
      temperatureDissipation: 0.89,
      fuelDissipation: 0.87,
      vorticityStrength: 10.0,
      buoyancyStrength: 150,
      burnRate: 6.0,
      fuelEfficiency: 2.0,
      coolingRate: 6.0,
      pressureDissipation: 0.75,
      temperatureInjection: 0.7,
      upwardBias: 6.0,
      sootYield: 0.12,
      sootCoolThreshold: 0.45,
      sootCoolRate: 2.0,
      sootDissipation: 3.5,
      sootAdvectionDissipation: 0.95,
    },
  },
  {
    id: "fire-spin",
    name: "Fire Spin",
    description: "Tuned for real fire spinning. Wick-focused, arc-following.",
    params: {
      splatRadius: 0.011,
      fuelAmount: 0.55,
      velocityInjectScale: 0.0006,
      velocityDissipation: 0.955,
      temperatureDissipation: 0.945,
      fuelDissipation: 0.935,
      vorticityStrength: 3.5,
      buoyancyStrength: 40,
      burnRate: 3.5,
      fuelEfficiency: 2.5,
      coolingRate: 3.5,
      pressureDissipation: 0.8,
      temperatureInjection: 1.1,
      upwardBias: 2.0,
      sootYield: 0.04,
      sootCoolThreshold: 0.3,
      sootCoolRate: 0.8,
      sootDissipation: 2.5,
      sootAdvectionDissipation: 0.97,
    },
  },
];

/** @deprecated Use FuelSourceLoader.loadById() instead */
export function getFirePreset(id: string): FirePreset | undefined {
  return FIRE_PRESETS.find(p => p.id === id);
}
