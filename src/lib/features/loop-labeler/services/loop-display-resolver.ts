import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceEntry } from "$lib/shared/loop-labeler/domain/sequence-models";
import type { ComponentId } from "../domain/constants/loop-components";
import {
  LOOPComponent,
  RESERVED_ORIENTATION_PRIMITIVES,
  type LOOPDomain,
} from "$lib/shared/foundation/domain/models/generation/generate-models";
import type { LOOPSpec } from "@tka/sequence-engine/loop";
import {
  Period,
  type LOOPType,
} from "$lib/shared/foundation/domain/models/generation/circular-models";
import { loopDetector } from "./LOOPDetector";
import { convert as convertSequenceToEntry } from "$lib/features/choreo-card/services/sequence-to-entry-converter";
import { parseLoopComponents } from "$lib/shared/create/services/loop-type-utils";

export interface LoopDisplay {
  components: Set<LOOPComponent>;
  /**
   * Per-component domain annotation. "location" | "orientation" | "both"
   */
  componentDomains?: Partial<Record<LOOPComponent, LOOPDomain>>;
  /**
   * Integer LOOP period: 1, 2, 4, or 8.
   */
  period: number;
  /**
   * @deprecated Use `period` instead.
   */
  rotationPeriod?: Period;
  /**
   * @deprecated Use `period` instead.
   */
  inversionPeriod?: Period;
}

export type LoopDisplayInput = (SequenceData | SequenceEntry) & { loopSpec?: LOOPSpec };

function toLoopComponent(id: ComponentId): LOOPComponent | null {
  switch (id) {
    case "rotated":
      return LOOPComponent.ROTATED;
    case "mirrored":
      return LOOPComponent.MIRRORED;
    case "flipped":
      return LOOPComponent.FLIPPED;
    case "swapped":
      return LOOPComponent.SWAPPED;
    case "inverted":
      return LOOPComponent.INVERTED;
    case "rewound":
      return LOOPComponent.REWOUND;
    default:
      return null;
  }
}

function mapRotationInterval(
  interval: number | undefined
): Period | undefined {
  if (interval === 2) return Period.HALVED;
  if (interval === 4) return Period.QUARTERED;
  return undefined;
}

function isSequenceData(input: LoopDisplayInput): input is SequenceData {
  return Array.isArray((input as SequenceData).steps);
}

function getSequenceId(input: LoopDisplayInput): string | undefined {
  return input.id;
}

function hasEnoughSteps(input: LoopDisplayInput): boolean {
  if (isSequenceData(input)) {
    return (input.steps?.length ?? 0) >= 2;
  }
  const raw = input.fullMetadata?.sequence ?? [];
  const actualSteps = raw.filter(
    (el) => typeof el.beat === "number" && el.beat >= 1
  );
  return actualSteps.length >= 2;
}

function toSequenceEntry(input: LoopDisplayInput): SequenceEntry {
  if (isSequenceData(input)) {
    return convertSequenceToEntry(input);
  }
  return input;
}

const displayCache = new Map<string, LoopDisplay>();

export function clearLoopDisplayCache(): void {
  displayCache.clear();
}

/**
 * Resolve active LOOP components and period.
 * On-demand path (actual steps) takes precedence over stored metadata.
 */
