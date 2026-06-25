import { describe, it, expect } from "vitest";
import { TempoPracticeOrchestrator } from "$lib/shared/sequence-viewer/services/tempo-practice-orchestrator";

describe("TempoPracticeOrchestrator", () => {
  it("defaults to manual progression", () => {
    const o = new TempoPracticeOrchestrator();
    o.start();
    expect(o.getProgress().progressionMode).toBe("manual");
  });

  it("auto mode bumps BPM after roundsPerLevel loops", () => {
    const o = new TempoPracticeOrchestrator();
    const start = o.start({ startBpm: 20, increment: 5, roundsPerLevel: 3, progressionMode: "auto" });
    expect(start).toBe(20);
    expect(o.onLoopComplete()).toBeNull(); // round 1
    expect(o.onLoopComplete()).toBeNull(); // round 2
    expect(o.onLoopComplete()).toBe(25); // round 3 -> bump
    const p = o.getProgress();
    expect(p.currentBpm).toBe(25);
    expect(p.readyToAdvance).toBe(false);
  });

  it("manual mode holds BPM and flags readyToAdvance at the round cap", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, increment: 5, roundsPerLevel: 3, progressionMode: "manual" });
    expect(o.onLoopComplete()).toBeNull(); // 1
    expect(o.onLoopComplete()).toBeNull(); // 2
    expect(o.onLoopComplete()).toBeNull(); // 3 -> ready, no bump
    const p = o.getProgress();
    expect(p.currentBpm).toBe(20);
    expect(p.readyToAdvance).toBe(true);
    expect(p.currentRound).toBe(3); // clamped, never reads N+1
  });

  it("manual mode ignores extra loops once parked at the boundary", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, increment: 5, roundsPerLevel: 2, progressionMode: "manual" });
    o.onLoopComplete();
    o.onLoopComplete(); // parked
    const before = o.getProgress().totalRoundsCompleted;
    o.onLoopComplete(); // ignored
    expect(o.getProgress().totalRoundsCompleted).toBe(before);
    expect(o.getProgress().currentBpm).toBe(20);
  });

  it("advanceLevel bumps one increment, resets the round, clears the flag", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, increment: 5, roundsPerLevel: 3, progressionMode: "manual" });
    o.onLoopComplete();
    o.onLoopComplete();
    o.onLoopComplete();
    expect(o.getProgress().readyToAdvance).toBe(true);
    expect(o.advanceLevel()).toBe(25);
    const p = o.getProgress();
    expect(p.currentBpm).toBe(25);
    expect(p.currentRound).toBe(1); // reset to round 1 of the new level
    expect(p.readyToAdvance).toBe(false);
    expect(p.currentLevel).toBe(1);
  });

  it("auto mode stops when it reaches maxBpm", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 295, increment: 5, roundsPerLevel: 1, maxBpm: 300, progressionMode: "auto" });
    expect(o.onLoopComplete()).toBe(300); // 295 -> 300
    expect(o.isActive()).toBe(true);
    expect(o.onLoopComplete()).toBeNull(); // capped -> stop
    expect(o.isActive()).toBe(false);
  });

  it("advanceLevel at the cap stops the session", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 300, increment: 5, roundsPerLevel: 1, maxBpm: 300, progressionMode: "manual" });
    expect(o.advanceLevel()).toBeNull();
    expect(o.isActive()).toBe(false);
  });

  it("returns null from loop/advance when not active", () => {
    const o = new TempoPracticeOrchestrator();
    expect(o.onLoopComplete()).toBeNull();
    expect(o.advanceLevel()).toBeNull();
  });
});
