// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  CameraControls,
  resolveCameraControlsRightAction,
} from "$lib/shared/3d/camera/camera-controls-runtime";
import type { ApplicationThreadCameraFrameScheduler } from "$lib/shared/3d/worker-renderer/domain/application-thread-camera";
import { ApplicationThreadCameraController } from "$lib/shared/3d/worker-renderer/services/application-thread-camera-controller";

class ManualFrameScheduler implements ApplicationThreadCameraFrameScheduler {
  private nextHandle = 1;
  private callbacks = new Map<number, FrameRequestCallback>();

  request(callback: FrameRequestCallback): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  step(now: number): void {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of callbacks) callback(now);
  }

  get pendingFrames(): number {
    return this.callbacks.size;
  }
}

function createElement(): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    clientWidth: { value: 800 },
    clientHeight: { value: 400 },
    ownerDocument: { value: document },
    getBoundingClientRect: {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        right: 800,
        bottom: 400,
        left: 0,
        width: 800,
        height: 400,
        toJSON: () => ({}),
      }),
    },
  });
  return element as HTMLElement;
}

describe("ApplicationThreadCameraController", () => {
  it("owns the current camera pose and emits a worker-safe rolled snapshot", () => {
    const scheduler = new ManualFrameScheduler();
    const roll = Math.PI / 6;
    const controller = new ApplicationThreadCameraController(createElement(), {
      initialPosition: { x: 2, y: 3, z: 8 },
      initialTarget: { x: 0, y: 1, z: 0 },
      fov: 47,
      roll,
      frameScheduler: scheduler,
    });

    const snapshot = controller.getSnapshot();
    expect(snapshot.position[0]).toBeCloseTo(2);
    expect(snapshot.position[1]).toBeCloseTo(3);
    expect(snapshot.position[2]).toBeCloseTo(8);
    expect(snapshot.target[0]).toBeCloseTo(0);
    expect(snapshot.target[1]).toBeCloseTo(1);
    expect(snapshot.target[2]).toBeCloseTo(0);
    expect(snapshot.fov).toBe(47);
    expect(snapshot.roll).toBe(roll);
    expect(snapshot.up).toEqual([0, 1, 0]);
    expect(snapshot.quaternion).toHaveLength(4);
    expect(snapshot.quaternion).toEqual(controller.camera.quaternion.toArray());
    expect(controller.camera.aspect).toBe(2);

    controller.dispose();
  });

  it("preserves the shared right, middle, and two-finger actions", () => {
    const panning = new ApplicationThreadCameraController(createElement(), {
      initialPosition: [0, 2, 8],
      initialTarget: [0, 0, 0],
      enablePan: true,
      frameScheduler: new ManualFrameScheduler(),
    });
    const orbitOnly = new ApplicationThreadCameraController(createElement(), {
      initialPosition: [0, 2, 8],
      initialTarget: [0, 0, 0],
      enablePan: false,
      frameScheduler: new ManualFrameScheduler(),
    });
    const rightOrbit = new ApplicationThreadCameraController(createElement(), {
      initialPosition: [0, 2, 8],
      initialTarget: [0, 0, 0],
      rightDragAction: "rotate",
      frameScheduler: new ManualFrameScheduler(),
    });

    expect(panning.controls.mouseButtons.right).toBe(
      CameraControls.ACTION.TRUCK
    );
    expect(panning.controls.mouseButtons.middle).toBe(
      CameraControls.ACTION.DOLLY
    );
    expect(panning.controls.touches.two).toBe(
      CameraControls.ACTION.TOUCH_DOLLY_TRUCK
    );
    expect(orbitOnly.controls.mouseButtons.right).toBe(
      CameraControls.ACTION.NONE
    );
    expect(orbitOnly.controls.mouseButtons.middle).toBe(
      CameraControls.ACTION.DOLLY
    );
    expect(orbitOnly.controls.touches.two).toBe(
      CameraControls.ACTION.TOUCH_DOLLY_ROTATE
    );
    expect(rightOrbit.controls.mouseButtons.right).toBe(
      CameraControls.ACTION.ROTATE
    );
    expect(resolveCameraControlsRightAction("pan", false)).toBe(
      CameraControls.ACTION.TRUCK
    );

    panning.dispose();
    orbitOnly.dispose();
    rightOrbit.dispose();
  });

  it("updates on animation frames and stops cleanly while paused or disposed", () => {
    const scheduler = new ManualFrameScheduler();
    const onChange = vi.fn();
    const controller = new ApplicationThreadCameraController(createElement(), {
      initialPosition: [0, 2, 8],
      initialTarget: [0, 0, 0],
      autoRotate: true,
      frameScheduler: scheduler,
      onChange,
    });
    const update = vi.spyOn(controller.controls, "update");

    expect(scheduler.pendingFrames).toBe(1);
    scheduler.step(1_000);
    scheduler.step(1_016);
    expect(update).toHaveBeenNthCalledWith(1, 0);
    expect(update).toHaveBeenNthCalledWith(2, 0.016);
    expect(onChange).toHaveBeenCalled();

    controller.pause();
    expect(controller.isPaused).toBe(true);
    expect(scheduler.pendingFrames).toBe(0);
    scheduler.step(2_000);
    expect(update).toHaveBeenCalledTimes(2);

    controller.resume();
    expect(scheduler.pendingFrames).toBe(1);
    scheduler.step(3_000);
    expect(update).toHaveBeenLastCalledWith(0);

    controller.dispose();
    expect(controller.isDisposed).toBe(true);
    expect(scheduler.pendingFrames).toBe(0);
    expect(() => controller.resume()).toThrow("is disposed");
  });

  it("snaps immediately, reports changes and control-end snapshots", async () => {
    const scheduler = new ManualFrameScheduler();
    const onChange = vi.fn();
    const onControlStart = vi.fn();
    const onControlEnd = vi.fn();
    const controller = new ApplicationThreadCameraController(createElement(), {
      initialPosition: [0, 2, 8],
      initialTarget: [0, 0, 0],
      minDistance: 2,
      maxDistance: 40,
      frameScheduler: scheduler,
      onChange,
      onControlStart,
      onControlEnd,
    });

    await controller.snapTo([4, 5, 12], [1, 1, 0], undefined, false);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        position: [4, 5, 12],
        target: [1, 1, 0],
      })
    );
    expect(controller.controls.minDistance).toBe(2);
    expect(controller.controls.maxDistance).toBe(40);

    controller.controls.dispatchEvent({ type: "controlstart" });
    controller.controls.dispatchEvent({ type: "controlend" });
    expect(onControlStart).toHaveBeenCalledWith(controller.getSnapshot());
    expect(onControlEnd).toHaveBeenCalledWith(controller.getSnapshot());

    controller.dispose();
  });

  it("reports the current animated pose instead of the transition endpoint", () => {
    const scheduler = new ManualFrameScheduler();
    const controller = new ApplicationThreadCameraController(createElement(), {
      initialPosition: [0, 2, 8],
      initialTarget: [0, 0, 0],
      frameScheduler: scheduler,
    });

    void controller.snapTo([12, 8, 20], [4, 2, 1]);
    scheduler.step(1_000);
    scheduler.step(1_016);

    const snapshot = controller.getSnapshot();
    expect(snapshot.position).toEqual(controller.camera.position.toArray());
    expect(snapshot.position).not.toEqual([12, 8, 20]);
    expect(snapshot.target).not.toEqual([4, 2, 1]);

    controller.dispose();
  });
});
