/**
 * Graph Layout Engine
 *
 * Takes an abstract room graph (nodes + edges) and a grid configuration,
 * then computes absolute tile positions for every room. Uses topological
 * ordering with a snake pattern so the museum reads as a linear journey
 * that zigzags across the grid.
 */

import type { ILayoutEngine } from "../contracts/ILayoutEngine";
import type {
  RoomNode,
  RoomEdge,
  GridConfig,
  GridAssignment,
  PlacedRoom,
  LayoutResult,
} from "../../domain/layout-types";

export class GraphLayoutEngine implements ILayoutEngine {
  computeLayout(rooms: RoomNode[], edges: RoomEdge[], config: GridConfig): LayoutResult {
    const assignments = this.assignGridPositions(rooms, edges);
    const placedRooms = this.computeAbsolutePositions(rooms, assignments, config);
    const { gridWidth, gridHeight } = this.computeGridDimensions(assignments, config);

    return {
      rooms: placedRooms,
      corridors: [], // Corridors are routed separately by CorridorRouter
      gridWidth,
      gridHeight,
    };
  }

  /**
   * Assigns each room to a grid cell using topological order.
   * Main-path rooms snake left-to-right, then right-to-left.
   * Side-branch rooms go perpendicular to the main path.
   */
  private assignGridPositions(rooms: RoomNode[], edges: RoomEdge[]): GridAssignment[] {
    const mainPath = this.extractMainPath(rooms, edges);
    const sideEdges = edges.filter((e) => e.type !== "main-path");
    const assignments = new Map<string, GridAssignment>();

    // Snake pattern for main path: row 0 left-to-right, row 1 right-to-left, etc.
    const columnsPerRow = Math.max(3, Math.ceil(Math.sqrt(mainPath.length)));
    for (let i = 0; i < mainPath.length; i++) {
      const row = Math.floor(i / columnsPerRow);
      const colInRow = i % columnsPerRow;
      const col = row % 2 === 0 ? colInRow : columnsPerRow - 1 - colInRow;
      assignments.set(mainPath[i], { roomId: mainPath[i], gridCol: col, gridRow: row });
    }

    // Side branches go one row below their parent
    for (const edge of sideEdges) {
      if (assignments.has(edge.to)) continue;
      const parentAssignment = assignments.get(edge.from);
      if (!parentAssignment) continue;

      // Place side branch one row below, offset by +1 column
      const sideCol = parentAssignment.gridCol + 1;
      const sideRow = parentAssignment.gridRow + 1;
      assignments.set(edge.to, { roomId: edge.to, gridCol: sideCol, gridRow: sideRow });
    }

    return Array.from(assignments.values());
  }

  /**
   * Extracts the main-path room ordering via topological sort.
   * Follows only "main-path" edges.
   */
  private extractMainPath(rooms: RoomNode[], edges: RoomEdge[]): string[] {
    const mainEdges = edges.filter((e) => e.type === "main-path");
    const roomIds = new Set(rooms.map((r) => r.id));

    // Build adjacency and in-degree maps for main-path edges only
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    for (const id of roomIds) {
      adj.set(id, []);
      inDegree.set(id, 0);
    }

    for (const edge of mainEdges) {
      adj.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    // Find starting nodes (in-degree 0 among main-path edges)
    const mainPathNodes = new Set<string>();
    for (const edge of mainEdges) {
      mainPathNodes.add(edge.from);
      mainPathNodes.add(edge.to);
    }

    const queue: string[] = [];
    for (const id of mainPathNodes) {
      if ((inDegree.get(id) ?? 0) === 0) {
        queue.push(id);
      }
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!mainPathNodes.has(current)) continue;
      order.push(current);

      for (const next of adj.get(current) ?? []) {
        const deg = (inDegree.get(next) ?? 1) - 1;
        inDegree.set(next, deg);
        if (deg === 0) {
          queue.push(next);
        }
      }
    }

    // Add any rooms not on the main path at the end (shouldn't happen with
    // a well-formed graph, but prevents silent data loss)
    for (const room of rooms) {
      if (!order.includes(room.id)) {
        order.push(room.id);
      }
    }

    return order;
  }

  /**
   * Converts grid assignments to absolute tile positions.
   * Each room is centered within its grid cell, sized between min and max.
   * Uses deterministic sizing (midpoint) rather than random, so the layout
   * is reproducible.
   */
  private computeAbsolutePositions(
    rooms: RoomNode[],
    assignments: GridAssignment[],
    config: GridConfig,
  ): PlacedRoom[] {
    const roomMap = new Map(rooms.map((r) => [r.id, r]));
    const placed: PlacedRoom[] = [];

    for (const assignment of assignments) {
      const room = roomMap.get(assignment.roomId);
      if (!room) continue;

      const cellX = assignment.gridCol * config.cellWidth;
      const cellY = assignment.gridRow * config.cellHeight;

      // Deterministic: use midpoint of min/max range
      const w = room.minWidth + Math.floor((room.maxWidth - room.minWidth) / 2);
      const h = room.minHeight + Math.floor((room.maxHeight - room.minHeight) / 2);

      // Center room within its grid cell
      const x = cellX + Math.floor((config.cellWidth - w) / 2);
      const y = cellY + Math.floor((config.cellHeight - h) / 2);

      placed.push({
        id: room.id,
        name: room.name,
        x,
        y,
        w,
        h,
        material: room.material,
        theme: room.theme,
        description: room.description,
        exhibits: room.exhibits,
        performers: room.performers,
        torches: room.torches,
      });
    }

    return placed;
  }

  private computeGridDimensions(
    assignments: GridAssignment[],
    config: GridConfig,
  ): { gridWidth: number; gridHeight: number } {
    let maxCol = 0;
    let maxRow = 0;
    for (const a of assignments) {
      maxCol = Math.max(maxCol, a.gridCol);
      maxRow = Math.max(maxRow, a.gridRow);
    }
    return {
      gridWidth: (maxCol + 1) * config.cellWidth,
      gridHeight: (maxRow + 1) * config.cellHeight,
    };
  }
}
