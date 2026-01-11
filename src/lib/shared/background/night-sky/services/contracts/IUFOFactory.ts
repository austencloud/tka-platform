/**
 * IUFOFactory - Creates fully initialized UFO instances
 */

import type { Dimensions } from "../../../shared/domain/types/background-types";
import type { UFO, UFOConfig, UFOEntranceType, UFOExitType } from "../domain/ufo-types";

export interface UFOSpawnParams {
  dimensions: Dimensions;
  config: UFOConfig;
  entranceType?: UFOEntranceType;
  exitType?: UFOExitType;
}

export interface IUFOFactory {
  /**
   * Create a fully initialized UFO instance
   */
  create(params: UFOSpawnParams): UFO;
}
