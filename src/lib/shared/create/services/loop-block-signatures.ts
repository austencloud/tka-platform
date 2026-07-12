/**
 * Per-block transform signatures for the LOOP block timeline.
 *
 * Mirrors the engine's canonical stage semantics (spec-executor.ts):
 * fused expand-groups (mirror/flip/swap-containing before invert-only,
 * ascending period; same-period components share ONE group), then overlay
 * components partition the final sequence. Rotation is continuous/innermost
 * and is reported as a ribbon, not a per-cell signature.
 */
import type { LOOPSpecWire } from "@tka/sequence-engine/loop";

export interface BlockTimelineModel {
  /** One Set of component ids per display cell, in sequence order. */
  cells: Array<Set<string>>;
  /** Present when the spec rotates (expand mode). */
  rotation?: { interval: number };
}

const FUSEABLE = ["mirrored", "flipped", "swapped", "inverted"] as const;

export function blockSignatures(wire: LOOPSpecWire): BlockTimelineModel {
  const prop = wire.blue ?? wire.red;
  if (!prop) return { cells: [new Set()] };

  // Group expand-mode fuseables by period (same rule as expanderMultiplier).
  const groups = new Map<number, Set<string>>();
  for (const comp of FUSEABLE) {
    const cSpec = prop[comp];
    if (!cSpec || cSpec.mode === "overlay") continue;
    const g = groups.get(cSpec.period) ?? new Set<string>();
    g.add(comp);
    groups.set(cSpec.period, g);
  }

  // Canonical order: mirror/flip/swap-containing groups first, invert-only last;
  // ascending period within each class.
  const ordered = [...groups.entries()].sort(([pa, ca], [pb, cb]) => {
    const invOnlyA = ca.has("inverted") && ca.size === 1 ? 1 : 0;
    const invOnlyB = cb.has("inverted") && cb.size === 1 ? 1 : 0;
    if (invOnlyA !== invOnlyB) return invOnlyA - invOnlyB;
    return pa - pb;
  });

  let cells: Array<Set<string>> = [new Set()];
  for (const [period, comps] of ordered) {
    const next: Array<Set<string>> = [];
    for (let rep = 0; rep < period; rep++) {
      for (const cell of cells) {
        const copy = new Set(cell);
        if (rep % 2 === 1) for (const c of comps) copy.add(c);
        next.push(copy);
      }
    }
    cells = next;
  }

  // Overlay components partition the FINAL sequence into `period` blocks.
  for (const comp of FUSEABLE) {
    const cSpec = prop[comp];
    if (!cSpec || cSpec.mode !== "overlay") continue;
    const p = cSpec.period;
    const n = lcm(cells.length, p);
    if (n !== cells.length) {
      const scale = n / cells.length;
      cells = cells.flatMap((cell) => Array.from({ length: scale }, () => new Set(cell)));
    }
    const blockSize = cells.length / p;
    cells = cells.map((cell, i) => {
      if (Math.floor(i / blockSize) % 2 === 1) {
        const copy = new Set(cell);
        copy.add(comp);
        return copy;
      }
      return cell;
    });
  }

  const rot = prop.rotated;
  return {
    cells,
    ...(rot && rot.mode !== "overlay" ? { rotation: { interval: rot.period } } : {}),
  };
}

function lcm(a: number, b: number): number {
  const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
  return (a * b) / gcd(a, b);
}
