import { describe, expect, it, vi } from "vitest";

import { createWorkerPerformerInteractionBridge } from "$lib/shared/3d/worker-renderer/services/worker-performer-interaction";

function firePointer(
  target: EventTarget,
  type: string,
  init: {
    clientX: number;
    clientY: number;
    pointerId?: number;
    pointerType?: string;
    shiftKey?: boolean;
  }
): void {
  const Ctor = typeof PointerEvent === "undefined" ? MouseEvent : PointerEvent;
  const event = new Ctor(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: init.clientX,
    clientY: init.clientY,
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? "mouse",
    shiftKey: init.shiftKey,
  });
  if (!("pointerId" in event)) {
    Object.defineProperty(event, "pointerId", {
      value: init.pointerId ?? 1,
    });
  }
  Object.defineProperty(event, "pointerType", {
    configurable: true,
    value: init.pointerType ?? "mouse",
  });
  target.dispatchEvent(event);
}

function buildHarness() {
  const captured = new Set<number>();
  const canvas = new EventTarget() as HTMLCanvasElement;
  Object.assign(canvas, {
    style: {},
    dataset: {},
    tabIndex: 0,
    getContext: vi.fn(() => {
      throw new Error("The interaction bridge must not request WebGL");
    }),
    getBoundingClientRect: () =>
      ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect,
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
  });
  const performers = [
    { position: { x: 0, z: 0 } },
    { position: { x: 1, z: 0 } },
  ];
  const viewer = {
    primaryPerformerIndex: null as number | null,
    selectedPerformerIndices: [] as number[],
    performerSelectionMode: false,
    isCameraDragging: false,
    performerManager: {
      performers,
      handleDrag: vi.fn((index: number, position: { x: number; z: number }) => {
        performers[index].position = position;
      }),
    },
    replacePerformerSelection: vi.fn((index: number) => {
      viewer.primaryPerformerIndex = index;
      viewer.selectedPerformerIndices = [index];
    }),
    togglePerformerSelection: vi.fn(),
    clearPerformerSelection: vi.fn(() => {
      viewer.primaryPerformerIndex = null;
      viewer.selectedPerformerIndices = [];
    }),
    setPerformerSelectionMode: vi.fn((value: boolean) => {
      viewer.performerSelectionMode = value;
    }),
    beginSpatialEdit: vi.fn(),
    endSpatialEdit: vi.fn(),
    cancelSpatialEdit: vi.fn(),
    markFormationCustom: vi.fn(),
  };
  const cameraArbiter = { enabled: true, azimuthAngle: 0 };
  const bridge = createWorkerPerformerInteractionBridge({
    interactionSurface: canvas,
    viewer,
    cameraArbiter,
  });
  const frame = {
    camera: {
      position: [0, 2, 8] as const,
      target: [0, 1, 0] as const,
      fov: 50,
    },
    performers: [
      { index: 0, position: performers[0].position },
      { index: 1, position: performers[1].position },
    ],
    groundY: 0,
    stageBounds: { width: 10, depth: 10 },
  };
  expect(bridge.update(frame)).toEqual({ supported: true });
  expect(bridge.attach()).toEqual({ supported: true });
  return { bridge, cameraArbiter, canvas, captured, frame, performers, viewer };
}

