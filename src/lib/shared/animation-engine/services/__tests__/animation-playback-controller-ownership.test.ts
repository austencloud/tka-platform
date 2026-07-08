import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnimationPlaybackController } from "../animation-playback-controller";
import { AnimationLoop } from "../animation-loop";
import type { SequenceAnimationOrchestrator } from "../sequence-animation-orchestrator";
import type { AnimationPanelState } from "../../state/animation-panel-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

// Regression guard for the "HMR pauses the animation and play/pause goes dead"
// bug in the sequence viewer.
//
// AnimationPlaybackController is a MODULE SINGLETON (getAnimationPlaybackController),
// but each viewer/player host owns a PER-INSTANCE AnimationPanelState and claims
// the singleton via initialize(seq, myState), releasing it via dispose().
//
// During an HMR remount the new host instance mounts and re-claims the singleton
// (initialize(seq, newState)) BEFORE the outgoing host's onDestroy fires. The
// outgoing host's dispose() then nulled `this.state` on the shared singleton —
// clobbering the live claim. After that togglePlayback() early-returns
// (`if (!this.state) return`), so play/pause is dead and the clock never advances
// the props, while the freshly-mounted per-instance render loop keeps painting
// effects. Only a full page reload rebuilt the singleton.
//
// The fix makes dispose(owner) ownership-aware: a stale owner disposing after a
// newer claim is a no-op.
describe("AnimationPlaybackController ownership (HMR remount clobber)", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 123));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeState(): AnimationPanelState {
    let isPlaying = false;
    return {
      get isPlaying() {
        return isPlaying;
      },
      get playbackMode() {
        return "continuous";
      },
      get speed() {
        return 1;
      },
      setIsPlaying: vi.fn((v: boolean) => {
        isPlaying = v;
      }),
      setCurrentStep: vi.fn(),
      setTotalSteps: vi.fn(),
      setSequenceMetadata: vi.fn(),
      setPropStates: vi.fn(),
      setSequenceData: vi.fn(),
    } as unknown as AnimationPanelState;
  }

  function makeEngine(): SequenceAnimationOrchestrator {
    return {
      initializeWithDomainData: vi.fn(() => true),
      getMetadata: vi.fn(() => ({ totalSteps: 4, word: "TEST", author: "x" })),
      getTotalDurationWithStartPosition: vi.fn(() => 4),
      getCurrentPropStates: vi.fn(() => ({ blue: {}, red: {} })),
      getActiveVisibilityManager: vi.fn(() => ({ setSpeed: vi.fn() })),
    } as unknown as SequenceAnimationOrchestrator;
  }

  // steps.length < 1 → isSeamlesslyLoopable returns false without touching the
  // rest of the shape, so an empty-steps stub is a safe minimal sequence.
  const seq = { steps: [] } as unknown as SequenceData;

  it("a stale owner's dispose() does not clobber a newer owner's live claim", () => {
    const loop = new AnimationLoop();
    const controller = new AnimationPlaybackController(makeEngine(), loop);
    const stateA = makeState(); // outgoing viewer (pre-HMR)
    const stateB = makeState(); // incoming viewer (post-HMR)

    controller.initialize(seq, stateA); // viewer A claims the singleton
    controller.initialize(seq, stateB); // HMR: viewer B re-claims it

    controller.dispose(stateA); // A's onDestroy fires late — must NOT clobber B

    (stateB.setIsPlaying as ReturnType<typeof vi.fn>).mockClear();

    // Play/pause must still drive the live owner (B), and the clock must start.
    controller.togglePlayback();

    expect(stateB.setIsPlaying).toHaveBeenCalledWith(true);
    expect(loop.isRunning()).toBe(true);
  });

  it("the current owner's dispose() still tears down (no regression)", () => {
    const loop = new AnimationLoop();
    const controller = new AnimationPlaybackController(makeEngine(), loop);
    const stateA = makeState();

    controller.initialize(seq, stateA);
    controller.dispose(stateA); // current owner releasing — real teardown

    (stateA.setIsPlaying as ReturnType<typeof vi.fn>).mockClear();

    // After a legitimate release the controller has no state, so play is inert.
    controller.togglePlayback();

    expect(stateA.setIsPlaying).not.toHaveBeenCalledWith(true);
  });
});
