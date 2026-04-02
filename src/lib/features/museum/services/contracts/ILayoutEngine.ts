import type { RoomNode, RoomEdge, GridConfig, LayoutResult } from "../../domain/layout-types";

export interface ILayoutEngine {
  computeLayout(rooms: RoomNode[], edges: RoomEdge[], config: GridConfig): LayoutResult;
}
