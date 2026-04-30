export type PinnableContentType =
  | "sequence"
  | "collection"
  | "act"
  | "composition"
  | "mandala";

export interface PinnedItem {
  readonly type: PinnableContentType;
  readonly id: string;
}
