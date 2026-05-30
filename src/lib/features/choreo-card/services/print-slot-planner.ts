// src/lib/features/choreo-card/services/print-slot-planner.ts
import type { CardPair } from "./types";
import { TND_ELEMENTS, type TnDElement } from "../domain/tnd-element";

/** One grid cell on a print sheet. `pair` null = blank padding cell. `elementName`
 *  is the color of the sheet this slot sits on ("fire", "water", …) or null for
 *  untagged cards — used for sheet labels and per-element grouping. */
export interface PrintSlot {
  pair: CardPair | null;
  elementName: string | null;
}

const UNTAGGED = "__untagged__";

/** Group pairs by element (fixed TND_ELEMENTS order, untagged trailing),
 *  whole-block-repeat each color `copies` times, and pad each color block with
 *  blank slots so its length is a multiple of `cardsPerPage`. The result is an
 *  ordered slot list in which every page holds exactly one element. */
export function planPrintSlots(
  pairs: CardPair[],
  elements: (TnDElement | undefined)[],
  copies: number,
  cardsPerPage: number,
): PrintSlot[] {
  const n = Math.max(1, Math.floor(copies));

  const buckets = new Map<string, CardPair[]>();
  for (let i = 0; i < pairs.length; i++) {
    const key = elements[i]?.element ?? UNTAGGED;
    const bucket = buckets.get(key) ?? [];
    bucket.push(pairs[i]!);
    buckets.set(key, bucket);
  }

  const order = [...TND_ELEMENTS.map((e) => e.element), UNTAGGED];
  const out: PrintSlot[] = [];

  for (const key of order) {
    const bucket = buckets.get(key);
    if (!bucket || bucket.length === 0) continue;
    const elementName = key === UNTAGGED ? null : key;

    const repeated: PrintSlot[] = [];
    for (let c = 0; c < n; c++) {
      for (const p of bucket) repeated.push({ pair: p, elementName });
    }
    while (repeated.length % cardsPerPage !== 0) {
      repeated.push({ pair: null, elementName });
    }
    out.push(...repeated);
  }

  return out;
}
