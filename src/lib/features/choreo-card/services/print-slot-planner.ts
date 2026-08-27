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
  /** Zero-based occurrence of this card within the requested copy count.
   *  Null for blank padding slots. Physical-card serialization uses this to
   *  bind each printed occurrence to its allocated ID. */
  copyIndex: number | null;
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
 *  blanks padding ONLY the final sheet. elementName is null in this mode.
 *
 *  `firstOnTop`: the LAST real card drawn lands on top of the printed/cut stack,
 *  so forward order puts the deck's LAST card on top. `firstOnTop=true` reverses
 *  the card sequence (elements kept index-parallel) so the deck's FIRST card is
 *  drawn last → ends up on top. Reversal happens BEFORE copy-expansion and
 *  blank-padding, so each card's N copies stay consecutive and blanks still trail
 *  each color block / the final sheet. `elements` must be parallel to `items`
 *  (or empty). In grouped mode the fixed TND_ELEMENTS block order is unchanged;
 *  only the card order WITHIN each color reverses. */
export function planPrintSlots<T>(
  items: T[],
  elements: (TnDElement | undefined)[],
  copies: number,
  cardsPerPage: number,
  groupByElement: boolean = true,
  firstOnTop: boolean = false,
): PlannedSlot<T>[] {
  const n = Math.max(1, Math.floor(copies));

  const orderedItems = firstOnTop ? [...items].reverse() : items;
  // Reverse against items.length (not elements.length) so an empty/partial
  // elements array stays index-aligned to the reversed items; out-of-range → undefined → UNTAGGED.
  const orderedElements = firstOnTop
    ? items.map((_, i) => elements[items.length - 1 - i])
    : elements;

  if (!groupByElement) {
    const out: PlannedSlot<T>[] = [];
    for (let i = 0; i < orderedItems.length; i++) {
      for (let c = 0; c < n; c++) {
        out.push({
          item: orderedItems[i]!,
          elementName: null,
          copyIndex: c,
        });
      }
    }
    while (out.length % cardsPerPage !== 0) {
      out.push({ item: null, elementName: null, copyIndex: null });
    }
    return out;
  }

  const buckets = new Map<string, T[]>();
  for (let i = 0; i < orderedItems.length; i++) {
    const key = orderedElements[i]?.element ?? UNTAGGED;
    const bucket = buckets.get(key) ?? [];
    bucket.push(orderedItems[i]!);
    buckets.set(key, bucket);
  }

  const order = [...TND_ELEMENTS.map((e) => e.element), UNTAGGED];
  // firstOnTop must reverse the WHOLE authored sequence, not just within each
  // color: the first authored block has to be drawn LAST (on top of the stack),
  // so emit the color blocks in reversed order too. Combined with the reversed
  // input above (which reverses card order within each block), the flat real-card
  // draw order becomes the exact reverse of the forward order → the cut stack
  // reads the authored order top-to-bottom across ALL families.
  const emitOrder = firstOnTop ? [...order].reverse() : order;
  const out: PlannedSlot<T>[] = [];

  for (const key of emitOrder) {
    const bucket = buckets.get(key);
    if (!bucket || bucket.length === 0) continue;
    const elementName = key === UNTAGGED ? null : key;

    const repeated: PlannedSlot<T>[] = [];
    for (const p of bucket) {
      for (let c = 0; c < n; c++) {
        repeated.push({ item: p, elementName, copyIndex: c });
      }
    }
    while (repeated.length % cardsPerPage !== 0) {
      repeated.push({ item: null, elementName, copyIndex: null });
    }
    out.push(...repeated);
  }

  return out;
}
