export type LoopComponent =
  | "rotated"
  | "mirrored"
  | "flipped"
  | "swapped"
  | "inverted"
  | "rewound";

export interface LoopBaseComponent {
  description: string;
  keyInsight?: string;
  distinctionFromRotated?: string;
  axis?: string;
  effect?: string;
  note?: string;
  variants?: Record<string, {
    sliceSize: string;
    pattern: string;
    mentalModel: string;
  }>;
}

export interface CompoundLoopType {
  components: LoopComponent[];
}
