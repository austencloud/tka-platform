// Lookup tables derived from the canonical codex structure.
//
// codex-groups.ts owns the sheets, the boxes and the derived transitions. This
// module only flattens them into "given a letter id, what do I say about it",
// which every board and the inspector need for labels and captions. It adds no
// facts of its own.

import {
  SHEET1,
  SHEET2,
  transitionFor,
  type CodexBoxDef,
  type CodexTypeDef,
} from "../../../guide/codex/_data/codex-groups";

export interface CodexLetterInfo {
  id: string;
  label: string;
  name?: string;
  typeNumber: number;
  typeName: string;
  /** The type's own accent from the printed sheets. */
  typeColor: string;
  transition: string;
}

export const CODEX_TYPES: CodexTypeDef[] = [...SHEET1.types, ...SHEET2.types];

export function typeName(type: CodexTypeDef): string {
  return `${type.word}${type.segs.map((s) => s.t).join("")}`;
}

/** The last coloured segment is the type's distinguishing word, so its colour
 *  is the one that reads as "this type" (Type 1 is Dual-Shift: purple Shift). */
export function typeColor(type: CodexTypeDef): string {
  return type.segs.at(-1)?.c ?? "currentColor";
}

export const CODEX_LETTERS = new Map<string, CodexLetterInfo>();
for (const type of CODEX_TYPES) {
  for (const box of type.boxes) {
    for (const cell of box.cells) {
      if (CODEX_LETTERS.has(cell.id)) continue;
      CODEX_LETTERS.set(cell.id, {
        id: cell.id,
        label: cell.label,
        name: cell.name,
        typeNumber: type.n,
        typeName: typeName(type),
        typeColor: typeColor(type),
        transition: transitionFor(cell.id),
      });
    }
  }
}

export const CODEX_BY_LABEL = new Map(
  [...CODEX_LETTERS.values()].map((info) => [info.label, info])
);

/** Every box in sheet order, tagged with the type it belongs to. The flat
 *  boards (Atlas, Wall) flow these; the Sheets board never needs it because
 *  CodexSheet already owns that arrangement. */
export interface TaggedBox {
  box: CodexBoxDef;
  type: CodexTypeDef;
  key: string;
}

export const CODEX_BOXES: TaggedBox[] = CODEX_TYPES.flatMap((type) =>
  type.boxes.map((box, i) => ({ box, type, key: `${type.n}-${i}` }))
);

export function cellCount(box: CodexBoxDef): number {
  return box.cells.length;
}
