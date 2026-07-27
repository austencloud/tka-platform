/**
 * Constraint Patterns
 *
 * Pattern definitions for parsing natural language constraint specifications.
 * Each pattern describes how to recognize and build a constraint from text.
 */

import { ConstraintType } from "../constraint-types.js";
import type { IConstraint } from "../types.js";
import { ContinuityConstraint } from "../style/continuity-constraint.js";
import {
  MotionTypeConstraint,
  type HandTarget,
} from "../style/motion-type-constraint.js";
import { RotationDirectionConstraint } from "../style/rotation-direction-constraint.js";
import { ReversalConstraint } from "../style/reversal-constraint.js";
import { DashPreferenceConstraint, DashAvoidanceConstraint } from "../style/dash-preference-constraint.js";
import {
  PerHandDashConstraint,
  type HandTarget as PerHandTarget,
} from "../style/per-hand-dash-constraint.js";
import { HandPathReversalConstraint } from "../style/hand-path-constraint.js";
import { containsConcept, canonicalize } from "./synonyms.js";

/**
 * A pattern that can match natural language and build a constraint.
 */
export interface ConstraintPattern {
  /** Pattern identifier for debugging */
  id: string;

  /** Constraint type this pattern produces */
  type: ConstraintType;

  matches(text: string): boolean;

  build(text: string): IConstraint;

  /** Human-readable description of this pattern */
  description: string;
}


const maximizeContinuityPattern: ConstraintPattern = {
  id: "maximize-continuity",
  type: ConstraintType.CONTINUITY,
  description: "Maximize flow/continuity (minimize reversals)",
  matches(text: string): boolean {
    // "maximize continuity", "smooth flow", "continuous", "no breaks"
    if (containsConcept(text, "continuity")) {
      return containsConcept(text, "maximize") || !containsConcept(text, "minimize");
    }
    // "maximize flow"
    if (containsConcept(text, "maximize") && containsConcept(text, "continuity")) {
      return true;
    }
    // "smooth", "flowing" alone implies maximize
    const smoothTerms = ["smooth", "flowing", "seamless"];
    for (const term of smoothTerms) {
      if (text.toLowerCase().includes(term)) {
        return true;
      }
    }
    return false;
  },
  build(_text: string): IConstraint {
    return new ContinuityConstraint("maximize");
  },
};

const enforceContinuityPattern: ConstraintPattern = {
  id: "enforce-continuity",
  type: ConstraintType.CONTINUITY,
  description: "Require perfect continuity (no reversals allowed)",
  matches(text: string): boolean {
    // "no reversals", "never reverse", "require continuous"
    if (containsConcept(text, "reversal") && containsConcept(text, "exclude")) {
      return true;
    }
    if (containsConcept(text, "require") && containsConcept(text, "continuity")) {
      return true;
    }
    return false;
  },
  build(_text: string): IConstraint {
    return new ContinuityConstraint("enforce");
  },
};


const maximizeDashesPattern: ConstraintPattern = {
  id: "maximize-dashes",
  type: ConstraintType.MOTION_TYPE,
  description: "Maximize dash motions over shifts (prefer Type 4/5 letters)",
  matches(text: string): boolean {
    // "maximize dashes", "more dashes", "prefer dashes", "use dashes"
    // "as many dashes as possible", "favor dashes"
    if (!containsConcept(text, "dash")) {
      return false;
    }
    // Check for maximize-style language
    if (containsConcept(text, "maximize")) {
      return true;
    }
    // "as many X as possible" pattern
    if (text.toLowerCase().includes("as many") && text.toLowerCase().includes("as possible")) {
      return true;
    }
    // "use dashes", "favor dashes" (but not "no dashes")
    if (!containsConcept(text, "exclude")) {
      const useTerms = ["use", "favor", "favour", "prefer", "more"];
      for (const term of useTerms) {
        if (text.toLowerCase().includes(term)) {
          return true;
        }
      }
    }
    return false;
  },
  build(text: string): IConstraint {
    // Determine mode based on strength of language
    if (text.toLowerCase().includes("only") || text.toLowerCase().includes("require")) {
      return new DashPreferenceConstraint("require");
    }
    if (text.toLowerCase().includes("prefer") && !text.toLowerCase().includes("maximize")) {
      return new DashPreferenceConstraint("prefer");
    }
    // Default to maximize for strongest dash selection
    return new DashPreferenceConstraint("maximize");
  },
};

