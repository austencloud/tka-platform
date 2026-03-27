/**
 * ITopologyBuilder - Fluent API for declaring grid arrangements
 *
 * Builds a GridTopology from a series of grid placements and conjoin constraints.
 * Junctions are auto-detected — never manually declared.
 */

import type { GridLocation, GridMode } from "$lib/shared/render/core/types";
import type { Plane } from "$lib/shared/3d/domain/enums/Plane";
import type { Vec2, GridTopology } from "../../domain/models/GridTopology";

export interface GridOptions {
  /** Grid rendering mode (default: "diamond") */
  mode?: GridMode;
  /** Explicit center position — overrides conjoin placement */
  center?: Vec2;
  /** Hand point radius in abstract units (default: 1.0) */
  radius?: number;
  /** Plane for 3D (default: "wall", L8+) */
  plane?: Plane;
}

export interface ITopologyBuilder {
  /** Start a new topology */
  create(): ITopologyBuilder;

  /** Add a grid to the topology */
  addGrid(id: string, options?: GridOptions): ITopologyBuilder;

  /**
   * Declare that locationOnA of gridA and locationOnB of gridB share the same world point.
   *
   * Grid B's center is computed so this constraint is satisfied.
   * If gridB doesn't exist yet, it's auto-created with default options.
   *
   * @param gridAId - The grid that already has a resolved position
   * @param locationOnA - Which location on gridA
   * @param gridBId - The grid to place (or auto-create)
   * @param locationOnB - Which location on gridB (default: "c" = center)
   */
  conjoin(
    gridAId: string,
    locationOnA: GridLocation,
    gridBId: string,
    locationOnB?: GridLocation,
  ): ITopologyBuilder;

  /**
   * Shorthand: chain N grids, each conjoined via the given edge.
   *
   * Creates grids "g0", "g1", ..., "g(count-1)" and conjoins each pair:
   * g0.edge → g1.center, g1.edge → g2.center, etc.
   */
  chain(count: number, mode: GridMode, edge: GridLocation): ITopologyBuilder;

  /** Build the final immutable topology (resolves positions, detects junctions) */
  build(): GridTopology;
}
