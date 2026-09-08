/**
 * The site tree layout: which species stands where at Kinetic Fire.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `flow-fest-forest-ecology.ts` decides WHERE trees stand, from the LiDAR
 * canopy return. `flow-fest-tree-species.ts` describes WHAT each species looks
 * like as ez-tree parameters. Neither knows the site. This module is the third
 * thing: Austen's own account of what the woods are DOING in each part of the
 * property, expressed as the per-instance species seam the catalog left open.
 *
 * Everything here traces to the 2026-09-03 section-by-section labeling
 * interview, recorded in
 * `docs/superpowers/specs/flow-fest-sim/site-labels-interview.md`. Where the
 * interview has no opinion the plan returns `null` and the ecology's habitat
 * casting takes over, which is most of the property — the north and west woods
 * are backdrop and stay ordinary.
 *
 * WHAT THIS MODULE CANNOT DO
 * --------------------------
 * It cannot add, move, or remove a tree. Placement is measured. So a zone whose
 * ground truth is "there is nothing here" needs no entry: the fire field and
 * the mown upper clearing are already bare in the canopy raster, and
 * `tests/unit/flow-fest-site-ground-truth.test.ts` fails loudly if that ever
 * stops being true. What this module changes is CHARACTER — the difference
 * between a wall of woods and a park of spreading specimens is which form
 * renders, not how many trunks there are.
 *
 * It also cannot set the visible clear bole. `trunkHeightMeters` on an
 * assignment is the COLLISION cylinder; the bole you see is baked into the
 * generated family. So bole character is chosen through the form, never
 * overridden per instance, and this plan supplies no trunk heights.
 */

import type {
  FlowFestTreeSpeciesAssignment,
  FlowFestTreeSpeciesPlan,
  FlowFestTreeSpeciesQuery,
} from "./flow-fest-tree-species";
import {
  distanceToFlowFestPolygon,
  distanceToFlowFestPolyline,
  FLOW_FEST_CAMPGROUND_LOOP,
  FLOW_FEST_DECORATED_PATHWAY,
  FLOW_FEST_PATHWAY_HALF_WIDTH_METERS,
  FLOW_FEST_TREELINE_DEPTH_METERS,
  insideFlowFestPolygon,
} from "./flow-fest-site-geometry";

/**
 * The campground treeline. Austen, asked what it looks like: "a dense wall of
 * woods" — not open-grown spreading specimens. The hammock and slackline trees
 * everyone competes for are simply the first few trunks of that wall where it
 * faces the field, so they are the same forms, not a separate ornamental pool.
 *
 * These are the four closed-stand forms with the highest clear-bole ratios and
 * the narrowest crowns in the catalog: walnut and hickory carry the bole
 * (0.38 of height), beech and sugar maple are the shade-tolerant pair that
 * actually closes a canopy in this region. Nothing open-grown is eligible,
 * which is the whole point — habitat casting reads a woodland EDGE as a light
 * gap and would otherwise hand this exact band the wide-crowned open forms.
 */
const CAMPGROUND_TREELINE_FORMS = [
  "black-walnut-stand",
  "shagbark-hickory-stand",
  "american-beech-stand",
  "sugar-maple-stand",
] as const;

/**
 * Inside the loop. Austen first called it "wide open, no trees", then
 * confirmed against the overlay that all twelve interior trees are real: "I
 * was speaking loosely. Those trees exist, you just don't get to camp under
 * them." So it carries a genuine stand wrapped around the main building. That
 * it is not campable is a rule the festival enforces, not a shape a tree has.
 */
const LOOP_INTERIOR_FORMS = [
  "white-oak-stand",
  "sugar-maple-stand",
  "american-beech-stand",
  "shagbark-hickory-stand",
] as const;

/**
 * The decorated pathway between the campground and Middle Earth. Austen, on
 * its canopy: "dappled and patchy" — explicitly not a closed tunnel. Gaps of
 * sky along its length are correct.
 *
 * The plan cannot thin the stand, so it does the one thing it can: casts the
 * three narrowest crowns available (hickory 0.23, white oak 0.27, hophornbeam
 * 0.29 of height) and keeps out the two forms that would roof it — boxelder at
 * 0.46, and beech, whose whole ecological signature is casting deep shade.
 */
const DECORATED_PATHWAY_FORMS = [
  "shagbark-hickory-stand",
  "hophornbeam-understory",
  "white-oak-stand",
] as const;

/**
 * Standing dead wood is habitat punctuation the ecology rolls for at 1.2% and
 * this plan would otherwise suppress everywhere it has an opinion. Kept at the
 * same rate so an opinionated zone does not read as a tidier woodland than the
 * one next to it.
 */
const SNAG_RATE = 0.012;

/**
 * A stable hash of a world position. Two trees a metre apart must land on
 * different forms, and the same tree must land on the same form across
 * derivations, so this cannot use the ecology's placement index — infill
 * renumbers when the canopy gate changes.
 */
function positionHash(x: number, z: number): number {
  let hash = 0x811c9dc5;
  const bytes = new Uint8Array(Float64Array.of(x, z).buffer);
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index]!;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
}

function pick(
  forms: readonly string[],
  hash: number
): FlowFestTreeSpeciesAssignment {
  if (hash < SNAG_RATE) return { speciesId: "standing-snag" };
  const spread = (hash - SNAG_RATE) / (1 - SNAG_RATE);
  const index = Math.min(forms.length - 1, Math.floor(spread * forms.length));
  return { speciesId: forms[index]! };
}

/**
 * Resolution order is most-specific-first, because the zones touch: the
 * pathway's east end IS the loop road, and Austen's statement about the
 * treeline is the more specific of the two. A tree that falls in neither zone
 * gets no opinion.
 */
function resolveSiteSpecies(
  query: FlowFestTreeSpeciesQuery
): FlowFestTreeSpeciesAssignment | null {
  const { x, z } = query;
  const hash = positionHash(x, z);

  if (insideFlowFestPolygon(x, z, FLOW_FEST_CAMPGROUND_LOOP)) {
    return pick(LOOP_INTERIOR_FORMS, hash);
  }

  if (
    distanceToFlowFestPolygon(x, z, FLOW_FEST_CAMPGROUND_LOOP) <=
    FLOW_FEST_TREELINE_DEPTH_METERS
  ) {
    return pick(CAMPGROUND_TREELINE_FORMS, hash);
  }

  if (
    distanceToFlowFestPolyline(x, z, FLOW_FEST_DECORATED_PATHWAY) <=
    FLOW_FEST_PATHWAY_HALF_WIDTH_METERS
  ) {
    return pick(DECORATED_PATHWAY_FORMS, hash);
  }

  return null;
}

/**
 * Hand this to `deriveFlowFestForestEcology(..., { speciesPlan })`. It is
 * stateless and deterministic, so two derivations of the same site agree.
 */
export const FLOW_FEST_SITE_TREE_LAYOUT: FlowFestTreeSpeciesPlan = {
  resolve: resolveSiteSpecies,
};