const requireDashesPattern: ConstraintPattern = {
  id: "require-dashes",
  type: ConstraintType.MOTION_TYPE,
  description: "Require at least one dash motion per step",
  matches(text: string): boolean {
    if (!containsConcept(text, "dash")) {
      return false;
    }
    return containsConcept(text, "require") || text.toLowerCase().includes("must");
  },
  build(_text: string): IConstraint {
    return new DashPreferenceConstraint("require");
  },
};

const minimizeDashesPattern: ConstraintPattern = {
  id: "minimize-dashes",
  type: ConstraintType.MOTION_TYPE,
  description: "Minimize dash motions - prefer shifts",
  matches(text: string): boolean {
    // "minimize dashes", "fewer dashes", "avoid dashes", "less dashes"
    if (!containsConcept(text, "dash")) {
      return false;
    }
    // Check for minimize-style language
    if (containsConcept(text, "minimize")) {
      return true;
    }
    // "as few X as possible" pattern
    if (text.toLowerCase().includes("as few") && text.toLowerCase().includes("as possible")) {
      return true;
    }
    // "avoid dashes", "fewer dashes", "less dashes" (but not "no dashes" which uses exclude)
    if (!containsConcept(text, "maximize") && !containsConcept(text, "require")) {
      const avoidTerms = ["avoid", "fewer", "less", "reduce", "limit"];
      for (const term of avoidTerms) {
        if (text.toLowerCase().includes(term)) {
          return true;
        }
      }
    }
    return false;
  },
  build(text: string): IConstraint {
    // Determine mode based on strength of language
    if (text.toLowerCase().includes("never") || text.toLowerCase().includes("forbid")) {
      return new DashAvoidanceConstraint("forbid");
    }
    if (text.toLowerCase().includes("avoid")) {
      return new DashAvoidanceConstraint("avoid");
    }
    // Default to minimize for strongest shift preference
    return new DashAvoidanceConstraint("minimize");
  },
};


/**
 * Examples:
 * - "blue hand lots of dashes" / "left hand maximize dashes"
 * - "red hand minimize dashes" / "right hand few dashes"
 * - "blue hand should dash, red hand should shift"
 */

function detectPerHandDash(text: string): { hand: PerHandTarget; mode: "maximize" | "minimize" } | null {
  const lower = text.toLowerCase();

  // Detect which hand
  let hand: PerHandTarget | null = null;
  if (containsConcept(text, "blue") && !containsConcept(text, "red")) {
    hand = "blue";
  } else if (containsConcept(text, "red") && !containsConcept(text, "blue")) {
    hand = "red";
  }

  if (!hand) {
    return null;
  }

  // Must mention dash in context of this hand
  if (!containsConcept(text, "dash")) {
    return null;
  }

  // Detect mode
  const maximizeTerms = ["lots", "many", "more", "maximize", "max", "favor", "should dash"];
  const minimizeTerms = ["few", "less", "fewer", "minimize", "min", "avoid", "should shift", "no dash"];

  let isMaximize = false;
  let isMinimize = false;

  for (const term of maximizeTerms) {
    if (lower.includes(term)) {
      isMaximize = true;
      break;
    }
  }

  for (const term of minimizeTerms) {
    if (lower.includes(term)) {
      isMinimize = true;
      break;
    }
  }

  if (isMaximize && !isMinimize) {
    return { hand, mode: "maximize" };
  }
  if (isMinimize && !isMaximize) {
    return { hand, mode: "minimize" };
  }

  return null;
}

const perHandDashMaximizePattern: ConstraintPattern = {
  id: "per-hand-dash-maximize",
  type: ConstraintType.MOTION_TYPE,
  description: "Maximize dashes for a specific hand",
  matches(text: string): boolean {
    const result = detectPerHandDash(text);
    return result !== null && result.mode === "maximize";
  },
  build(text: string): IConstraint {
    const result = detectPerHandDash(text);
    // Default to blue if detection fails (shouldn't happen since matches passed)
    return new PerHandDashConstraint(result?.hand ?? "blue", "maximize");
  },
};

const perHandDashMinimizePattern: ConstraintPattern = {
  id: "per-hand-dash-minimize",
  type: ConstraintType.MOTION_TYPE,
  description: "Minimize dashes for a specific hand",
  matches(text: string): boolean {
    const result = detectPerHandDash(text);
    return result !== null && result.mode === "minimize";
  },
  build(text: string): IConstraint {
    const result = detectPerHandDash(text);
    return new PerHandDashConstraint(result?.hand ?? "red", "minimize");
  },
};


