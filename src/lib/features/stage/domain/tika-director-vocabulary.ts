import { z } from "zod";

/**
 * Words every TIKA verb shares. A leaf module: capability descriptors import
 * it, and the schema root re-exports it, so neither has to import the other.
 */
export const TIKA_DIRECTOR_FORMATIONS = [
  "line",
  "triangle",
  "diamond",
  "circle",
  "v-shape",
  "grid",
  "grid-2x2",
  "stagger",
  "cluster",
  "diagonal",
  "solo",
  "tunnel-stack",
  "back-to-back",
  "facing-each-other",
  "stage-lr",
  "side-by-side",
] as const;

export const TikaDirectorFormationSchema = z.enum(TIKA_DIRECTOR_FORMATIONS);

/** Product-assigned look labels; see shared/3d/config/character-presentation. */
export const TIKA_DIRECTOR_PRESENTATIONS = [
  "masculine",
  "feminine",
  "androgynous",
] as const;
export const TikaDirectorPresentationSchema = z.enum(
  TIKA_DIRECTOR_PRESENTATIONS
);

export type TikaDirectorFormation = z.infer<typeof TikaDirectorFormationSchema>;
export type TikaDirectorPresentation = z.infer<
  typeof TikaDirectorPresentationSchema
>;
