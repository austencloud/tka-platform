import type { ComponentId } from "../../domain/constants/loop-components";
import type {
  CandidateDesignation,
  TransformationIntervals,
} from "../../domain/models/label-models";
import type { MergedMatch, RewoundResult } from "./types";

function buildDescription(match: MergedMatch): string {
  const parts: string[] = [];

  for (const comp of match.definition.components) {
    switch (comp) {
      case "rotated": {
        const target = match.matchedTarget;
        if (target.includes("90")) {
          const dir = match.direction?.toUpperCase() || "";
          parts.push(`Rotated 90° ${dir}`.trim());
        } else {
          parts.push("Rotated 180°");
        }
        break;
      }
      case "mirrored":
        parts.push("Mirrored");
        break;
      case "flipped":
        parts.push("Flipped");
        break;
      case "swapped":
        parts.push("Swapped");
        break;
      case "inverted":
        parts.push("Inverted");
        break;
      case "repeated":
        parts.push("Repeated");
        break;
    }
  }

  return parts.join(" + ");
}

function buildLabel(match: MergedMatch): string {
  const parts = [...match.definition.components];
  let label = parts.join("+");

  if (match.direction && match.interval === 4) {
    label += ` (${match.direction.toUpperCase()})`;
  }

  const intervalStr = match.interval === 2 ? "@1/2" : "@1/4";
  label += ` ${intervalStr}`;

  if (match.isStrict) {
    label = `strict ${label}`;
  }

  return label;
}

function buildIntervals(matches: MergedMatch[]): TransformationIntervals {
  const intervals: TransformationIntervals = {};

  for (const match of matches) {
    for (const comp of match.definition.components) {
      switch (comp) {
        case "rotated":
          if (!intervals.rotation || match.interval > intervals.rotation)
            intervals.rotation = match.interval;
          break;
        case "swapped":
          if (!intervals.swap || match.interval > intervals.swap)
            intervals.swap = match.interval;
          break;
        case "mirrored":
          if (!intervals.mirror || match.interval > intervals.mirror)
            intervals.mirror = match.interval;
          break;
        case "flipped":
          if (!intervals.flip || match.interval > intervals.flip)
            intervals.flip = match.interval;
          break;
        case "inverted":
          if (!intervals.invert || match.interval > intervals.invert)
            intervals.invert = match.interval;
          break;
      }
    }
  }

  return intervals;
}

export function buildCandidates(
  matches: MergedMatch[],
  rewound: RewoundResult
): CandidateDesignation[] {
  const candidates: CandidateDesignation[] = [];
  const allIntervals = buildIntervals(matches);

  for (const match of matches) {
    const components = [...match.definition.components] as ComponentId[];
    const loopType = match.isStrict
      ? `strict_${match.definition.id}`
      : match.definition.id;

    candidates.push({
      components,
      loopType,
      transformationIntervals: allIntervals,
      label: buildLabel(match),
      description: buildDescription(match),
      rotationDirection: match.direction,
      confirmed: false,
      denied: false,
    });
  }

  if (rewound.isRewound) {
    candidates.push({
      components: ["rewound"],
      loopType: "rewound",
      transformationIntervals: {},
      label: "rewound @1/2",
      description: "Rewound (second half reversed)",
      rotationDirection: null,
      confirmed: false,
      denied: false,
    });
  }

  return candidates;
}
