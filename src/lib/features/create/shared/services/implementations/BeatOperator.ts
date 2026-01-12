/**
 * Beat Operations Service Implementation
 *
 * Facade that delegates to specialized handlers for beat manipulation.
 * Manages beat removal, batch editing, individual beat mutations, undo snapshots, and beat selection.
 *
 * Domain: Create module - Beat Manipulation for Sequence Construction
 */

import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { IBeatOperator } from "../contracts/IBeatOperator";
import type {
  ICreateModuleState,
  BatchEditChanges,
} from "../../types/create-module-types";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IGridModeDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
import type { BeatData } from "../../domain/models/BeatData";

// Import handlers
import { removeBeat } from "./beat-operations/BeatRemovalHandler";
import { applyBatchChanges } from "./beat-operations/BatchEditHandler";
import { updateBeatOrientation } from "./beat-operations/OrientationHandler";
import { updateBeatTurns } from "./beat-operations/TurnsHandler";
import {
  updateBeatPropType,
  bulkUpdatePropType,
} from "./beat-operations/PropTypeHandler";
import { updateRotationDirection } from "./beat-operations/RotationDirectionHandler";
import {
  updateArrowAdjustment,
  persistBeatWithAdjustments,
} from "./beat-operations/ArrowAdjustmentHandler";

export class BeatOperator implements IBeatOperator {
  constructor(
    private motionQueryHandler: IMotionQueryHandler | null,
    private gridModeDeriver: IGridModeDeriver | null
  ) {}

  removeBeat(beatIndex: number, createModuleState: ICreateModuleState): void {
    removeBeat(beatIndex, createModuleState);
  }

  applyBatchChanges(
    changes: BatchEditChanges,
    createModuleState: ICreateModuleState
  ): void {
    applyBatchChanges(changes, createModuleState);
  }

  updateBeatOrientation(
    beatNumber: number,
    color: string,
    orientation: string,
    createModuleState: ICreateModuleState,
    _panelState: unknown
  ): void {
    updateBeatOrientation(beatNumber, color, orientation, createModuleState);
  }

  updateBeatTurns(
    beatNumber: number,
    color: string,
    turnAmount: number | "fl",
    createModuleState: ICreateModuleState,
    _panelState: unknown
  ): void {
    updateBeatTurns(beatNumber, color, turnAmount, createModuleState);
  }

  updateBeatPropType(
    beatNumber: number,
    color: string,
    propType: PropType,
    createModuleState: ICreateModuleState,
    _panelState: unknown
  ): void {
    updateBeatPropType(beatNumber, color, propType, createModuleState);
  }

  bulkUpdatePropType(
    color: string,
    propType: PropType,
    createModuleState: ICreateModuleState
  ): void {
    bulkUpdatePropType(color, propType, createModuleState);
  }

  updateRotationDirection(
    beatNumber: number,
    color: string,
    rotationDirection: string,
    createModuleState: ICreateModuleState,
    _panelState: unknown
  ): void {
    updateRotationDirection(
      beatNumber,
      color,
      rotationDirection,
      createModuleState,
      this.motionQueryHandler,
      this.gridModeDeriver
    );
  }

  updateArrowAdjustment(
    beatNumber: number,
    color: string,
    adjustmentX: number,
    adjustmentY: number,
    createModuleState: ICreateModuleState
  ): void {
    updateArrowAdjustment(
      beatNumber,
      color,
      adjustmentX,
      adjustmentY,
      createModuleState
    );
  }

  persistBeatWithAdjustments(
    beatNumber: number,
    updatedBeatData: BeatData,
    createModuleState: ICreateModuleState
  ): void {
    persistBeatWithAdjustments(beatNumber, updatedBeatData, createModuleState);
  }
}
