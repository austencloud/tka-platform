/**
 * Event Types
 *
 * Types for game events pushed to MCP clients.
 */

import type { Vector3 } from "./game-state.js";

export type GameEventType =
  | "collision"
  | "grounded_changed"
  | "zone_enter"
  | "zone_exit"
  | "position_update";

export interface CollisionEvent {
  type: "collision";
  data: {
    object: { id: string; type: string };
    point: Vector3;
    normal: Vector3;
  };
}

export interface GroundedChangedEvent {
  type: "grounded_changed";
  data: {
    grounded: boolean;
    groundHeight: number;
  };
}

export interface ZoneEnterEvent {
  type: "zone_enter";
  data: {
    zone: string;
    position: Vector3;
  };
}

export interface ZoneExitEvent {
  type: "zone_exit";
  data: {
    zone: string;
    position: Vector3;
  };
}

export interface PositionUpdateEvent {
  type: "position_update";
  data: {
    position: Vector3;
    velocity: Vector3;
  };
}

export type GameEvent =
  | CollisionEvent
  | GroundedChangedEvent
  | ZoneEnterEvent
  | ZoneExitEvent
  | PositionUpdateEvent;
