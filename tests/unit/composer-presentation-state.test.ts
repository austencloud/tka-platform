import { Plane } from "@austencloud/scene-3d";
import { describe, expect, it, vi } from "vitest";
import {
  COMPOSER_3D_DEMO_SEED,
  normalizeComposer3DDemoState,
} from "../../src/routes/(public)/composer/_components/composer-3d-demo-state";
import {
  classifyComposerGenerationFailure,
  shouldSyncComposerSequence,
} from "../../src/routes/(public)/composer/_components/composer-generation-failure";
import { createStartPositionData } from "$lib/shared/create/factories/create-start-position-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import type { Viewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import { SceneEnvironmentId } from "$lib/shared/3d/environments/domain/scene-environment";
import { SCENE_FEATURES } from "$lib/shared/3d/scene-features/domain/scene-feature-registry";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

const POSITION_BY_LOCATION = {
  [GridLocation.NORTH]: GridPosition.BETA1,
  [GridLocation.EAST]: GridPosition.BETA3,
  [GridLocation.SOUTH]: GridPosition.BETA5,
  [GridLocation.WEST]: GridPosition.BETA7,
} as const;

function pictograph(
  id: string,
  start: GridLocation,
  end: GridLocation
): PictographData {
  const createMotion = (color: MotionColor) =>
    createMotionData({
      color,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: start,
      endLocation: end,
      turns: 0.5,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
      arrowLocation: start,
      gridMode: GridMode.DIAMOND,
    });

  return {
    id,
    letter: null,
    startPosition: POSITION_BY_LOCATION[start],
    endPosition: POSITION_BY_LOCATION[end],
    motions: {
      blue: createMotion(MotionColor.BLUE),
      red: createMotion(MotionColor.RED),
    },
  };
}

function sequenceFixture(): SequenceData {
  const startPictograph = pictograph(
    "start",
    GridLocation.NORTH,
    GridLocation.NORTH
  );
  const start = createStartPositionData(startPictograph);
  const steps = [
    pictograph("one", GridLocation.NORTH, GridLocation.EAST),
    pictograph("two", GridLocation.EAST, GridLocation.SOUTH),
    pictograph("three", GridLocation.SOUTH, GridLocation.WEST),
  ].map((item, index) =>
    createStepData({
      ...item,
      stepNumber: index + 1,
    })
  );

  return createSequenceData({
    id: "presentation-sequence",
    name: "Presentation sequence",
    startPosition: start,
    startingPosition: start,
    steps,
    isCircular: true,
    canonicalSignature: "stale-after-edit",
    metadata: { pathShape: "arc" },
  });
}

describe("Composer presentation state", () => {
  it("fully seeds the 3D proof instead of inheriting account state", () => {
    expect(COMPOSER_3D_DEMO_SEED.renderMode).toBe("3d");
    expect(COMPOSER_3D_DEMO_SEED.environmentId).toBe(SceneEnvironmentId.COSMIC);
    expect(COMPOSER_3D_DEMO_SEED.performers).toHaveLength(1);
    expect(COMPOSER_3D_DEMO_SEED.selectedPerformerIndex).toBeNull();
    expect(COMPOSER_3D_DEMO_SEED.activeFormation).toBe("line");
    expect(COMPOSER_3D_DEMO_SEED.defaultProp).toBe(PropType.STAFF);
    expect(COMPOSER_3D_DEMO_SEED.camera).toBeNull();
    expect(COMPOSER_3D_DEMO_SEED.visiblePlanes).toEqual([]);
    expect(COMPOSER_3D_DEMO_SEED.showGridLabels).toBe(false);
    expect(COMPOSER_3D_DEMO_SEED.effectToggles).toEqual({
      charcoal: false,
      fire: false,
      led: false,
      trails: false,
    });
    expect(COMPOSER_3D_DEMO_SEED.sceneFeatures).toEqual(
      Object.fromEntries(
        SCENE_FEATURES.map((feature) => [feature.key, feature.defaultEnabled])
      )
    );
    expect(COMPOSER_3D_DEMO_SEED.performers?.[0]).toMatchObject({
      customBluePlane: Plane.WALL,
      customRedPlane: Plane.WALL,
      settings: { prop: PropType.STAFF },
    });
  });

  it("normalizes storage-era viewer fields through public APIs", () => {
    const viewer = {
      showGridLabels: true,
      setEnvironmentId: vi.fn(),
      selectPerformerScope: vi.fn(),
      setNavMode: vi.fn(),
      setDefaultProp: vi.fn(),
      setActivePreset: vi.fn(),
      setActiveCameraPreset: vi.fn(),
      hideAllPlanes: vi.fn(),
      toggleGridLabels: vi.fn(),
      applyFormationFromUI: vi.fn(),
    } as unknown as Viewer3DState;

    normalizeComposer3DDemoState(viewer, SceneEnvironmentId.OCEAN);

    expect(viewer.setEnvironmentId).toHaveBeenCalledWith(
      SceneEnvironmentId.OCEAN
    );
    expect(viewer.selectPerformerScope).toHaveBeenCalledWith(null);
    expect(viewer.setNavMode).toHaveBeenCalledWith("orbit");
    expect(viewer.setDefaultProp).toHaveBeenCalledWith(PropType.STAFF);
    expect(viewer.setActivePreset).toHaveBeenCalledWith(null);
    expect(viewer.setActiveCameraPreset).toHaveBeenCalledWith("main");
    expect(viewer.hideAllPlanes).toHaveBeenCalledOnce();
    expect(viewer.toggleGridLabels).toHaveBeenCalledOnce();
    expect(viewer.applyFormationFromUI).toHaveBeenCalledWith("line");
  });

  it("separates exhausted recipes from generator failures", () => {
    expect(
      classifyComposerGenerationFailure(
        new Error("No valid circular sequence found")
      )
    ).toBe("no-result");
    expect(
      classifyComposerGenerationFailure(
        new Error("Unable to generate a valid sequence after 10 attempts")
      )
    ).toBe("no-result");
    expect(
      classifyComposerGenerationFailure(new Error("chunk failed to load"))
    ).toBe("error");
    expect(classifyComposerGenerationFailure("unknown failure")).toBe("error");
  });

  it("accepts a constructed sequence carried in from the page", () => {
    const current = sequenceFixture();
    const incoming = createSequenceData({
      ...current,
      id: `${current.id}-guided-build-1`,
    });

    expect(shouldSyncComposerSequence(current, incoming)).toBe(true);
    expect(shouldSyncComposerSequence(incoming, incoming)).toBe(false);
    expect(shouldSyncComposerSequence(current, null)).toBe(false);
  });
});