function createMotionTypePattern(
  motionType: string,
  mode: "require" | "prefer" | "exclude"
): ConstraintPattern {
  const modeVerb = mode === "require" ? "only" : mode === "prefer" ? "prefer" : "no";
  return {
    id: `${mode}-${motionType}`,
    type: ConstraintType.MOTION_TYPE,
    description: `${modeVerb} ${motionType} motions`,
    matches(text: string): boolean {
      if (!containsConcept(text, motionType)) {
        return false;
      }

      switch (mode) {
        case "require":
          // "all pro", "only pro", "pro only", "pure pro"
          return (
            containsConcept(text, "require") ||
            text.toLowerCase().includes("only") ||
            text.toLowerCase().includes("all") ||
            text.toLowerCase().includes("pure")
          );
        case "prefer":
          // "prefer pro", "more pro"
          return containsConcept(text, "maximize");
        case "exclude":
          // "no pro", "no dash", "without static"
          return containsConcept(text, "exclude");
      }
    },
    build(text: string): IConstraint {
      const hand = detectHand(text);
      return new MotionTypeConstraint({
        motionType: canonicalize(motionType),
        hand,
        mode,
      });
    },
  };
}


function createRotationPattern(direction: string): ConstraintPattern {
  return {
    id: `rotation-${direction}`,
    type: ConstraintType.ROTATION_DIRECTION,
    description: `${direction} rotation direction`,
    matches(text: string): boolean {
      return containsConcept(text, direction);
    },
    build(text: string): IConstraint {
      const hand = detectHand(text);
      const require = containsConcept(text, "require") ||
                      text.toLowerCase().includes("only") ||
                      text.toLowerCase().includes("all");
      return new RotationDirectionConstraint({
        direction: canonicalize(direction) as "cw" | "ccw",
        hand,
        mode: require ? "require" : "prefer",
      });
    },
  };
}


/**
 * Detects hand path constraints from natural language.
 * Hand path = how the hand travels around the grid (cw/ccw)
 * This is distinct from prop rotation direction.
 *
 * Examples:
 * - "no handpath reversals" / "no hand path reversals"
 * - "maximize hand continuity" / "smooth hand paths"
 * - "hand reversal every step"
 * - "allow handpath reversals but no prop reversals"
 */

const maximizeHandPathContinuityPattern: ConstraintPattern = {
  id: "maximize-hand-path-continuity",
  type: ConstraintType.HAND_PATH,
  description: "Maximize hand path continuity (minimize handpath reversals)",
  matches(text: string): boolean {
    // Must mention hand path or hand reversal concept
    if (!containsConcept(text, "handpath")) {
      return false;
    }
    // "maximize hand continuity", "smooth hand paths", "continuous hand movement"
    if (containsConcept(text, "maximize") || containsConcept(text, "continuity")) {
      return true;
    }
    // "minimize handpath reversals" implies maximize continuity
    if (containsConcept(text, "minimize")) {
      return true;
    }
    return false;
  },
  build(_text: string): IConstraint {
    return new HandPathReversalConstraint("maximize");
  },
};

const enforceHandPathContinuityPattern: ConstraintPattern = {
  id: "enforce-hand-path-continuity",
  type: ConstraintType.HAND_PATH,
  description: "Require continuous hand paths (no handpath reversals allowed)",
  matches(text: string): boolean {
    if (!containsConcept(text, "handpath")) {
      return false;
    }
    // "no handpath reversals", "never reverse hand", "require continuous hand paths"
    if (containsConcept(text, "exclude")) {
      return true;
    }
    if (containsConcept(text, "require") && containsConcept(text, "continuity")) {
      return true;
    }
    return false;
  },
  build(_text: string): IConstraint {
    return new HandPathReversalConstraint("enforce");
  },
};

const handPathReversalEveryStepPattern: ConstraintPattern = {
  id: "hand-path-reversal-every-step",
  type: ConstraintType.HAND_PATH,
  description: "Hand path reversal every step",
  matches(text: string): boolean {
    if (!containsConcept(text, "handpath")) {
      return false;
    }
    // "hand reversal every step", "maximize handpath reversals"
    return (
      text.toLowerCase().includes("every") ||
      (containsConcept(text, "maximize") && containsConcept(text, "reversal"))
    );
  },
  build(_text: string): IConstraint {
    return new HandPathReversalConstraint("every");
  },
};


/**
 * These patterns explicitly target PROP reversals (spin direction changes)
 * as distinct from hand path reversals.
 *
 * Examples:
 * - "no prop reversals" / "no spin reversals"
 * - "allow handpath reversals but no prop reversals"
 */

