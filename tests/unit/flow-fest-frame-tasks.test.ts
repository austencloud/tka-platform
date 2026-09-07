import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// Threlte publishes its scheduler classes as types only; the runtime sits
// behind the `useTask` hook, which needs a <Canvas> context. The classes
// themselves are plain, so the test reaches them by path and runs the real
// ordering rules rather than a re-implementation of them.
import { Scheduler } from "../../node_modules/@threlte/core/dist/frame-scheduling/index.js";
import {
  FLOW_FEST_DRIVEN_CAR_POSE_TASK,
  FLOW_FEST_WORLD_STEP_TASK,
} from "../../src/routes/test/flow-fest-sim/flow-fest-frame-tasks";

const SCENE_SOURCE_PATH = resolve(
  process.cwd(),
  "src/routes/test/flow-fest-graybox/FlowFestGrayboxWalkScene.svelte"
);
const CAR_SOURCE_PATH = resolve(
  process.cwd(),
  "src/routes/test/flow-fest-sim/FlowFestDrivenCar.svelte"
);

function mainStage() {
  return new Scheduler().createStage(Symbol("threlte-main-stage"));
}

describe("Flow Fest frame tasks", () => {
  it("runs the driven car pose after the world step and ahead of the unkeyed chase camera", () => {
    const stage = mainStage();
    const order: string[] = [];
    // Registration order on the real page: the scene script runs before any
    // child mounts, the camera controller mounts with the scene, and the car
    // appears only once the loadout hands over the wheel.
    stage.createTask(FLOW_FEST_WORLD_STEP_TASK, () => {
      order.push("world-step");
    });
    stage.createTask(Symbol("useTask"), () => {
      order.push("chase-camera");
    });
    stage.createTask(
      FLOW_FEST_DRIVEN_CAR_POSE_TASK,
      () => {
        order.push("driven-car-pose");
      },
      { after: FLOW_FEST_WORLD_STEP_TASK }
    );
    stage.run(1 / 60);
    expect(order).toEqual(["world-step", "driven-car-pose", "chase-camera"]);
  });

  it("keeps that order when the scene registers after the car, as a hot reload does", () => {
    const stage = mainStage();
    const order: string[] = [];
    stage.createTask(Symbol("useTask"), () => {
      order.push("chase-camera");
    });
    stage.createTask(
      FLOW_FEST_DRIVEN_CAR_POSE_TASK,
      () => {
        order.push("driven-car-pose");
      },
      { after: FLOW_FEST_WORLD_STEP_TASK }
    );
    stage.createTask(FLOW_FEST_WORLD_STEP_TASK, () => {
      order.push("world-step");
    });
    stage.run(1 / 60);
    expect(order).toEqual(["world-step", "driven-car-pose", "chase-camera"]);
  });

  it("leaves the world step ahead of the camera once the car is gone", () => {
    const stage = mainStage();
    const order: string[] = [];
    stage.createTask(FLOW_FEST_WORLD_STEP_TASK, () => {
      order.push("world-step");
    });
    stage.createTask(Symbol("useTask"), () => {
      order.push("chase-camera");
    });
    stage.createTask(
      FLOW_FEST_DRIVEN_CAR_POSE_TASK,
      () => {
        order.push("driven-car-pose");
      },
      { after: FLOW_FEST_WORLD_STEP_TASK }
    );
    // Leaving the car, or the host re-keying it on a new session.
    stage.removeTask(FLOW_FEST_DRIVEN_CAR_POSE_TASK);
    stage.run(1 / 60);
    expect(order).toEqual(["world-step", "chase-camera"]);
  });

  it("is the edge the scene and the car actually register", () => {
    const scene = readFileSync(SCENE_SOURCE_PATH, "utf8");
    const car = readFileSync(CAR_SOURCE_PATH, "utf8");
    expect(scene).toContain("useTask(FLOW_FEST_WORLD_STEP_TASK, (delta) => {");
    expect(car).toContain("after: FLOW_FEST_WORLD_STEP_TASK");
    // The body group takes no transform props. A prop lands through a Svelte
    // effect one flush after the frame that produced it, which is exactly
    // the lag the pose task exists to remove.
    const bodyTagStart = car.indexOf("FFS_DrivenCar_${model.id}");
    expect(bodyTagStart).toBeGreaterThan(0);
    const bodyTag = car.slice(bodyTagStart, car.indexOf(">", bodyTagStart));
    expect(bodyTag).toContain("bind:ref=");
    expect(bodyTag).not.toContain("position=");
    expect(bodyTag).not.toContain("rotation=");
  });
});
