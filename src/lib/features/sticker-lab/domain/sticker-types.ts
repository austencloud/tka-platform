export type StickerVariant = "blue" | "red" | "full";
export type StickerBackground = "transparent" | "white" | "radial-gradient";
export type StickerSize = "3in-round"; // versioned string; Phase 2 may add "2in-round", "5in-round"
export type StickerPresentation = "pure"; // Phase 1 only value; Phase 2 may add "word-label", "qr"
export type SheetSize = "8.5x11" | "13x19";

/** Reference to a LOOP sequence — used as a back-link annotation only. */
export interface LoopRef {
  readonly sequenceId: string;
  readonly word: string;      // denormalized for display
  readonly loopType: string;  // e.g. "rotated-loop", "mirrored-loop"
}

/**
 * Stable content-addressed reference to a mandala primitive shape.
 *
 * Stage A: shapeHash and ultraHash are set to the canonical representative's
 * sequenceId (a proxy hash). Stage B will replace these with geometric SHA-256
 * hashes derived from MandalaCanonicalizer.
 */
export interface MandalaPrimitiveRef {
  /** Hash identifying the shape tier. Stage A: sequenceId proxy. Stage B: geometric SHA-256. */
  readonly shapeHash: string;
  /** Hash identifying the ultra-equivalence class. Stage A: same as shapeHash. */
  readonly ultraHash: string;
  /**
   * Optional back-link to the canonical source LOOP.
   * Present in Stage A catalog; null for future chimera / synthetic primitives.
   */
  readonly sourceLoop?: LoopRef | null;
  /** Human-readable label shown in the picker and list items. */
  readonly displayName?: string;
}

export interface StickerUnit {
  readonly id: string;
  /** Primary identity in v2. References a primitive, not a specific sequence. */
  readonly primitiveRef: MandalaPrimitiveRef;
  /**
   * @deprecated v1 compat field retained only for migration reads.
   * Undefined on v2 stickers. Callers must not rely on it being populated.
   */
  readonly sourceLoop?: LoopRef | null;
  readonly variant: StickerVariant;
  readonly size: StickerSize;
  readonly background: StickerBackground;
  readonly copies: number;
  readonly presentation: StickerPresentation;
}

export interface StickerSheet {
  readonly id: string;
  readonly name: string;
  readonly sheetSize: SheetSize;
  readonly stickers: readonly StickerUnit[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateStickerUnitInput {
  primitiveRef: MandalaPrimitiveRef;
  variant?: StickerVariant;
  background?: StickerBackground;
  copies?: number;
}

export function createDefaultStickerUnit(input: CreateStickerUnitInput): StickerUnit {
  return {
    id: generateId("sticker"),
    primitiveRef: input.primitiveRef,
    variant: input.variant ?? "full",
    size: "3in-round",
    background: input.background ?? "transparent",
    copies: input.copies ?? 1,
    presentation: "pure",
  };
}

export function createDefaultStickerSheet(): StickerSheet {
  const now = Date.now();
  return {
    id: generateId("sheet"),
    name: "My Sheet",
    sheetSize: "8.5x11",
    stickers: [],
    createdAt: now,
    updatedAt: now,
  };
}
