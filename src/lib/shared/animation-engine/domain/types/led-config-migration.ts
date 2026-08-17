/**
 * v1 → v2 LED config migration.
 *
 * v1 described the effect as a single evaluator id plus loose color fields
 * (`patternId`, `patternSpeed`, `primaryColor`, `secondaryColor`, `colorMode`,
 * `blueHandColor`, `redHandColor`). v2 describes a device running a strip
 * pattern. The mapping is total: anything unrecognized, malformed, or missing
 * resolves to the default config, so no persisted value can brick the effect.
 */

import type { LedShutter, LedSimulatorConfig } from "./led-types";
import {
  CAPSULE_LED_COUNT,
  DEFAULT_LED_INTENT,
  DEFAULT_LED_LOOK,
  PATTERN_MATERIALIZE_BRIGHTNESS,
  PROP_BLUE,
  PROP_RED,
  clampCycleDuration,
  hexToRgb255,
} from "./led-types";
import {
  CAMERA_EXPOSURE_MAX_S,
  CAMERA_EXPOSURE_MIN_S,
  DEFAULT_GLARE_WEIGHT,
  DEFAULT_LED_SHUTTER,
  GLARE_WEIGHT_MAX,
  GLARE_WEIGHT_MIN,
} from "../led-photometry";

/** v1 evaluator ids that painted one flat color from `primaryColor`. */
const SOLID_FAMILY = new Set(["solid", "split", "quad"]);

/** v1 evaluator ids that swept hue over time — all become one rainbow POV look. */
const SPECTRUM_FAMILY = new Set(["rainbow", "warm-shift", "cool-shift", "neon"]);

/** v1 `patternSpeed` was a 0.1–5.0 multiplier; v2 asks for seconds per loop. */
const SPEED_TO_CYCLE_REFERENCE_SECONDS = 3;

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function hexOr(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())
    ? value.trim()
    : fallback;
}

/**
 * v1 stored brightness two ways: the intent layer as a discrete 1-5 level,
 * the runtime overlay config as the resolved 0-1 float. Accept either.
 */
