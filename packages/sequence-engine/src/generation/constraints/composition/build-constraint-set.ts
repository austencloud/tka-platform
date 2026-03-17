/**
 * Compositional Constraint Builder
 *
 * Single entry point for converting structured ConstraintOptions into a ConstraintSet.
 * All three constraint paths (structured, presets, NL parsing) funnel through here.
 */

import type { ConstraintSet, IConstraint } from "../types.js";
import type { ConstraintOptions } from "./constraint-options.js";
import { MotionTypeConstraint } from "../style/motion-type-constraint.js";
import { RotationDirectionConstraint } from "../style/rotation-direction-constraint.js";
import { ContinuityConstraint } from "../style/continuity-constraint.js";
import { ReversalConstraint } from "../style/reversal-constraint.js";
import {
  HandPathReversalConstraint,
  maximizeHandPathContinuity,
} from "../style/hand-path-constraint.js";
import { TurnConstraint } from "../style/turn-constraint.js";

export function buildConstraintSet(options: ConstraintOptions): ConstraintSet {
  const hard: IConstraint[] = [];
  const soft: IConstraint[] = [];

  // Motion type dimension
  if (options.motionType && options.motionType !== "any") {
    hard.push(
      new MotionTypeConstraint({
        motionType: options.motionType,
        hand: "both",
        mode: "require",
      })
    );
  }

  // Rotation direction dimension
  if (options.rotationDirection && options.rotationDirection !== "any") {
    hard.push(
      new RotationDirectionConstraint({
        direction: options.rotationDirection,
        hand: "both",
        mode: "require",
      })
    );
  }

  // Turn value dimension
  if (options.turns !== undefined && options.turns !== "any") {
    hard.push(new TurnConstraint(options.turns));
  }

  // Motion family include/exclude
  if (options.motionFamily) {
    if (options.motionFamily.exclude) {
      for (const family of options.motionFamily.exclude) {
        hard.push(
          new MotionTypeConstraint({
            motionType: family,
            hand: "both",
            mode: "exclude",
          })
        );
      }
    }
    if (options.motionFamily.include) {
      // "include: ['shift']" means exclude everything EXCEPT shift
      const allFamilies: ("shift" | "dash" | "static")[] = ["shift", "dash", "static"];
      const excluded = allFamilies.filter(f => !options.motionFamily!.include!.includes(f));
      for (const family of excluded) {
        hard.push(
          new MotionTypeConstraint({
            motionType: family,
            hand: "both",
            mode: "exclude",
          })
        );
      }
    }
  }

  // Prop continuity dimension
  if (options.propContinuity) {
    switch (options.propContinuity) {
      case "maximize":
        soft.push(new ContinuityConstraint("maximize"));
        break;
      case "force-reversals":
        soft.push(new ReversalConstraint("every"));
        break;
      case "allow-reversals":
        // No constraint — allow whatever happens naturally
        break;
    }
  }

  // Hand path continuity dimension
  if (options.handPathContinuity) {
    switch (options.handPathContinuity) {
      case "maximize":
        soft.push(maximizeHandPathContinuity());
        break;
      case "force-reversals":
        soft.push(new HandPathReversalConstraint("every"));
        break;
      case "allow-reversals":
        break;
    }
  }

  return { hard, soft };
}
