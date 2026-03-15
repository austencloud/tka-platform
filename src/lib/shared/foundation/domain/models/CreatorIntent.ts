import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { EffortTimeline } from "$lib/features/phrase-effort-lab/domain/effort-timeline-types";

export interface CreatorIntent {
  readonly propConfig: {
    readonly bluePropType: PropType;
    readonly redPropType: PropType;
    readonly catDogMode: boolean;
  };
  readonly effortTimeline?: EffortTimeline | null;
}