export function resolveLoopDisplay(input: LoopDisplayInput): LoopDisplay {
  const cacheKey = getSequenceId(input);
  const inputHasSteps = hasEnoughSteps(input);

  if (cacheKey) {
    const cached = displayCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const result = computeLoopDisplay(input);

  if (cacheKey && inputHasSteps) {
    displayCache.set(cacheKey, result);
  }
  return result;
}

function computeLoopDisplay(input: LoopDisplayInput): LoopDisplay {
  if (input.loopSpec) {
    const components = new Set<LOOPComponent>();
    const componentDomains = new Map<LOOPComponent, LOOPDomain>();
    let maxPeriod = 1;

    for (const prop of [input.loopSpec.blue, input.loopSpec.red]) {
      if (!prop) continue;
      for (const [comp, cSpec] of prop.components) {
        if (!RESERVED_ORIENTATION_PRIMITIVES.has(comp as unknown as LOOPComponent)) {
          components.add(comp as unknown as LOOPComponent);
          if (cSpec.domain) componentDomains.set(comp as unknown as LOOPComponent, cSpec.domain);
          maxPeriod = Math.max(maxPeriod, cSpec.period);
        }
      }
    }

    return {
      components,
      period: maxPeriod,
      componentDomains: Object.fromEntries(componentDomains) as Partial<Record<LOOPComponent, LOOPDomain>>,
    };
  }

  if (hasEnoughSteps(input)) {
    try {
      const entry = toSequenceEntry(input);
      const detection = loopDetector.detectLOOP(entry);

      const components = new Set<LOOPComponent>();
      const componentDomains: Partial<Record<LOOPComponent, LOOPDomain>> = {};

      const detailed = detection.componentsDetailed ?? [];
      if (detailed.length > 0) {
        for (const entry of detailed) {
          if (RESERVED_ORIENTATION_PRIMITIVES.has(entry.component)) continue;
          components.add(entry.component);
          if (entry.domain) {
            componentDomains[entry.component] = entry.domain;
          }
        }
      } else {
        for (const id of detection.components) {
          const mapped = toLoopComponent(id);
          if (mapped && !RESERVED_ORIENTATION_PRIMITIVES.has(mapped)) {
            components.add(mapped);
            componentDomains[mapped] = "location";
          }
        }
      }

      if (components.size > 0) {
        const period = detection.period ?? 2;
        return {
          components,
          componentDomains,
          period,
          rotationPeriod: components.has(LOOPComponent.ROTATED)
            ? mapRotationInterval(
                detection.transformationIntervals?.rotation
              ) ??
              (period === 4
                ? Period.QUARTERED
                : period === 2
                  ? Period.HALVED
                  : undefined)
            : undefined,
          inversionPeriod: components.has(LOOPComponent.INVERTED)
            ? mapRotationInterval(
                detection.transformationIntervals?.invert
              ) ??
              (period === 4
                ? Period.QUARTERED
                : period === 2
                  ? Period.HALVED
                  : undefined)
            : undefined,
        };
      }
    } catch {
      // Fall through
    }
  }

  if (isSequenceData(input) && input.components && input.components.length > 0) {
    const components = new Set<LOOPComponent>();
    const componentDomains: Partial<Record<LOOPComponent, LOOPDomain>> = {};
    for (const c of input.components) {
      if (!RESERVED_ORIENTATION_PRIMITIVES.has(c)) {
        components.add(c);
        const domain = input.componentDomains?.[c];
        if (domain) componentDomains[c] = domain;
        else componentDomains[c] = "location";
      }
    }
    if (components.size > 0) {
      const period = input.period ?? 2;
      return {
        components,
        componentDomains,
        period,
        rotationPeriod: components.has(LOOPComponent.ROTATED)
          ? period === 4 ? Period.QUARTERED : period === 2 ? Period.HALVED : undefined
          : undefined,
        inversionPeriod: components.has(LOOPComponent.INVERTED)
          ? period === 4 ? Period.QUARTERED : period === 2 ? Period.HALVED : undefined
          : undefined,
      };
    }
  }

  const storedLoopType = input.loopType as LOOPType | null | undefined;
  if (storedLoopType) {
    const parsed = parseLoopComponents(storedLoopType);
    const components = new Set<LOOPComponent>();
    const componentDomains: Partial<Record<LOOPComponent, LOOPDomain>> = {};
    for (const c of parsed) {
      if (!RESERVED_ORIENTATION_PRIMITIVES.has(c)) {
        components.add(c);
        componentDomains[c] = "location";
      }
    }
    if (components.size > 0) {
      const sd = isSequenceData(input) ? input : undefined;
      const period = sd?.period ?? (sd?.orientationCycleCount === 4 ? 4 : 2);
      return {
        components,
        componentDomains,
        period,
        rotationPeriod: components.has(LOOPComponent.ROTATED)
          ? period === 4 ? Period.QUARTERED : period === 2 ? Period.HALVED : undefined
          : undefined,
        inversionPeriod: components.has(LOOPComponent.INVERTED)
          ? period === 4 ? Period.QUARTERED : period === 2 ? Period.HALVED : undefined
          : undefined,
      };
    }
  }

  return {
    components: new Set<LOOPComponent>(),
    period: 1,
    rotationPeriod: undefined,
    inversionPeriod: undefined,
  };
}
