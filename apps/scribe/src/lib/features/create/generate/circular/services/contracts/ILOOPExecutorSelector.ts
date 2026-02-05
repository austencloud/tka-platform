import type { LOOPType } from "../../domain/models/circular-models";
import type { ILOOPExecutor } from "./ILOOPExecutor";

/**
 * Service for selecting the appropriate LOOP executor based on LOOP type
 *
 * Maps LOOP type enums to their corresponding executor implementations,
 * providing a clean interface for the generation orchestration service
 * to access the correct transformation logic.
 */
export interface ILOOPExecutorSelector {
  /**
   * Get the appropriate LOOP executor for the given LOOP type
   *
   * @param loopType - The LOOP type enum value (e.g., STRICT_ROTATED, STRICT_MIRRORED)
   * @returns The executor instance for this LOOP type
   * @throws Error if the LOOP type is not supported
   */
  getExecutor(loopType: LOOPType): ILOOPExecutor;

  /**
   * Check if a LOOP type is supported
   *
   * @param loopType - The LOOP type to check
   * @returns True if an executor exists for this type
   */
  isSupported(loopType: LOOPType): boolean;
}
