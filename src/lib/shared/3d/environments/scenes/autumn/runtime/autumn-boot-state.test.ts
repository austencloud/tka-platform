import { describe, expect, it } from "vitest";
import {
  createAutumnBootState,
  getAutumnBootProgress,
  getAutumnEnvironmentUrl,
  isAutumnBootReady,
  scheduleAutumnBootStatus,
  setAutumnBootAsset,
} from "./autumn-boot-state";

describe("Autumn boot state", () => {
  it("waits for the core GLB and for runtime textures to settle", () => {
    let state = createAutumnBootState();
    state = setAutumnBootAsset(state, "environment", "ready");
    expect(isAutumnBootReady(state)).toBe(false);
    expect(getAutumnBootProgress(state)).toBe(1 / 3);

    state = setAutumnBootAsset(state, "groundDetail", "failed");
    state = setAutumnBootAsset(state, "pondNormals", "ready");
    expect(isAutumnBootReady(state)).toBe(true);
    expect(getAutumnBootProgress(state)).toBe(1);
  });

  it("never treats a failed core GLB as ready", () => {
    expect(
      isAutumnBootReady({
        environment: "failed",
        groundDetail: "ready",
        pondNormals: "ready",
      })
    ).toBe(false);
  });

  it("delivers synchronous child readiness after the parent reset window", async () => {
    const statuses: string[] = [];
    let cancelled = false;

    scheduleAutumnBootStatus(
      (status) => statuses.push(status),
      "ready",
      () => cancelled
    );
    expect(statuses).toEqual([]);
    await Promise.resolve();
    expect(statuses).toEqual(["ready"]);

    scheduleAutumnBootStatus(
      (status) => statuses.push(status),
      "failed",
      () => cancelled
    );
    cancelled = true;
    await Promise.resolve();
    expect(statuses).toEqual(["ready"]);
  });

  it("gives each retry a distinct loader cache identity", () => {
    expect(getAutumnEnvironmentUrl(0)).toBe(
      "/models/autumn/autumn-environment.glb"
    );
    expect(getAutumnEnvironmentUrl(2.8)).toBe(
      "/models/autumn/autumn-environment.glb?retry=2"
    );
  });
});
