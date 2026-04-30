import type { RoomNode, RoomEdge } from "../../domain/layout-types";
import type {
  IMuseumRoomSerializer,
  SerializationResult,
  ValidationError,
} from "../contracts/IMuseumRoomSerializer";

const VALID_SEGMENT_TYPES = new Set([
  "door",
  "exhibit",
  "torch",
  "screen",
  "rope",
  "sign",
  "gap",
]);

const VALID_EDGE_TYPES = new Set(["main-path", "side-branch", "secret"]);
const VALID_WALLS = new Set(["north", "south", "east", "west"]);

export class MuseumRoomSerializer implements IMuseumRoomSerializer {
  serialize(rooms: RoomNode[], edges: RoomEdge[]): string {
    return JSON.stringify({ version: 1, rooms, edges }, null, 2);
  }

  deserialize(json: string): SerializationResult {
    const result = this.validate(json);
    if (!result.valid) {
      const summary = result.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
      throw new Error(`Invalid museum room JSON: ${summary}`);
    }

    const parsed = JSON.parse(json);
    return { rooms: parsed.rooms as RoomNode[], edges: parsed.edges as RoomEdge[] };
  }

  validate(json: string): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      errors.push({ path: "$", message: "JSON parse failed - not valid JSON" });
      return { valid: false, errors };
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      errors.push({ path: "$", message: "Root must be an object" });
      return { valid: false, errors };
    }

    const root = parsed as Record<string, unknown>;

    if (!("version" in root)) {
      errors.push({ path: "$.version", message: "Missing required field 'version'" });
    }

    if (!("rooms" in root) || !Array.isArray(root.rooms)) {
      errors.push({ path: "$.rooms", message: "Missing or non-array field 'rooms'" });
    } else {
      (root.rooms as unknown[]).forEach((room, i) => {
        this.validateRoom(room, `$.rooms[${i}]`, errors);
      });
    }

    if (!("edges" in root) || !Array.isArray(root.edges)) {
      errors.push({ path: "$.edges", message: "Missing or non-array field 'edges'" });
    } else {
      (root.edges as unknown[]).forEach((edge, i) => {
        this.validateEdge(edge, `$.edges[${i}]`, errors);
      });
    }

    return { valid: errors.length === 0, errors };
  }

  private validateRoom(
    room: unknown,
    path: string,
    errors: ValidationError[],
  ): void {
    if (typeof room !== "object" || room === null || Array.isArray(room)) {
      errors.push({ path, message: "Room must be an object" });
      return;
    }

    const r = room as Record<string, unknown>;

    if (typeof r.id !== "string" || r.id.trim() === "") {
      errors.push({ path: `${path}.id`, message: "Missing or empty string 'id'" });
    }

    if (typeof r.name !== "string" || r.name.trim() === "") {
      errors.push({ path: `${path}.name`, message: "Missing or empty string 'name'" });
    }

    if (typeof r.material !== "string") {
      errors.push({ path: `${path}.material`, message: "Missing string 'material'" });
    }

    if (typeof r.theme !== "string") {
      errors.push({ path: `${path}.theme`, message: "Missing string 'theme'" });
    }

    if (typeof r.walls !== "object" || r.walls === null || Array.isArray(r.walls)) {
      errors.push({ path: `${path}.walls`, message: "Missing or invalid 'walls' object" });
    } else {
      const walls = r.walls as Record<string, unknown>;
      for (const dir of ["north", "south", "east", "west"] as const) {
        this.validateWallDefinition(walls[dir], `${path}.walls.${dir}`, errors);
      }
    }
  }

  private validateWallDefinition(
    wall: unknown,
    path: string,
    errors: ValidationError[],
  ): void {
    if (typeof wall !== "object" || wall === null || Array.isArray(wall)) {
      errors.push({ path, message: "Wall definition must be an object" });
      return;
    }

    const w = wall as Record<string, unknown>;

    if (!Array.isArray(w.segments)) {
      errors.push({ path: `${path}.segments`, message: "Wall 'segments' must be an array" });
    } else {
      (w.segments as unknown[]).forEach((seg, i) => {
        this.validateSegment(seg, `${path}.segments[${i}]`, errors);
      });
    }

    if (typeof w.minMargin !== "number") {
      errors.push({ path: `${path}.minMargin`, message: "Wall 'minMargin' must be a number" });
    }
  }

  private validateSegment(
    seg: unknown,
    path: string,
    errors: ValidationError[],
  ): void {
    if (typeof seg !== "object" || seg === null || Array.isArray(seg)) {
      errors.push({ path, message: "Segment must be an object" });
      return;
    }

    const s = seg as Record<string, unknown>;

    if (typeof s.type !== "string" || !VALID_SEGMENT_TYPES.has(s.type)) {
      errors.push({
        path: `${path}.type`,
        message: `Segment type must be one of: ${[...VALID_SEGMENT_TYPES].join(", ")}`,
      });
    }
  }

  private validateEdge(
    edge: unknown,
    path: string,
    errors: ValidationError[],
  ): void {
    if (typeof edge !== "object" || edge === null || Array.isArray(edge)) {
      errors.push({ path, message: "Edge must be an object" });
      return;
    }

    const e = edge as Record<string, unknown>;

    if (typeof e.from !== "string" || e.from.trim() === "") {
      errors.push({ path: `${path}.from`, message: "Missing or empty string 'from'" });
    }

    if (typeof e.to !== "string" || e.to.trim() === "") {
      errors.push({ path: `${path}.to`, message: "Missing or empty string 'to'" });
    }

    if (typeof e.type !== "string" || !VALID_EDGE_TYPES.has(e.type)) {
      errors.push({
        path: `${path}.type`,
        message: `Edge type must be one of: ${[...VALID_EDGE_TYPES].join(", ")}`,
      });
    }

    if (typeof e.fromWall !== "string" || !VALID_WALLS.has(e.fromWall)) {
      errors.push({
        path: `${path}.fromWall`,
        message: `fromWall must be one of: north, south, east, west`,
      });
    }

    if (typeof e.toWall !== "string" || !VALID_WALLS.has(e.toWall)) {
      errors.push({
        path: `${path}.toWall`,
        message: `toWall must be one of: north, south, east, west`,
      });
    }
  }
}
