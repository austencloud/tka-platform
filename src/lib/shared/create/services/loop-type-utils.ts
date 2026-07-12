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
