import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";

export interface ICreatorPropFilter {
  queryByProp(prop: PropType, limit: number): Promise<UserProfile[]>;
  filterByProps(profiles: UserProfile[], requiredProps: PropType[]): UserProfile[];
  groupByFavoriteProp(profiles: UserProfile[]): Map<PropType | "none", UserProfile[]>;
}
