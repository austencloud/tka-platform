/**
 * LED Manufacturer Presets
 *
 * Hardcoded LED configurations for real-world prop products.
 * Each preset maps a commercial prop's LED layout to the
 * PropLedConfig coordinate system used by the LED renderer.
 *
 * Coordinate system (prop-local space):
 *   dx = offset along the prop's primary (long) axis
 *        0 = center, +1 = toward tip, -1 = toward handle
 *   dy = offset perpendicular to the primary axis
 *        0 = centerline
 *   Values are normalized: roughly -1.0 to 1.0
 */

import type { PropLedConfig, LedPoint } from "./LedTypes";

export interface LedManufacturerPreset {
  /** Unique identifier for this preset */
  id: string;
  /** Human-readable product name */
  name: string;
  /** Manufacturer or brand */
  manufacturer: string;
  /** Short description of the prop and its LED layout */
  description: string;
  /** LED point geometry in prop-local space */
  config: PropLedConfig;
  /** Default pattern to apply when this preset is selected */
  defaultPatternId: string;
}

// ─── Flowtoys ───────────────────────────────────────────────

const flowtoysCapsule2: LedManufacturerPreset = {
  id: "flowtoys-capsule-2",
  name: "Capsule 2.0",
  manufacturer: "Flowtoys",
  description: "Modular club/staff capsule with 6 LEDs along the body, one per segment",
  config: {
    points: [
      { dx: -0.8, dy: 0, brightness: 1.0 },
      { dx: -0.48, dy: 0, brightness: 1.0 },
      { dx: -0.16, dy: 0, brightness: 1.0 },
      { dx: 0.16, dy: 0, brightness: 1.0 },
      { dx: 0.48, dy: 0, brightness: 1.0 },
      { dx: 0.8, dy: 0, brightness: 1.0 },
    ],
  },
  defaultPatternId: "rainbow",
};

const flowtoysVisionClub: LedManufacturerPreset = {
  id: "flowtoys-vision-club",
  name: "Vision Club",
  manufacturer: "Flowtoys",
  description: "LED club with 8 individually addressable LEDs along the body",
  config: {
    points: [
      { dx: -0.85, dy: 0, brightness: 1.0 },
      { dx: -0.61, dy: 0, brightness: 1.0 },
      { dx: -0.37, dy: 0, brightness: 1.0 },
      { dx: -0.13, dy: 0, brightness: 1.0 },
      { dx: 0.13, dy: 0, brightness: 1.0 },
      { dx: 0.37, dy: 0, brightness: 1.0 },
      { dx: 0.61, dy: 0, brightness: 1.0 },
      { dx: 0.85, dy: 0, brightness: 1.0 },
    ],
  },
  defaultPatternId: "rainbow",
};

const flowtoysIsoBaton: LedManufacturerPreset = {
  id: "flowtoys-iso-baton",
  name: "Iso Baton",
  manufacturer: "Flowtoys",
  description: "Staff-like baton with 2 illuminated pods (3 LEDs each) at both ends",
  config: {
    points: [
      // Left pod (handle end)
      { dx: -0.9, dy: 0, brightness: 1.0 },
      { dx: -0.75, dy: 0, brightness: 1.0 },
      { dx: -0.6, dy: 0, brightness: 1.0 },
      // Right pod (tip end)
      { dx: 0.6, dy: 0, brightness: 1.0 },
      { dx: 0.75, dy: 0, brightness: 1.0 },
      { dx: 0.9, dy: 0, brightness: 1.0 },
    ],
  },
  defaultPatternId: "pulse",
};

// ─── Lighttoys ──────────────────────────────────────────────

const lighttoysClub: LedManufacturerPreset = {
  id: "lighttoys-club",
  name: "FT Club",
  manufacturer: "Lighttoys",
  description: "LED juggling club with 4 bright LEDs distributed along the body",
  config: {
    points: [
      { dx: -0.6, dy: 0, brightness: 1.0 },
      { dx: -0.2, dy: 0, brightness: 1.0 },
      { dx: 0.2, dy: 0, brightness: 1.0 },
      { dx: 0.6, dy: 0, brightness: 1.0 },
    ],
  },
  defaultPatternId: "solid",
};

// ─── Generic / Homebrew ─────────────────────────────────────

const genericStaff: LedManufacturerPreset = {
  id: "generic-staff",
  name: "Generic Staff",
  manufacturer: "Generic",
  description: "Basic staff with one LED at each tip",
  config: {
    points: [
      { dx: -0.95, dy: 0, brightness: 1.0 },
      { dx: 0.95, dy: 0, brightness: 1.0 },
    ],
  },
  defaultPatternId: "solid",
};

const genericSingle: LedManufacturerPreset = {
  id: "generic-single",
  name: "Single Point",
  manufacturer: "Generic",
  description: "Single LED point source at the prop tip",
  config: {
    points: [{ dx: 0.9, dy: 0, brightness: 1.0 }],
  },
  defaultPatternId: "solid",
};

// ─── Registry ───────────────────────────────────────────────

export const LED_MANUFACTURER_PRESETS: LedManufacturerPreset[] = [
  flowtoysCapsule2,
  flowtoysVisionClub,
  flowtoysIsoBaton,
  lighttoysClub,
  genericStaff,
  genericSingle,
];

/** Look up a preset by its unique ID. */
export function getLedPreset(id: string): LedManufacturerPreset | undefined {
  return LED_MANUFACTURER_PRESETS.find((p) => p.id === id);
}

/** Get all presets from a given manufacturer. */
export function getLedPresetsByManufacturer(
  manufacturer: string,
): LedManufacturerPreset[] {
  return LED_MANUFACTURER_PRESETS.filter((p) => p.manufacturer === manufacturer);
}
