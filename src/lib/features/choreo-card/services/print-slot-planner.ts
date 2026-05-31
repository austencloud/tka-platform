// src/lib/features/choreo-card/services/print-slot-planner.ts
import type { CardPair } from "./types";
import { TND_ELEMENTS, type TnDElement } from "../domain/tnd-element";

/** One grid cell on a print sheet. `item` null = blank padding cell. `elementName`
 *  is the color of the sheet this slot sits on ("fire", "water", …) or null for
 *  untagged items — used for sheet labels and per-element grouping. Generic over
 *  the cell payload so the SAME planner drives both the PDF exporter (CardPair)
 *  and the on-screen preview (RenderedCard) — guaranteeing preview === print. */
export interface PlannedSlot<T> {
  item: T | null;
  elementName: string | null;
}

/** Back-compat alias for the exporter's pair-typed slots. */
export type PrintSlot = PlannedSlot<CardPair>;

const UNTAGGED = "__untagged__";

/** Group items by element (fixed TND_ELEMENTS order, untagged trailing),
 *  repeat each card `copies` times consecutively (cut-collation: each page holds
 *  a single card repeated, so stacking all pages and cutting yields `copies`
 *  identical sorted decks with zero manual sorting), and pad each color block
 *  with blank slots so its length is a multiple of `cardsPerPage`.
 *
 *  `groupByElement=false` relaxes the one-color-per-sheet rule: items lay out in
 *  their given order, each card repeated `copies` times consecutively, with
 *  blanks padding ONLY the final sheet. elementName is null in this mode. */
export function planPrintSlots<T>(
  items: T[],
  elements: (TnDElement | undefined)[],
  copies: number,
  cardsPerPage: number,
  groupByElement: boolean = true,
): PlannedSlot<T>[] {
  const n = Math.max(1, Math.floor(copies));

  if (!groupByElement) {
    const out: PlannedSlot<T>[] = [];
    for (let i = 0; i < items.length; i++) {
      for (let c = 0; c < n; c++) {
        out.push({ item: items[i]!, elementName: null });
      }
    }
    while (out.length % cardsPerPage !== 0) {
      out.push({ item: null, elementName: null });
    }
    return out;
  }

  const buckets = new Map<string, T[]>();
  for (let i = 0; i < items.length; i++) {
    const key = elements[i]?.element ?? UNTAGGED;
    const bucket = buckets.get(key) ?? [];
    bucket.push(items[i]!);
    buckets.set(key, bucket);
  }

  const order = [...TND_ELEMENTS.map((e) => e.element), UNTAGGED];
  const out: PlannedSlot<T>[] = [];

  for (const key of order) {
    const bucket = buckets.get(key);
    if (!bucket || bucket.length === 0) continue;
    const elementName = key === UNTAGGED ? null : key;

    const repeated: PlannedSlot<T>[] = [];
    for (const p of bucket) {
      for (let c = 0; c < n; c++) repeated.push({ item: p, elementName });
    }
    while (repeated.length % cardsPerPage !== 0) {
      repeated.push({ item: null, elementName });
    }
    out.push(...repeated);
  }

  return out;
}
