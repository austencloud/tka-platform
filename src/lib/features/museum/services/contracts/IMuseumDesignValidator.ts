import type { PlacedRoom, RoomEdge } from "../../domain/layout-types";
import type { MuseumGrid } from "../../domain/museum-grid-types";

export interface DesignViolation {
  roomId: string;
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  exhibitRefId?: string;
}

export interface IMuseumDesignValidator {
  validateRoom(room: PlacedRoom, entranceWall: string): DesignViolation[];
  validateAll(
    rooms: PlacedRoom[],
    edges: RoomEdge[],
    grid: MuseumGrid,
  ): DesignViolation[];
}