const noPropReversalsPattern: ConstraintPattern = {
  id: "no-prop-reversals",
  type: ConstraintType.CONTINUITY,
  description: "No prop/spin reversals (prop spin direction must stay consistent)",
  matches(text: string): boolean {
    // Must explicitly mention "prop reversal" or "spin reversal"
    if (!containsConcept(text, "propreversal")) {
      return false;
    }
    return containsConcept(text, "exclude") || containsConcept(text, "minimize");
  },
  build(_text: string): IConstraint {
    // This uses the existing ContinuityConstraint which tracks prop rotation
    return new ContinuityConstraint("enforce");
  },
};

const maximizePropContinuityPattern: ConstraintPattern = {
  id: "maximize-prop-continuity",
  type: ConstraintType.CONTINUITY,
  description: "Maximize prop spin continuity (minimize prop reversals)",
  matches(text: string): boolean {
    if (!containsConcept(text, "propreversal")) {
      return false;
    }
    return containsConcept(text, "maximize") || containsConcept(text, "minimize");
  },
  build(_text: string): IConstraint {
    return new ContinuityConstraint("maximize");
  },
};


const reversalEveryStepPattern: ConstraintPattern = {
  id: "reversal-every-step",
  type: ConstraintType.REVERSAL,
  description: "Reversal every step (maximum direction changes)",
  matches(text: string): boolean {
    if (!containsConcept(text, "reversal")) {
      return false;
    }
    // "reversal every step", "maximize reversals", "break every step"
    return (
      text.toLowerCase().includes("every") ||
      containsConcept(text, "maximize")
    );
  },
  build(_text: string): IConstraint {
    return new ReversalConstraint("every");
  },
};

const noReversalsPattern: ConstraintPattern = {
  id: "no-reversals",
  type: ConstraintType.REVERSAL,
  description: "No reversals (same as enforce continuity)",
  matches(text: string): boolean {
    if (!containsConcept(text, "reversal")) {
      return false;
    }
    return containsConcept(text, "exclude") || containsConcept(text, "minimize");
  },
  build(_text: string): IConstraint {
    // "No reversals" is equivalent to enforcing continuity
    return new ContinuityConstraint("enforce");
  },
};


function detectHand(text: string): HandTarget {
  if (containsConcept(text, "blue") && !containsConcept(text, "red")) {
    return "blue";
  }
  if (containsConcept(text, "red") && !containsConcept(text, "blue")) {
    return "red";
  }
  return "both";
}


/**
 * All registered constraint patterns, in priority order.
 * More specific patterns should come before general ones.
 */
export const CONSTRAINT_PATTERNS: ConstraintPattern[] = [
  // Hand path patterns (specific hand path vs general reversal)
  enforceHandPathContinuityPattern,
  maximizeHandPathContinuityPattern,
  handPathReversalEveryStepPattern,

  // Prop reversal patterns (specific prop/spin reversal)
  noPropReversalsPattern,
  maximizePropContinuityPattern,

  // Continuity (general - specific before general)
  enforceContinuityPattern,
  maximizeContinuityPattern,

  // Reversals (general - when user doesn't specify hand vs prop)
  reversalEveryStepPattern,
  noReversalsPattern,

  // Per-hand dash preferences (HIGHEST PRIORITY for dash patterns)
  // These handle "blue hand lots of dashes, red hand few dashes"
  perHandDashMaximizePattern,
  perHandDashMinimizePattern,

  // Global dash preference (BEFORE generic motion type patterns)
  // These handle "maximize dashes", "as many dashes as possible", etc.
  requireDashesPattern,
  maximizeDashesPattern,
  minimizeDashesPattern,

  // Motion types - require mode
  createMotionTypePattern("pro", "require"),
  createMotionTypePattern("anti", "require"),
  createMotionTypePattern("static", "require"),
  createMotionTypePattern("dash", "require"),

  // Motion types - prefer mode
  createMotionTypePattern("pro", "prefer"),
  createMotionTypePattern("anti", "prefer"),

  // Motion types - exclude mode
  createMotionTypePattern("pro", "exclude"),
  createMotionTypePattern("anti", "exclude"),
  createMotionTypePattern("static", "exclude"),
  createMotionTypePattern("dash", "exclude"),

  // Rotation directions
  createRotationPattern("cw"),
  createRotationPattern("ccw"),
];

export function findMatchingPatterns(text: string): ConstraintPattern[] {
  return CONSTRAINT_PATTERNS.filter((pattern) => pattern.matches(text));
}
