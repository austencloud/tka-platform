import type { PlacedRoom, RoomEdge, CorridorSegment } from "../../domain/layout-types";

export interface ICorridorRouter {
  routeCorridor(fromRoom: PlacedRoom, toRoom: PlacedRoom, edge: RoomEdge): CorridorSegment[];
}
