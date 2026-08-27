/**
 * One-time bootstrap: seed built-in fuel sources to Firestore.
 *
 * Writes 4 documents to config/fuelSources/{id}.
 * Safe to re-run — uses set() which overwrites existing documents.
 *
 * Usage: node scripts/seed-fuel-sources.js
 */
import admin from "firebase-admin";
import { readFileSync } from "fs";

// --- Firebase Admin init (same pattern as other scripts) ---
const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// --- Fuel source data (mirrors BuiltInFuelSources.ts) ---

const FUEL_SOURCES = [
  {
    id: "white-gas",
    name: "White Gas",
    description: "Bright, fast burn. The standard.",
    rendererType: "fluid",
    fluidParams: {
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
    },
    colorCurve: {
      coldColor: [0.2, 0.02, 0.0],
      midColor: [0.9, 0.15, 0.0],
      hotColor: [1.0, 0.55, 0.05],
      coreColor: [1.0, 0.9, 0.35],
    },
    builtIn: true,
    sortOrder: 0,
  },
  {
    id: "lamp-oil",
    name: "Lamp Oil",
    description: "Deep orange, lingering trails.",
    rendererType: "fluid",
    fluidParams: {
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
    },
    colorCurve: {
      coldColor: [0.18, 0.01, 0.0],
      midColor: [0.75, 0.08, 0.0],
      hotColor: [0.94, 0.39, 0.08],
      coreColor: [1.0, 0.75, 0.25],
    },
    builtIn: true,
    sortOrder: 1,
  },
  {
    id: "isopropyl",
    name: "Isopropyl",
    description: "Blue-purple, ethereal glow.",
    rendererType: "fluid",
    fluidParams: {
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
    },
    colorCurve: {
      coldColor: [0.0, 0.02, 0.15],
      midColor: [0.05, 0.1, 0.7],
      hotColor: [0.15, 0.25, 0.9],
      coreColor: [0.6, 0.7, 1.0],
    },
    builtIn: true,
    sortOrder: 2,
  },
  {
    id: "charcoal",
    name: "Charcoal",
    description: "Spark showers from burning steel.",
    rendererType: "particle",
    particleParams: {
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
    },
    builtIn: true,
    sortOrder: 3,
  },
];


async function seedFuelSources() {
  console.log(
    `Seeding ${FUEL_SOURCES.length} built-in fuel sources to config/fuelSources/...\n`
  );

  for (const source of FUEL_SOURCES) {
    const docRef = db.doc(`config/fuelSources/${source.id}`);
    await docRef.set(source);
    console.log(`  wrote config/fuelSources/${source.id} (${source.name})`);
  }

  console.log(`\nDone. ${FUEL_SOURCES.length} fuel sources seeded.`);
}

seedFuelSources().catch((error) => {
  console.error("Error seeding fuel sources:", error.message);
  process.exit(1);
});
