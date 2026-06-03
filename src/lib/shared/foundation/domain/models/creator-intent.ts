import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { EffortTimeline } from "$lib/shared/effort/domain/effort-timeline-types";

export interface CreatorIntent {
  readonly propConfig: {
    readonly bluePropType: PropType;
    readonly redPropType: PropType;
    readonly catDogMode: boolean;
  };
  readonly effortTimeline?: EffortTimeline | null;
}
