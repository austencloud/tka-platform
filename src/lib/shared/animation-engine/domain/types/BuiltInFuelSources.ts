import type { FuelSourceDocument, FireColorCurve, CharcoalParams } from "./FuelSourceTypes";
import type { FirePhysicsParams } from "./FireTypes";

// --- White Gas: bright, fast burn, standard fire spinning fuel ---
const WHITE_GAS_PHYSICS: FirePhysicsParams = {
  splatRadius: 0.012,
  fuelAmount: 1.0,
  velocityInjectScale: 0.001,
  velocityDissipation: 0.935,
  temperatureDissipation: 0.93,
  fuelDissipation: 0.93,
  vorticityStrength: 8.0,
  buoyancyStrength: 80.0,
  burnRate: 5.0,
  fuelEfficiency: 2.5,
  coolingRate: 4.0,
  pressureDissipation: 0.8,
  temperatureInjection: 1.5,
  upwardBias: 3.0,
};

export const WHITE_GAS_COLOR: FireColorCurve = {
  coldColor: [0.2, 0.02, 0.0],
  midColor: [0.9, 0.15, 0.0],
  hotColor: [1.0, 0.55, 0.05],
  coreColor: [1.0, 0.9, 0.35],
};

// --- Lamp Oil: deep orange, slow burn, lingering trails ---
const LAMP_OIL_PHYSICS: FirePhysicsParams = {
  splatRadius: 0.014,
  fuelAmount: 0.75,
  velocityInjectScale: 0.0008,
  velocityDissipation: 0.965,
  temperatureDissipation: 0.96,
  fuelDissipation: 0.96,
  vorticityStrength: 5.0,
  buoyancyStrength: 55.0,
  burnRate: 2.8,
  fuelEfficiency: 2.0,
  coolingRate: 2.0,
  pressureDissipation: 0.8,
  temperatureInjection: 1.2,
  upwardBias: 2.2,
};

const LAMP_OIL_COLOR: FireColorCurve = {
  coldColor: [0.18, 0.01, 0.0],
  midColor: [0.75, 0.08, 0.0],
  hotColor: [0.94, 0.39, 0.08],
  coreColor: [1.0, 0.75, 0.25],
};

// --- Isopropyl: blue-purple, fast burn, minimal soot, ethereal ---
const ISOPROPYL_PHYSICS: FirePhysicsParams = {
  splatRadius: 0.01,
  fuelAmount: 0.55,
  velocityInjectScale: 0.0012,
  velocityDissipation: 0.9,
  temperatureDissipation: 0.89,
  fuelDissipation: 0.9,
  vorticityStrength: 10.0,
  buoyancyStrength: 95.0,
  burnRate: 6.0,
  fuelEfficiency: 1.8,
  coolingRate: 6.0,
  pressureDissipation: 0.8,
  temperatureInjection: 1.0,
  upwardBias: 3.5,
};

const ISOPROPYL_COLOR: FireColorCurve = {
  coldColor: [0.0, 0.02, 0.15],
  midColor: [0.05, 0.1, 0.7],
  hotColor: [0.15, 0.25, 0.9],
  coreColor: [0.6, 0.7, 1.0],
};

// --- Charcoal: spark shower, particle system ---
const CHARCOAL_PARTICLES: CharcoalParams = {
  sparkRate: 120,
  sparkLifetime: 0.8,
  sparkInitialSpeed: 1.2,
  sparkScatter: 100,
  sparkSize: 3.0,
  sparkSizeVariance: 0.5,
  gravity: 150,
  dragCoefficient: 2.0,
  secondarySparkChance: 0.15,
  emberGlowDuration: 0.3,
  coolingRate: 0.002,
  initialTemperature: 1.0,
};

export const BUILT_IN_FUEL_SOURCES: FuelSourceDocument[] = [
  {
    id: "white-gas",
    name: "White Gas",
    description: "Bright, fast burn. The standard.",
    rendererType: "fluid",
    fluidParams: WHITE_GAS_PHYSICS,
    colorCurve: WHITE_GAS_COLOR,
    builtIn: true,
    sortOrder: 0,
  },
  {
    id: "lamp-oil",
    name: "Lamp Oil",
    description: "Deep orange, lingering trails.",
    rendererType: "fluid",
    fluidParams: LAMP_OIL_PHYSICS,
    colorCurve: LAMP_OIL_COLOR,
    builtIn: true,
    sortOrder: 1,
  },
  {
    id: "isopropyl",
    name: "Isopropyl",
    description: "Blue-purple, ethereal glow.",
    rendererType: "fluid",
    fluidParams: ISOPROPYL_PHYSICS,
    colorCurve: ISOPROPYL_COLOR,
    builtIn: true,
    sortOrder: 2,
  },
  {
    id: "charcoal",
    name: "Charcoal",
    description: "Spark showers from burning steel.",
    rendererType: "particle",
    particleParams: CHARCOAL_PARTICLES,
    builtIn: true,
    sortOrder: 3,
  },
];

/** Look up a built-in fuel source by ID */
export function getBuiltInFuelSource(id: string): FuelSourceDocument | undefined {
  return BUILT_IN_FUEL_SOURCES.find((f) => f.id === id);
}
