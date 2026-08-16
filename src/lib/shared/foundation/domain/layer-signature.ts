/**
 * Layer signature — the orientation shape of a sequence, step by step.
 *
 * At any moment each prop is either RADIAL (pointing in or out along the line
 * from the centre) or NON-RADIAL (lying across it, clock or counter). Take both
 * props together and there are four combinations, and Austen has called them
 * "layers" since long before this file existed:
 *
 *   layer 1  both props radial
 *   layer 2  both props non-radial
 *   layer 3  blue radial, red non-radial
 *   layer 4  blue non-radial, red radial
 *
 * Read one layer per step and you get a string like `1233341112333411` — the
 * sequence's layer signature.
 *
 * The rules themselves live in the engine, next to the orientation calculator
 * that defines them, because the sequence builder needs them too: knowing which
 * turn values flip a prop is what lets it aim at a signature instead of rolling
 * one at random. This file is the app-side door to that module, so anything in
 * `src/` can keep importing a short path.
 *
 * The arrow renderer has known about layers for years — it picks a different
 * placement dataset per layer (`from_layer1`, `from_layer3_blue1_red2`, and
 * friends in special-placement-ori-key-generator.ts). What is new is treating
 * the layer of the WHOLE SEQUENCE as something you can measure, compare, sort
 * by, and ask the generator for.
 */

export {
  orientationClass,
  isRadialOrientation,
  layerOf,
  collapseLayer,
  layerClassDelta,
  flipsLayer,
  flipVectorOf,
  applyFlip,
  flipBetween,
  layerSignature,
  layerPatternOf,
  signatureFromPattern,
  patternFromSignature,
  isLayerClosed,
  mirrorPattern,
  layerMetrics,
  signaturePeriod,
  formatSignature,
  formatPattern,
  parsePattern,
  parseSignature,
} from "@tka/sequence-engine/core";

export type {
  LayerId,
  CollapsedLayerId,
  FlipVector,
  LayerPattern,
  LayerMetrics,
  LayerMotionInput,
  LayerStepInput,
} from "@tka/sequence-engine/core";
