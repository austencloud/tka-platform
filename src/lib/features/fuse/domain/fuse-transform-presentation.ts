/**
 * How a Fuse follower rule presents itself: its glyph, and the LOOP primitives
 * it is built from.
 *
 * Every operation Fuse can apply to the follower path IS a LOOP transformation
 * primitive, and those primitives already carry brand colors and glyphs that
 * sequence cards, export headers, and the Extend drawer all render. Fuse used
 * to paint every rule in one accent, so Mirror and Invert looked identical here
 * while looking nothing alike everywhere else.
 *
 * The color VALUES and the glyphs stay owned by loop-option-color.ts and
 * LOOPIconStrip. This module only maps a rule onto the primitives it composes,
 * and onto the two modifiers the icon strip needs to tell same-colour
 * primitives apart — the reflection axis (Mirror vs Flip) and the rotation
 * period.
 */

import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
import type { LoopReflectionAxis } from "@tka/render-composition";
import {
  loopComponentColors,
  loopOptionTint,
} from "$lib/shared/components/loop-picker/loop-option-color";
import type { FuseRule } from "./fuse-rule";

/** Everything LOOPIconStrip needs to draw one rule the canonical way. */
export interface FuseTransformGlyph {
  components: Set<LOOPComponent>;
  reflectionAxis?: LoopReflectionAxis;
  rotationPeriod?: Period;
}

const FALLBACK_ACCENT = "var(--theme-accent, #8b5cf6)";

/**
 * The canonical LOOP glyph for one rule, ready for LOOPIconStrip.
 *
 * `Period` is a LOOP-domain concept with exactly two members, so it cannot name
 * a 45° slice. It is only ever a disambiguator between two rotation glyphs
 * here, and the rotation control states the amount in degrees right beside the
 * glyph, so a half rotation draws as HALVED and every other amount as
 * QUARTERED rather than inventing a Period member Fuse alone would use.
 */
export function fuseRuleGlyph(rule: FuseRule): FuseTransformGlyph {
  const components = new Set<LOOPComponent>();
  let reflectionAxis: LoopReflectionAxis | undefined;
  let rotationPeriod: Period | undefined;

  if (rule.rotationSteps > 0) {
    components.add(LOOPComponent.ROTATED);
    rotationPeriod = rule.rotationSteps === 4 ? Period.HALVED : Period.QUARTERED;
  }
  if (rule.reflect === "mirror") {
    components.add(LOOPComponent.MIRRORED);
    reflectionAxis = "north-south";
  }
  if (rule.reflect === "flip") {
    components.add(LOOPComponent.FLIPPED);
    reflectionAxis = "east-west";
  }
  if (rule.invert) components.add(LOOPComponent.INVERTED);
  if (rule.rewind) components.add(LOOPComponent.REWOUND);

  return { components, reflectionAxis, rotationPeriod };
}

/** Canonical-order colors for one rule. One entry per primitive it composes. */
export function fuseRuleColors(rule: FuseRule): string[] {
  return loopComponentColors(fuseRuleGlyph(rule).components);
}

/**
 * The brand color of ONE primitive, for a control that edits a single axis of
 * the rule — the rotation row, an Invert toggle. The axis wears the same hue
 * its glyph does everywhere else, so the control and the result chain agree.
 */
export function fuseComponentColor(component: LOOPComponent): string {
  return loopComponentColors([component])[0] ?? FALLBACK_ACCENT;
}

/** `--loop-c1/--loop-c2/--loop-c2-mix` for one primitive's own control. */
export function fuseComponentTint(component: LOOPComponent): string {
  return loopOptionTint(loopComponentColors([component]));
}

/** The accent a single-color surface (a token, a glyph) should paint. */
export function fuseRuleAccent(rule: FuseRule): string {
  return fuseRuleColors(rule)[0] ?? FALLBACK_ACCENT;
}

/**
 * The second stop for a composite, or the same color again for a single
 * primitive — the caller decides whether to sweep between them.
 */
export function fuseRuleAccent2(rule: FuseRule): string {
  const colors = fuseRuleColors(rule);
  return colors[colors.length - 1] ?? FALLBACK_ACCENT;
}

/**
 * `--loop-c1/--loop-c2/--loop-c2-mix` for a rule, in the same shape the LOOP
 * option buttons consume, so a Fuse surface can reuse that styling.
 */
export function fuseRuleTint(rule: FuseRule): string {
  return loopOptionTint(fuseRuleColors(rule));
}
