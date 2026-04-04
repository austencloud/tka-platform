import type { RoomNode, RoomEdge } from "../../domain/layout-types";

export interface SerializationResult {
  rooms: RoomNode[];
  edges: RoomEdge[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface IMuseumRoomSerializer {
  serialize(rooms: RoomNode[], edges: RoomEdge[]): string;
  deserialize(json: string): SerializationResult;
  validate(json: string): { valid: boolean; errors: ValidationError[] };
}
