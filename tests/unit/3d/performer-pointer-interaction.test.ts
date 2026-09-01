import { describe, expect, it, vi } from "vitest";
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera } from "three";
import {
  clampPerformerPosition,
  createPerformerPointerInteraction,
  getPointerIntent,
  intersectGroundPlane,
  isWithinMinimumTouchTarget,
  resolveCameraRelativeNudge,
  resolvePerformerDragPosition,
  resolveTouchIntent,
  snapStagePositionToEightDirections,
} from "$lib/shared/3d/components/performer-interaction/performer-pointer-interaction.svelte";

function expectPositionCloseTo(
  actual: { x: number; z: number },
  expected: { x: number; z: number }
): void {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.z).toBeCloseTo(expected.z);
}

describe("performer pointer interaction", () => {
  it("keeps movement inside the click threshold until travel exceeds 8px", () => {
    expect(getPointerIntent({ x: 10, y: 10 }, { x: 18, y: 10 })).toBe("click");
    expect(getPointerIntent({ x: 10, y: 10 }, { x: 18.01, y: 10 })).toBe(
      "drag"
    );
  });

  it("uses immediate touch drag only for the selected performer", () => {
    expect(
      resolveTouchIntent({ selected: true, heldMs: 0, travelPx: 5.01 })
    ).toBe("drag");
    expect(
      resolveTouchIntent({ selected: false, heldMs: 249, travelPx: 4 })
    ).toBe("tap");
    expect(
      resolveTouchIntent({ selected: false, heldMs: 250, travelPx: 4 })
    ).toBe("drag");
    expect(
      resolveTouchIntent({ selected: false, heldMs: 300, travelPx: 5.01 })
    ).toBe("camera");
  });

  it("keeps a 44px minimum touch target around projected performers", () => {
    expect(isWithinMinimumTouchTarget({ x: 22, y: 0 }, { x: 0, y: 0 })).toBe(
      true
    );
    expect(isWithinMinimumTouchTarget({ x: 22.01, y: 0 }, { x: 0, y: 0 })).toBe(
      false
    );
  });

  it("intersects the stage plane and preserves the original grab offset", () => {
    expect(
      intersectGroundPlane(
        { x: 0, y: 4, z: 0 },
        { x: 0.5, y: -1, z: 0.25 },
        0,
        { x: 1, z: -2 }
      )
    ).toEqual({ x: 3, z: -1 });
  });

  it("rejects grazing rays instead of sending a performer toward infinity", () => {
    expect(
      intersectGroundPlane(
        { x: 0, y: 4, z: 0 },
        { x: 1, y: -0.00001, z: 0 },
        0,
        { x: 0, z: 0 }
      )
    ).toBeNull();
  });

  it("clamps to the stable deck bounds with performer clearance", () => {
    expect(
      clampPerformerPosition(
        { x: 20, z: -20 },
        { width: 10, depth: 8, zOffset: 1 },
        0.5
      )
    ).toEqual({ x: 4.5, z: -2.5 });
  });

  it("projects Shift-drag movement onto the nearest of eight ground directions", () => {
    const cases = [
      { target: { x: 3, z: 0.5 }, angle: 0 },
      { target: { x: 3, z: 2 }, angle: Math.PI / 4 },
      { target: { x: 0.5, z: 3 }, angle: Math.PI / 2 },
      { target: { x: -2, z: 3 }, angle: (3 * Math.PI) / 4 },
      { target: { x: -3, z: 0.5 }, angle: Math.PI },
      { target: { x: -3, z: -2 }, angle: (-3 * Math.PI) / 4 },
      { target: { x: -0.5, z: -3 }, angle: -Math.PI / 2 },
      { target: { x: 2, z: -3 }, angle: -Math.PI / 4 },
    ];

    for (const { target, angle } of cases) {
      const snapped = snapStagePositionToEightDirections(
        { x: 0, z: 0 },
        target
      );
      expect(Math.atan2(snapped.z, snapped.x)).toBeCloseTo(angle);
    }

    expectPositionCloseTo(
      snapStagePositionToEightDirections({ x: 0, z: 0 }, { x: 3, z: 2 }),
      { x: 2.5, z: 2.5 }
    );
    expectPositionCloseTo(
      snapStagePositionToEightDirections({ x: 1, z: 2 }, { x: 4, z: 2.4 }),
      { x: 4, z: 2 }
    );
  });

  it("stops constrained diagonal movement at the first stage edge", () => {
    expectPositionCloseTo(
      resolvePerformerDragPosition(
        { x: 4, z: 0 },
        { x: 9, z: 5 },
        { width: 10, depth: 10 },
        true
      ),
      { x: 4.5, z: 0.5 }
    );
  });

  it("leaves free dragging unconstrained when Shift is not held", () => {
    expect(
      resolvePerformerDragPosition(
        { x: 0, z: 0 },
        { x: 3, z: 2 },
        { width: 10, depth: 10 },
        false
      )
    ).toEqual({ x: 3, z: 2 });
  });

  it("snaps camera-relative arrow movement to the nearest stage axis", () => {
    expect(resolveCameraRelativeNudge("ArrowUp", Math.PI / 2, 0.25)).toEqual({
      x: -0.25,
      z: 0,
    });
    expect(resolveCameraRelativeNudge("ArrowRight", Math.PI / 2, 1)).toEqual({
      x: 0,
      z: -1,
    });
  });
});

