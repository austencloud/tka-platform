import {
  GridPositionGroup,
  type GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

const GROUPS: readonly GridPositionGroup[] = Object.values(GridPositionGroup);

/** "beta5" → "beta". Null when the prefix is not a known family. */
export function positionGroup(position: GridPosition | string): GridPositionGroup | null {
  const match = /^([a-z]+)\d+$/.exec(position);
  if (!match) return null;
  const group = match[1] as GridPositionGroup;
  return GROUPS.includes(group) ? group : null;
}