describe("worker performer interaction bridge", () => {
  it("selects and hovers through the canonical proxy without WebGL", () => {
    const { bridge, canvas, captured, viewer } = buildHarness();
    firePointer(canvas, "pointermove", { clientX: 50, clientY: 50 });
    expect(bridge.hoveredIndex).toBe(0);

    firePointer(canvas, "pointerdown", { clientX: 50, clientY: 50 });
    expect(captured.has(1)).toBe(true);
    firePointer(canvas, "pointerup", { clientX: 50, clientY: 50 });

    expect(viewer.replacePerformerSelection).toHaveBeenCalledWith(0);
    expect(captured.size).toBe(0);
    expect(canvas.getContext).not.toHaveBeenCalled();
    bridge.dispose();
  });

  it("keeps the visible performer badge as a direct selection target", () => {
    const { bridge, canvas, frame, viewer } = buildHarness();
    const badgeWorldY = 2.4;
    expect(
      bridge.update({
        ...frame,
        performers: [
          {
            ...frame.performers[0],
            badge: { visible: true, worldY: badgeWorldY },
          },
          frame.performers[1],
        ],
      })
    ).toEqual({ supported: true });
    const badge = bridge.projectStagePosition({ x: 0, z: 0 }, badgeWorldY);
    expect(badge?.visible).toBe(true);

    firePointer(canvas, "pointerdown", {
      clientX: badge!.x,
      clientY: badge!.y,
    });
    firePointer(canvas, "pointerup", {
      clientX: badge!.x,
      clientY: badge!.y,
    });

    expect(viewer.replacePerformerSelection).toHaveBeenCalledWith(0);
    bridge.dispose();
  });

  it("preserves grouped drag, camera arbitration, and one undo boundary", () => {
    const { bridge, cameraArbiter, canvas, viewer } = buildHarness();
    viewer.primaryPerformerIndex = 0;
    viewer.selectedPerformerIndices = [0, 1];

    firePointer(canvas, "pointerdown", { clientX: 50, clientY: 50 });
    firePointer(canvas, "pointermove", { clientX: 65, clientY: 50 });
    expect(cameraArbiter.enabled).toBe(false);
    firePointer(canvas, "pointerup", { clientX: 65, clientY: 50 });

    expect(cameraArbiter.enabled).toBe(true);
    expect(viewer.beginSpatialEdit).toHaveBeenCalledTimes(1);
    expect(viewer.endSpatialEdit).toHaveBeenCalledTimes(1);
    expect(viewer.cancelSpatialEdit).not.toHaveBeenCalled();
    expect(viewer.markFormationCustom).toHaveBeenCalledTimes(1);
    expect(
      viewer.performerManager.handleDrag.mock.calls.map(([index]) => index)
    ).toEqual([0, 1]);
    bridge.dispose();
  });

  it("cancels an active drag and restores its starting positions", () => {
    const { bridge, canvas, performers, viewer } = buildHarness();
    viewer.primaryPerformerIndex = 0;
    viewer.selectedPerformerIndices = [0];

    firePointer(canvas, "pointerdown", { clientX: 50, clientY: 50 });
    firePointer(canvas, "pointermove", { clientX: 65, clientY: 50 });
    expect(performers[0].position.x).not.toBe(0);
    firePointer(canvas, "pointercancel", { clientX: 65, clientY: 50 });

    expect(performers[0].position).toEqual({ x: 0, z: 0 });
    expect(viewer.cancelSpatialEdit).toHaveBeenCalledTimes(1);
    expect(viewer.endSpatialEdit).not.toHaveBeenCalled();
    bridge.dispose();
  });

  it("cancels an active edit and restores camera control when disposed", () => {
    const { bridge, cameraArbiter, canvas, performers, viewer } =
      buildHarness();
    viewer.primaryPerformerIndex = 0;
    viewer.selectedPerformerIndices = [0];

    firePointer(canvas, "pointerdown", { clientX: 50, clientY: 50 });
    firePointer(canvas, "pointermove", { clientX: 65, clientY: 50 });
    expect(cameraArbiter.enabled).toBe(false);
    expect(performers[0].position.x).not.toBe(0);

    bridge.dispose();

    expect(cameraArbiter.enabled).toBe(true);
    expect(performers[0].position).toEqual({ x: 0, z: 0 });
    expect(viewer.cancelSpatialEdit).toHaveBeenCalledTimes(1);
    expect(viewer.endSpatialEdit).not.toHaveBeenCalled();
  });

  it("projects the existing DOM move-handle anchor from the worker camera", () => {
    const { bridge } = buildHarness();
    const projected = bridge.projectStagePosition({ x: 0, z: 0 }, 1);
    expect(projected).not.toBeNull();
    expect(projected?.x).toBeCloseTo(50);
    expect(projected?.y).toBeCloseTo(50);
    expect(projected?.visible).toBe(true);
    bridge.dispose();
  });

  it("detaches instead of accepting an unsupported surface-anchor update", () => {
    const { bridge, canvas, frame, viewer } = buildHarness();
    expect(
      bridge.update({ ...frame, requireRenderedSurfaceAnchors: true })
    ).toEqual({
      supported: false,
      blockers: ["rendered-surface-anchor-unavailable"],
    });

    firePointer(canvas, "pointerdown", { clientX: 50, clientY: 50 });
    firePointer(canvas, "pointerup", { clientX: 50, clientY: 50 });
    expect(viewer.replacePerformerSelection).not.toHaveBeenCalled();
    bridge.dispose();
  });
});