describe("performer press vs camera-controls listener ordering", () => {
  function firePointer(
    target: EventTarget,
    type: string,
    init: { clientX: number; clientY: number; pointerId?: number }
  ): void {
    const Ctor =
      typeof PointerEvent !== "undefined" ? PointerEvent : MouseEvent;
    const event = new Ctor(type, {
      bubbles: true,
      cancelable: true,
      clientX: init.clientX,
      clientY: init.clientY,
      button: 0,
    });
    if (!("pointerId" in event)) {
      Object.defineProperty(event, "pointerId", {
        value: init.pointerId ?? 1,
      });
      Object.defineProperty(event, "pointerType", { value: "mouse" });
    }
    target.dispatchEvent(event);
  }

  function buildHarness() {
    // The global test setup replaces document.createElement with inert mocks
    // that cannot dispatch events, so the canvas stand-in is a raw
    // EventTarget — jsdom's dispatch honors capture ordering, which is the
    // behavior under test.
    const canvas = new EventTarget() as unknown as HTMLCanvasElement;
    Object.assign(canvas, {
      style: {},
      getBoundingClientRect: () =>
        ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect,
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
    });

    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 2, 8);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const proxy = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    proxy.userData = { performerIndex: 0, performerPickTarget: true };
    proxy.updateMatrixWorld(true);

    const viewer = {
      selectedPerformerIndex: null as number | null,
      isCameraDragging: false,
      performerManager: {
        performers: [{ position: { x: 0, z: 0 } }],
        handleDrag: vi.fn(),
      },
      selectPerformerScope: vi.fn(),
      beginSpatialEdit: vi.fn(),
      endSpatialEdit: vi.fn(),
      cancelSpatialEdit: vi.fn(),
      markFormationCustom: vi.fn(),
      cameraChoreography: { controls: null },
    };

    // Simulates orbit controls: registered on the canvas BEFORE the
    // interaction attaches, flags a camera drag on pointerdown — the exact
    // ordering that suppressed every performer press before the capture fix.
    const orbitDown = vi.fn(() => {
      viewer.isCameraDragging = true;
    });
    canvas.addEventListener("pointerdown", orbitDown);

    const interaction = createPerformerPointerInteraction({
      canvas,
      camera: () => camera,
      viewer,
      groundY: () => 0,
      stageBounds: () => ({ width: 10, depth: 10, zOffset: 0 }),
    });
    interaction.registerPickTarget(proxy);
    const detach = interaction.attach();
    return { canvas, viewer, orbitDown, interaction, detach };
  }

  it("selects a performer even though the camera listener registered first", () => {
    const { canvas, viewer, orbitDown, detach } = buildHarness();
    firePointer(canvas, "pointerdown", { clientX: 50, clientY: 50 });
    expect(orbitDown).not.toHaveBeenCalled();
    firePointer(canvas, "pointerup", { clientX: 50, clientY: 50 });
    expect(viewer.selectPerformerScope).toHaveBeenCalledWith(0);
    detach();
  });

  it("consumes Escape when it deselects, so the viewer shell stays open", () => {
    const { canvas, viewer, detach } = buildHarness();
    viewer.selectedPerformerIndex = 0;
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(escape);
    expect(viewer.selectPerformerScope).toHaveBeenCalledWith(null);
    expect(escape.defaultPrevented).toBe(true);
    detach();
  });

  it("lets Escape through when nothing is selected", () => {
    const { canvas, viewer, detach } = buildHarness();
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(escape);
    expect(viewer.selectPerformerScope).not.toHaveBeenCalled();
    expect(escape.defaultPrevented).toBe(false);
    detach();
  });

  it("lets an empty press through to the camera controls", () => {
    const { canvas, viewer, orbitDown, detach } = buildHarness();
    firePointer(canvas, "pointerdown", { clientX: 2, clientY: 2 });
    expect(orbitDown).toHaveBeenCalledTimes(1);
    expect(viewer.selectPerformerScope).not.toHaveBeenCalled();
    detach();
  });
});
