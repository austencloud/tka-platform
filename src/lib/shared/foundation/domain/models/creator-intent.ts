import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { EffortTimeline } from "$lib/shared/effort/domain/effort-timeline-types";

export interface CreatorIntent {
  /** Prop pair the creator recorded for presentation. Optional: an intent may
   * carry only an effort timeline. Absent means "no prop intent recorded" —
   * never substitute a default here; display falls back to viewer context. */
  readonly propConfig?: {
    readonly leftPropType: PropType;
    readonly rightPropType: PropType;
    readonly catDogMode: boolean;
  };
  readonly effortTimeline?: EffortTimeline | null;
}
