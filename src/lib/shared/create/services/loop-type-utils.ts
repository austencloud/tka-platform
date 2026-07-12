/**
 * LOOP Type Utility Functions
 *
 * Standalone pure functions extracted from the deleted LOOPTypeResolver class.
 * - parseLoopComponents: parse a LOOPType string into a Set of LOOPComponents
 * - generateLOOPType: map a Set of LOOPComponents to a LOOPType, or null when
 *   no implemented LOOP type matches that exact combination
 * - canExtendCombo / isImplementedCombo: combo-builder gating helpers
 * - formatLOOPTypeForDisplay: human-readable formatting of a LOOPType string
 */

import { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import type { LOOPSpecWire, PropLOOPSpecWire } from "@tka/sequence-engine/loop";

/**
 * Parse a LOOPType string into a Set of LOOPComponent values.
 * Uses substring matching against the 6 transformation primitives.
 */
export function parseLoopComponents(loopType: LOOPType | string | null | undefined): Set<LOOPComponent> {
  const components = new Set<LOOPComponent>();
  if (!loopType) return components;

  if (loopType.includes("rotated")) components.add(LOOPComponent.ROTATED);
  if (loopType.includes("mirrored")) components.add(LOOPComponent.MIRRORED);
  if (loopType.includes("flipped")) components.add(LOOPComponent.FLIPPED);
  if (loopType.includes("swapped")) components.add(LOOPComponent.SWAPPED);
  if (loopType.includes("inverted")) components.add(LOOPComponent.INVERTED);
  if (loopType.includes("rewound")) components.add(LOOPComponent.REWOUND);

  return components;
}

/**
 * The single source of truth for which component combinations have a real,
 * generatable LOOP type behind them. Anything not in this table is not
 * offered by the combo builder and must never be silently coerced.
 *
 * Combos absent from this table are absent for a reason, not an oversight:
 * FLIPPED and REWOUND compose with nothing today (mirror+flip has no fixed
 * points at L1–L4 — it degenerates to a 180° rotation — and rewound combos
 * have no designed semantics yet).
 */
const IMPLEMENTED_COMBOS: ReadonlyArray<readonly [ReadonlySet<LOOPComponent>, LOOPType]> = [
  [new Set([LOOPComponent.ROTATED]), LOOPType.ROTATED],
  [new Set([LOOPComponent.MIRRORED]), LOOPType.MIRRORED],
  [new Set([LOOPComponent.FLIPPED]), LOOPType.FLIPPED],
  [new Set([LOOPComponent.SWAPPED]), LOOPType.SWAPPED],
  [new Set([LOOPComponent.INVERTED]), LOOPType.INVERTED],
  [new Set([LOOPComponent.REWOUND]), LOOPType.STRICT_REWOUND],
  [new Set([LOOPComponent.MIRRORED, LOOPComponent.INVERTED]), LOOPType.MIRRORED_INVERTED],
  [new Set([LOOPComponent.ROTATED, LOOPComponent.INVERTED]), LOOPType.ROTATED_INVERTED],
  [new Set([LOOPComponent.SWAPPED, LOOPComponent.INVERTED]), LOOPType.SWAPPED_INVERTED],
  [new Set([LOOPComponent.MIRRORED, LOOPComponent.ROTATED]), LOOPType.MIRRORED_ROTATED],
  [new Set([LOOPComponent.MIRRORED, LOOPComponent.SWAPPED]), LOOPType.MIRRORED_SWAPPED],
  [new Set([LOOPComponent.ROTATED, LOOPComponent.SWAPPED]), LOOPType.ROTATED_SWAPPED],
  [
    new Set([LOOPComponent.MIRRORED, LOOPComponent.INVERTED, LOOPComponent.ROTATED]),
    LOOPType.MIRRORED_INVERTED_ROTATED,
  ],
  [
    new Set([LOOPComponent.MIRRORED, LOOPComponent.ROTATED, LOOPComponent.SWAPPED]),
    LOOPType.MIRRORED_ROTATED_SWAPPED,
  ],
  [
    new Set([LOOPComponent.MIRRORED, LOOPComponent.SWAPPED, LOOPComponent.INVERTED]),
    LOOPType.MIRRORED_SWAPPED_INVERTED,
  ],
  [
    new Set([
      LOOPComponent.MIRRORED,
      LOOPComponent.ROTATED,
      LOOPComponent.INVERTED,
      LOOPComponent.SWAPPED,
    ]),
    LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED,
  ],
];

function setsEqual(a: ReadonlySet<LOOPComponent>, b: ReadonlySet<LOOPComponent>): boolean {
  if (a.size !== b.size) return false;
  for (const c of a) if (!b.has(c)) return false;
  return true;
}

function isSuperset(superset: ReadonlySet<LOOPComponent>, subset: ReadonlySet<LOOPComponent>): boolean {
  for (const c of subset) if (!superset.has(c)) return false;
  return true;
}

/**
 * Map a set of LOOPComponents to a LOOPType enum value.
 *
 * Returns null when no implemented LOOP type matches the exact combination —
 * callers must treat that as "not supported", never coerce it to a default.
 * An empty set keeps the legacy ROTATED default (the "loop off" placeholder).
 */
export function generateLOOPType(components: Set<LOOPComponent>): LOOPType | null {
  if (components.size === 0) return LOOPType.ROTATED;

  for (const [combo, loopType] of IMPLEMENTED_COMBOS) {
    if (setsEqual(combo, components)) return loopType;
  }

  return null;
}

/** True when the exact component set maps to an implemented LOOP type. */
export function isImplementedCombo(components: Set<LOOPComponent>): boolean {
  return generateLOOPType(components) !== null;
}

/**
 * Combo-builder gating: can `candidate` be added to the current selection and
 * still lead to SOME implemented combo (as an intermediate or final state)?
 *
 * Superset reachability, not exact match, so a user building toward the
 * 4-component combo can pass through unmapped intermediates like
 * {rotated, inverted, swapped}. The Apply button separately requires the
 * final set to map exactly (isImplementedCombo).
 */
export function canExtendCombo(
  current: ReadonlySet<LOOPComponent>,
  candidate: LOOPComponent
): boolean {
  const target = new Set(current);
  target.add(candidate);

  for (const [combo] of IMPLEMENTED_COMBOS) {
    if (isSuperset(combo, target)) return true;
  }

  return false;
}

export interface LoopRhythm {
  rotationInterval?: 2 | 4; // default 2
  inversionInterval?: 2 | 4; // default 2
  inversionMode?: "expand" | "overlay"; // default "expand"
}

/**
 * Build a symmetric wire-form LOOPSpec from the UI component set + rhythm.
 * Returns null for combos with no implemented mapping (same gate as
 * generateLOOPType — the combo overlay's gating stays the single source
 * of truth for which component SETS are allowed).
 */
export function buildLoopSpec(
  components: Set<LOOPComponent>,
  rhythm: LoopRhythm
): LOOPSpecWire | null {
  if (components.size === 0) return null;
  if (generateLOOPType(components) === null) return null;

  const prop: PropLOOPSpecWire = {};
  for (const comp of components) {
    if (comp === LOOPComponent.ROTATED) {
      prop.rotated = { period: rhythm.rotationInterval ?? 2 };
    } else if (comp === LOOPComponent.INVERTED) {
      prop.inverted = {
        period: rhythm.inversionInterval ?? 2,
        ...(rhythm.inversionMode === "overlay" ? { mode: "overlay" as const } : {}),
      };
    } else {
      prop[comp] = { period: 2 };
    }
  }
  return { blue: prop, red: prop };
}

/**
 * Total length multiplier of the spec's EXPANDER stages (overlay contributes
 * x1). Seed length = total / this.
 *
 * Mirrors the engine's stage semantics in spec-executor.ts exactly — the
 * naive product-of-periods formula is WRONG (Task 4 finding):
 *  - Fuseable expanders (mirrored/flipped/swapped/inverted) grouped by
 *    period run as ONE FusedExecutor stage per period group (x period once
 *    per group, not per component).
 *  - ROTATED runs as a separate stage ONLY when no fuseable group shares
 *    its period, OR a mirror/flip shares its period. When only swap/invert
 *    share rotation's period, FusedExecutor absorbs the rotation
 *    (fuseableAtSamePeriod branch) — rotation contributes x1.
 */
export function expanderMultiplier(wire: LOOPSpecWire): number {
  const prop = wire.blue ?? wire.red;
  if (!prop) return 1;

  const FUSEABLE = ["mirrored", "flipped", "swapped", "inverted"] as const;
  const groups = new Map<number, { hasMirrorOrFlip: boolean }>();
  for (const comp of FUSEABLE) {
    const cSpec = prop[comp];
    if (!cSpec || cSpec.mode === "overlay") continue;
    const group = groups.get(cSpec.period) ?? { hasMirrorOrFlip: false };
    if (comp === "mirrored" || comp === "flipped") group.hasMirrorOrFlip = true;
    groups.set(cSpec.period, group);
  }

  let mult = 1;
  const rot = prop.rotated;
  if (rot && rot.mode !== "overlay") {
    const sharing = groups.get(rot.period);
    if (!sharing || sharing.hasMirrorOrFlip) mult *= rot.period;
    // else: rotation absorbed into the fused stage — x1
  }
  for (const period of groups.keys()) mult *= period;
  if (prop.rewound) mult *= prop.rewound.period;
  return mult;
}

/**
 * True when the wire spec declares INVERTED in "expand" mode (mode absent or
 * "expand") rather than "overlay". Used by the orchestrator's degenerate-seed
 * guard: an expand-mode inversion multiplies length by its period, so a
 * 1-beat half-seed carries no visible pro/anti flip for it to invert (a
 * single beat is dash-only at the seed boundary). Overlay-mode inversion
 * applies in place over the fully-expanded sequence and has no such
 * constraint, so it does not trigger the guard.
 */
export function specHasExpandInversion(wire: LOOPSpecWire): boolean {
  const prop = wire.blue ?? wire.red;
  if (!prop) return false;
  const inverted = prop.inverted;
  return !!inverted && inverted.mode !== "overlay";
}

/**
 * Format a LOOPType string for human-readable UI display.
 */
export function formatLOOPTypeForDisplay(loopType: LOOPType | string): string {
  const readable = loopType
    .replace(/^strict_/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());

  if (readable.length > 20) {
    const parts = readable.split(" ");
    if (parts.length > 2) {
      return `${parts[0]} + ${parts.length - 1} more`;
    }
  }

  return readable;
}
