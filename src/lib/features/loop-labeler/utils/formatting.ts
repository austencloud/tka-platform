import { SliceSize } from "$lib/features/create/generate/circular/domain/models/circular-models";
import type { SectionDesignation } from "../domain/models/section-models";
import {
  BASE_COMPONENTS,
  type ComponentId,
} from "../domain/constants/loop-components";
import type { TransformationIntervals } from "../domain/models/label-models";

interface LOOPDesignation {
  components: ComponentId[];
  loopType: string | null;
  sliceSize?: SliceSize | null;
  transformationIntervals?: TransformationIntervals;
}

/**
 * Format interval for display
 */
function formatInterval(interval: string | undefined): string {
  if (!interval || interval === "none") return "";
  if (interval === "halved") return "½";
  if (interval === "quartered") return "¼";
  // Custom patterns
  return interval;
}

/**
 * Format a designation for display (works with both LOOPDesignation and SectionDesignation)
 */
export function formatDesignation(
  d: LOOPDesignation | SectionDesignation
): string {
  // Check for base word first (for section designations with only a base word)
  const hasBaseWord = "baseWord" in d && d.baseWord;

  // If no components and no base word, it's freeform
  if (d.components.length === 0 && !hasBaseWord) return "Freeform";

  // Build component labels with their intervals
  const intervals =
    "transformationIntervals" in d ? d.transformationIntervals : undefined;
  const componentParts: string[] = [];

  for (const c of d.components) {
    const componentDef = BASE_COMPONENTS.find((b) => b.id === c);
    let componentLabel = componentDef?.label ?? c;

    // Add interval suffix for components that have one
    if (intervals) {
      const intervalKey = componentToIntervalKey(c);
      if (intervalKey && intervals[intervalKey]) {
        const intervalStr = formatInterval(intervals[intervalKey]);
        if (intervalStr) {
          componentLabel += `(${intervalStr})`;
        }
      }
    } else if (c === "rotated" && d.sliceSize) {
      // Fallback to old sliceSize for backwards compatibility
      const sliceLabel = d.sliceSize === SliceSize.HALVED ? "½" : "¼";
      componentLabel += `(${sliceLabel})`;
    }

    componentParts.push(componentLabel);
  }

  let label = componentParts.join(" + ");

  // Add base word if present
  if (hasBaseWord) {
    const baseWordLabel = `[${(d as SectionDesignation).baseWord!.toUpperCase()}]`;
    label = label ? `${label} ${baseWordLabel}` : baseWordLabel;
  }

  return label;
}

/**
 * Map component IDs to their corresponding interval keys
 */
function componentToIntervalKey(
  component: ComponentId
): keyof TransformationIntervals | null {
  const map: Record<ComponentId, keyof TransformationIntervals | null> = {
    rotated: "rotation",
    swapped: "swap",
    mirrored: "mirror",
    flipped: "flip",
    inverted: "invert",
    rewound: null,
    repeated: null,
    modular: null,
  };
  return map[component] ?? null;
}

/**
 * Format section steps for display (e.g., "1-4" or "1,3,5")
 */
export function formatSectionSteps(steps: number[]): string {
  if (steps.length === 0) return "";
  if (steps.length === 1) return `Beat ${steps[0]}`;

  // Check if consecutive
  const sorted = [...steps].sort((a, b) => a - b);
  let isConsecutive = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! !== sorted[i - 1]! + 1) {
      isConsecutive = false;
      break;
    }
  }

  if (isConsecutive) {
    return `Steps ${sorted[0]}-${sorted[sorted.length - 1]}`;
  } else {
    return `Steps ${sorted.join(", ")}`;
  }
}
