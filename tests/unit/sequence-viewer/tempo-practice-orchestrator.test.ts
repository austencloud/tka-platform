import { describe, it, expect } from "vitest";
import { TempoPracticeOrchestrator } from "$lib/shared/sequence-viewer/services/tempo-practice-orchestrator";

describe("TempoPracticeOrchestrator", () => {
  it("defaults to smooth progression", () => {
    const o = new TempoPracticeOrchestrator();
    o.start();
    expect(o.getProgress().progressionMode).toBe("smooth");
  });

  it("migrates legacy 'auto' configs to the new 'smooth' default", () => {
    const o = new TempoPracticeOrchestrator();
    // Persisted configs from before the rename still carry "auto" — the old
    // default auto-ramp, which now maps to the gentle smooth default.
    o.start({ progressionMode: "auto" as never });
    expect(o.getProgress().progressionMode).toBe("smooth");
  });

  it("smooth mode raises BPM by smoothStep every loop", () => {
    const o = new TempoPracticeOrchestrator();
    const start = o.start({ startBpm: 20, smoothStep: 1, progressionMode: "smooth" });
    expect(start).toBe(20);
    expect(o.onLoopComplete()).toBe(21);
    expect(o.onLoopComplete()).toBe(22);
    expect(o.onLoopComplete()).toBe(23);
    // Smooth has no levels — the readout stays at 0.
    expect(o.getProgress().currentLevel).toBe(0);
  });

  it("smooth mode stops when it reaches maxBpm", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 299, smoothStep: 1, maxBpm: 300, progressionMode: "smooth" });
    expect(o.onLoopComplete()).toBe(300);
    expect(o.isActive()).toBe(true);
    expect(o.onLoopComplete()).toBeNull(); // capped -> stop
    expect(o.isActive()).toBe(false);
  });

  it("tracks loopsCompleted / loopsRemaining within a level", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, roundsPerLevel: 3, progressionMode: "manual" });
    expect(o.getProgress().loopsRemaining).toBe(3);
    o.onLoopComplete();
    expect(o.getProgress().loopsCompleted).toBe(1);
    expect(o.getProgress().loopsRemaining).toBe(2);
    o.onLoopComplete();
    o.onLoopComplete();
    expect(o.getProgress().loopsRemaining).toBe(0); // level complete
  });

  it("stepped mode bumps BPM after roundsPerLevel loops", () => {
    const o = new TempoPracticeOrchestrator();
    const start = o.start({ startBpm: 20, increment: 5, roundsPerLevel: 3, progressionMode: "stepped" });
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
    expect(p.currentLevel).toBe(1); // derived from BPM
  });

  it("decreaseLevel drops one increment and floors at the start tempo", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, increment: 5, roundsPerLevel: 3, progressionMode: "stepped" });
    expect(o.advanceLevel()).toBe(25);
    expect(o.advanceLevel()).toBe(30);
    expect(o.decreaseLevel()).toBe(25);
    expect(o.getProgress().currentLevel).toBe(1);
    expect(o.decreaseLevel()).toBe(20);
    expect(o.decreaseLevel()).toBeNull(); // at the floor, no change
    expect(o.getProgress().currentBpm).toBe(20);
    expect(o.isActive()).toBe(true); // floor never stops the session
  });

  it("derives the level from BPM so fine-trim can't desync it", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, increment: 5, progressionMode: "stepped" });
    o.advanceLevel(); // 25 -> level 1
    expect(o.getProgress().currentLevel).toBe(1);
    o.adjustBpm(22); // fine-trim down between levels
    expect(o.getProgress().currentBpm).toBe(22);
    expect(o.getProgress().currentLevel).toBe(0); // round((22-20)/5) = 0
  });

  it("hold freezes the auto-climb until released", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, smoothStep: 1, progressionMode: "smooth" });
    expect(o.onLoopComplete()).toBe(21);
    o.setHeld(true);
    expect(o.getProgress().held).toBe(true);
    expect(o.onLoopComplete()).toBeNull(); // frozen
    expect(o.onLoopComplete()).toBeNull();
    expect(o.getProgress().currentBpm).toBe(21);
    o.setHeld(false);
    expect(o.onLoopComplete()).toBe(22); // resumes from where it froze
  });

  it("Faster still works while held", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, increment: 5, smoothStep: 1, progressionMode: "smooth" });
    o.setHeld(true);
    expect(o.advanceLevel()).toBe(25); // manual override ignores hold
    expect(o.getProgress().held).toBe(true); // still held at the new speed
    expect(o.onLoopComplete()).toBeNull(); // auto-climb stays frozen
  });

  it("stepped mode stops when it reaches maxBpm", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 295, increment: 5, roundsPerLevel: 1, maxBpm: 300, progressionMode: "stepped" });
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

  it("returns null from loop/advance/decrease when not active", () => {
    const o = new TempoPracticeOrchestrator();
    expect(o.onLoopComplete()).toBeNull();
    expect(o.advanceLevel()).toBeNull();
    expect(o.decreaseLevel()).toBeNull();
  });

  it("target mode creeps up by smoothStep toward the goal", () => {
    const o = new TempoPracticeOrchestrator();
    const start = o.start({ startBpm: 20, smoothStep: 1, targetBpm: 23, progressionMode: "target" });
    expect(start).toBe(20);
    expect(o.onLoopComplete()).toBe(21);
    expect(o.onLoopComplete()).toBe(22);
    expect(o.getProgress().currentLevel).toBe(0); // creeps like smooth, no levels
    expect(o.getProgress().reachedTarget).toBe(false);
  });

  it("target mode stops at the goal and flags reachedTarget", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, smoothStep: 1, targetBpm: 22, progressionMode: "target" });
    expect(o.onLoopComplete()).toBe(21);
    expect(o.onLoopComplete()).toBe(22); // lands on the goal
    const p = o.getProgress();
    expect(p.currentBpm).toBe(22);
    expect(p.reachedTarget).toBe(true);
    expect(o.isActive()).toBe(false); // reaching the goal ends the session
  });

  it("target mode caps the goal at maxBpm", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, smoothStep: 5, targetBpm: 500, maxBpm: 30, progressionMode: "target" });
    expect(o.getProgress().targetBpm).toBe(30); // clamped to maxBpm
    expect(o.onLoopComplete()).toBe(25);
    expect(o.onLoopComplete()).toBe(30); // stops at the cap-as-goal
    expect(o.getProgress().reachedTarget).toBe(true);
  });

  it("progress.targetBpm reflects the cap outside target mode", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, maxBpm: 200, progressionMode: "smooth" });
    expect(o.getProgress().targetBpm).toBe(200);
    expect(o.getProgress().reachedTarget).toBe(false);
  });

  it("setProgressionMode switches the ramp live without restarting", () => {
    const o = new TempoPracticeOrchestrator();
    o.start({ startBpm: 20, smoothStep: 1, increment: 5, roundsPerLevel: 3, progressionMode: "smooth" });
    expect(o.onLoopComplete()).toBe(21); // smooth creep
    o.setProgressionMode("stepped");
    expect(o.getProgress().progressionMode).toBe("stepped");
    expect(o.getProgress().currentBpm).toBe(21); // preserved
    expect(o.onLoopComplete()).toBeNull(); // stepped now: holds for the round set
  });
});