function brightnessLevelOr(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value > 0 && value <= 1) {
    // A resolved 0.2/0.4/0.6/0.8/1.0 float — recover its level.
    return Math.max(1, Math.min(5, Math.round(value * 5)));
  }
  return Math.max(1, Math.min(5, Math.round(value)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** True for a well-formed `LedShutter` of either mode. */
function isLedShutter(value: unknown): value is LedShutter {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    (s.mode === "eye" && typeof s.timeConstantSeconds === "number") ||
    (s.mode === "camera" && typeof s.exposureSeconds === "number")
  );
}

/** Normalize an already-current-shape shutter, clamping its live parameter. */
function normalizeShutter(value: unknown): LedShutter {
  if (!isLedShutter(value)) return { ...DEFAULT_LED_SHUTTER };
  if (value.mode === "camera") {
    return {
      mode: "camera",
      exposureSeconds: clamp(
        value.exposureSeconds,
        CAMERA_EXPOSURE_MIN_S,
        CAMERA_EXPOSURE_MAX_S
      ),
    };
  }
  return { mode: "eye", timeConstantSeconds: Math.max(value.timeConstantSeconds, 1e-6) };
}

/**
 * Old `trailFadeRate` was a per-frame decay constant in [0.80, 0.98]. Map it
 * monotonically onto an eye time constant in [0.04s, 0.4s] so a user's saved
 * long trail (high decay, close to 0.98) stays a long trail (a large time
 * constant), and a saved short trail stays short.
 */
function migrateShutterFromTrailFadeRate(v1: Record<string, unknown>): LedShutter {
  const trailFadeRate = numberOr(v1.trailFadeRate, NaN);
  if (!Number.isFinite(trailFadeRate)) return { ...DEFAULT_LED_SHUTTER };
  const t = clamp((trailFadeRate - 0.8) / (0.98 - 0.8), 0, 1);
  return { mode: "eye", timeConstantSeconds: 0.04 + t * (0.4 - 0.04) };
}

/**
 * Old `bloomIntensity` was a 0-0.15 pyramid intensity. Map it monotonically
 * onto `glare`, the new per-mip weight, within [GLARE_WEIGHT_MIN, GLARE_WEIGHT_MAX].
 */
function migrateGlareFromBloomIntensity(v1: Record<string, unknown>): number {
  const bloomIntensity = numberOr(v1.bloomIntensity, NaN);
  if (!Number.isFinite(bloomIntensity)) return DEFAULT_GLARE_WEIGHT;
  const t = clamp(bloomIntensity, 0, 0.15) / 0.15;
  return GLARE_WEIGHT_MIN + t * (GLARE_WEIGHT_MAX - GLARE_WEIGHT_MIN);
}

/**
 * Migrate a persisted look onto the current `LedLook` shape.
 *
 * A look object may arrive in one of two shapes: the current
 * `{ shutter, glare, brightness }`, detected by a well-formed `shutter` or a
 * numeric `glare`; or the old `{ glowRadius, trailFadeRate, bloomIntensity,
 * brightness }`, detected by either of its numeric fields. `glowRadius` is
 * dropped with no replacement — emitter size is now derived from LED pitch in
 * `domain/led-photometry.ts` and is not authorable, since a real LED's size
 * is a fact about the prop, not a preference.
 */
function migrateLook(v1: Record<string, unknown>): LedSimulatorConfig["look"] {
  const brightness = brightnessLevelOr(v1.brightness, DEFAULT_LED_LOOK.brightness);

  if (isLedShutter(v1.shutter) || typeof v1.glare === "number") {
    return {
      shutter: normalizeShutter(v1.shutter),
      glare: clamp(numberOr(v1.glare, DEFAULT_GLARE_WEIGHT), GLARE_WEIGHT_MIN, GLARE_WEIGHT_MAX),
      brightness,
    };
  }

  const hasOldLookFields =
    typeof v1.trailFadeRate === "number" || typeof v1.bloomIntensity === "number";
  if (!hasOldLookFields) return { ...DEFAULT_LED_LOOK, brightness };

  return {
    shutter: migrateShutterFromTrailFadeRate(v1),
    glare: migrateGlareFromBloomIntensity(v1),
    brightness,
  };
}

/**
 * Migrate a persisted v1 LED config (intent or overlay shape) to v2.
 * Never throws. A v2 config passes through with its fields normalized.
 */
export function migrateLedConfig(v1: unknown): LedSimulatorConfig {
  const fallback = structuredClone(DEFAULT_LED_INTENT);
  if (!v1 || typeof v1 !== "object") return fallback;

  const raw = v1 as Record<string, unknown>;

  // Already v2: normalize the numbers we clamp and hand it back.
  if (raw.device && raw.pattern) {
    const device = raw.device as Record<string, unknown>;
    const kind = device.kind === "pixel-staff" ? "pixel-staff" : "capsule";
    return {
      device: {
        kind,
        ledCount:
          kind === "capsule"
            ? CAPSULE_LED_COUNT
            : numberOr(device.ledCount, 200),
      },
      pattern: raw.pattern as LedSimulatorConfig["pattern"],
      cycleDuration: clampCycleDuration(
        numberOr(raw.cycleDuration, fallback.cycleDuration)
      ),
      look:
        raw.look && typeof raw.look === "object"
          ? migrateLook(raw.look as Record<string, unknown>)
          : { ...DEFAULT_LED_LOOK },
    };
  }

  const patternId = typeof raw.patternId === "string" ? raw.patternId : null;
  if (!patternId) return fallback;

  const look = migrateLook(raw);
  // A 0.1–5.0 multiplier maps inversely onto seconds-per-loop: 1.0 keeps the
  // 3-second default, 2.0 halves it, 0.5 doubles it.
  const cycleDuration = clampCycleDuration(
    SPEED_TO_CYCLE_REFERENCE_SECONDS / Math.max(0.1, numberOr(raw.patternSpeed, 1))
  );

  if (SPECTRUM_FAMILY.has(patternId)) {
    return {
      device: { kind: "pixel-staff", ledCount: 200 },
      pattern: {
        source: "generator",
        generatorId: "rainbow-sweep",
        params: {
          primaryColor: hexToRgb255(hexOr(raw.primaryColor, PROP_BLUE)),
          secondaryColor: hexToRgb255(hexOr(raw.secondaryColor, PROP_RED)),
          speed: 1,
          brightness: PATTERN_MATERIALIZE_BRIGHTNESS,
        },
      },
      cycleDuration,
      look,
    };
  }

  if (SOLID_FAMILY.has(patternId)) {
    // "prop-matched" meant each hand showed its canonical color — that is
    // exactly what the prop-colors generator paints, so keep it.
    const propMatched = raw.colorMode === "prop-matched";
    return {
      device: { kind: "capsule", ledCount: CAPSULE_LED_COUNT },
      pattern: {
        source: "generator",
        generatorId: propMatched ? "prop-colors" : "solid",
        params: {
          primaryColor: hexToRgb255(
            propMatched ? PROP_BLUE : hexOr(raw.primaryColor, PROP_BLUE)
          ),
          secondaryColor: hexToRgb255(
            propMatched ? PROP_RED : hexOr(raw.secondaryColor, PROP_RED)
          ),
          speed: 1,
          brightness: PATTERN_MATERIALIZE_BRIGHTNESS,
        },
      },
      cycleDuration,
      look,
    };
  }

  // Every other v1 evaluator (breathe, chase, texture, tka-aware…) has no
  // honest v2 equivalent. Fall back to the default look but keep the user's
  // shutter/glare/brightness, which are device-independent.
  return { ...fallback, look };
}
