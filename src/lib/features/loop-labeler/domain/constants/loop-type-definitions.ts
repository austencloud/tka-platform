import type { ComponentId } from "./loop-components";

export interface LoopTypeDefinition {
  readonly id: string;
  readonly targets: readonly string[];
  readonly components: readonly ComponentId[];
  readonly extractDirection?: boolean;
}

export const LOOP_TYPE_DEFINITIONS: readonly LoopTypeDefinition[] = [
  // Singles
  { id: "rotated",   targets: ["rotated_90_cw", "rotated_90_ccw", "rotated_180"], components: ["rotated"], extractDirection: true },
  { id: "mirrored",  targets: ["mirrored"],  components: ["mirrored"] },
  { id: "flipped",   targets: ["flipped"],   components: ["flipped"] },
  { id: "swapped",   targets: ["swapped"],   components: ["swapped"] },
  { id: "inverted",  targets: ["inverted"],  components: ["inverted"] },
  { id: "repeated",  targets: ["repeated"],  components: ["repeated"] },

  // Doubles
  { id: "rotated_inverted",  targets: ["rotated_90_cw_inverted", "rotated_90_ccw_inverted", "rotated_180_inverted"], components: ["rotated", "inverted"], extractDirection: true },
  { id: "mirrored_inverted", targets: ["mirrored_inverted"], components: ["mirrored", "inverted"] },
  { id: "flipped_inverted",  targets: ["flipped_inverted"],  components: ["flipped", "inverted"] },
  { id: "rotated_swapped",   targets: ["rotated_90_cw_swapped", "rotated_90_ccw_swapped", "rotated_180_swapped"], components: ["rotated", "swapped"], extractDirection: true },
  { id: "mirrored_swapped",  targets: ["mirrored_swapped"], components: ["mirrored", "swapped"] },
  { id: "flipped_swapped",   targets: ["flipped_swapped"],  components: ["flipped", "swapped"] },
  { id: "swapped_inverted",  targets: ["swapped_inverted"], components: ["swapped", "inverted"] },

  // Triples
  { id: "rotated_swapped_inverted",  targets: ["rotated_90_cw_swapped_inverted", "rotated_90_ccw_swapped_inverted", "rotated_180_swapped_inverted"], components: ["rotated", "swapped", "inverted"], extractDirection: true },
  { id: "mirrored_swapped_inverted", targets: ["mirrored_swapped_inverted"], components: ["mirrored", "swapped", "inverted"] },
  { id: "flipped_swapped_inverted",  targets: ["flipped_swapped_inverted"],  components: ["flipped", "swapped", "inverted"] },
] as const;

export const ALL_DEFINITION_TARGETS: ReadonlySet<string> = new Set(
  LOOP_TYPE_DEFINITIONS.flatMap(d => [...d.targets])
);
