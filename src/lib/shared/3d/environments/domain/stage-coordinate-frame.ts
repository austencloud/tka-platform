import { BackgroundType } from "@austencloud/backgrounds";
import { STAGE } from "@austencloud/scene-3d";

export interface StageCoordinateFrame {
  performerAnchorY: number;
  nativeSurfaceY: number;
  environmentYOffset: number;
}

/**
 * Performer rigs live in one world frame. Environments move to meet this
 * anchor, so changing the scenery cannot move a performance that is already
 * playing.
 */
export const CANONICAL_PERFORMER_ANCHOR_Y = STAGE.STAGE_DECK_HEIGHT;

/**
 * Height of the surface that currently supports the performer in each scene's
 * authored local coordinates. These values used to move the performer itself.
 */
export function getNativeStageSurfaceY(
  backgroundType: BackgroundType,
  stageEnabled: boolean
): number {
  switch (backgroundType) {
    case BackgroundType.FOREST:
      return STAGE.STAGE_DECK_HEIGHT;
    case BackgroundType.AUTUMN:
      // Autumn owns the same canonical raised Stage3D as Forest. Its native
      // performer surface is the deck top, not the terrain underneath it.
      // Treating the terrain as the support surface shifts the whole scene up
      // one deck height and leaves the performer's feet inside the planks.
      return STAGE.STAGE_DECK_HEIGHT;
    case BackgroundType.COSMIC:
      return 0.4;
    case BackgroundType.WINTER:
      return 0.45;
    case BackgroundType.OCEAN:
      return stageEnabled ? 2.5 : 1.5;
    case BackgroundType.EMBER:
      return 0.5;
    case BackgroundType.BLOSSOM:
      return 0.35;
    case BackgroundType.RAINBOW:
      return 0.4;
    case BackgroundType.CELESTIAL:
      return 0.01;
    case BackgroundType.VOID:
      return 0.35;
    default:
      return 0;
  }
}

export function getStageCoordinateFrame(
  backgroundType: BackgroundType,
  stageEnabled: boolean
): StageCoordinateFrame {
  const nativeSurfaceY = getNativeStageSurfaceY(backgroundType, stageEnabled);

  return {
    performerAnchorY: CANONICAL_PERFORMER_ANCHOR_Y,
    nativeSurfaceY,
    environmentYOffset: CANONICAL_PERFORMER_ANCHOR_Y - nativeSurfaceY,
  };
}

export function isRenderable3DEnvironment(
  backgroundType: BackgroundType
): boolean {
  switch (backgroundType) {
    case BackgroundType.FOREST:
    case BackgroundType.AUTUMN:
    case BackgroundType.COSMIC:
    case BackgroundType.WINTER:
    case BackgroundType.OCEAN:
    case BackgroundType.EMBER:
    case BackgroundType.BLOSSOM:
    case BackgroundType.RAINBOW:
    case BackgroundType.CELESTIAL:
    case BackgroundType.VOID:
      return true;
    default:
      return false;
  }
}
