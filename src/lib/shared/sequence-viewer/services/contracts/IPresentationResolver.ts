import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { EffortTimeline } from "$lib/features/phrase-effort-lab/domain/effort-timeline-types";

export type ViewingContext = "notation" | "creator-expression";

export interface ResolvedPresentation {
  readonly bluePropType: PropType;
  readonly redPropType: PropType;
  readonly catDogMode: boolean;
  readonly effortTimeline: EffortTimeline | null;
  readonly source: "creator-intent" | "viewer-settings";
}

export interface IPresentationResolver {
  resolve(
    sequence: SequenceData,
    viewingContext: ViewingContext,
    viewerBlue: PropType,
    viewerRed: PropType,
    viewerCatDog: boolean
  ): ResolvedPresentation;
}
