import { describe, it, expect, vi } from "vitest";

// ── Block transitive imports that crash in jsdom ──────────────────────────────
vi.mock("$lib/shared/di", () => ({ container: {} }));
vi.mock("$lib/shared/di/containers/core-container", () => ({}));
vi.mock("@firebase/firestore", () => ({}));
vi.mock("@firebase/firestore/lite", () => ({}));
vi.mock("$lib/shared/application/state/app-state.svelte", () => ({
  getSettings: vi.fn(() => ({})),
}));
vi.mock("$lib/shared/settings/services/implementations/FirebaseSettingsPersister", () => ({
  FirebaseSettingsPersister: class {},
}));
vi.mock("$lib/shared/animation-engine/state/animation-visibility-state.svelte", () => ({
  getAnimationVisibilityManager: vi.fn(() => ({ getEffortPreset: () => "linear" })),
}));
vi.mock("$lib/features/compose/utils/animation-panel-persistence", () => ({
  loadTrailSettings: vi.fn(() => ({})),
}));
vi.mock("$lib/features/compose/services/implementations/Canvas2DAnimationRenderer", () => ({
  Canvas2DAnimationRenderer: class {},
}));
vi.mock("$lib/shared/animation-engine/services/animator-loader", () => ({
  loadAnimatorServices: vi.fn(),
}));
// Mock the prop-type-applier to avoid deep landing imports
vi.mock("$lib/shared/landing/services/prop-type-applier", () => ({
  applyToSequence: vi.fn((seq: unknown) => seq),
}));
// Mock gridPositionDeriver
vi.mock("$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver", () => ({
  gridPositionDeriver: { getGridPositionFromLocations: vi.fn() },
}));

import { SequenceChainingOrchestrator } from "$lib/shared/animation-engine/services/sequence-chaining-orchestrator";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type {
  IEndlessSpinnerOrchestrator,
  IInfiniteSequenceGenerator,
  IBroadcastProvider,
} from "$lib/shared/animation-engine/domain/chaining-types";

// ── Mock factories ────────────────────────────────────────────────────────────

function mockSpinner(): IEndlessSpinnerOrchestrator {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    getInitialSequence: vi.fn().mockResolvedValue(null),
    getNextSequence: vi.fn().mockResolvedValue(null),
  };
}

function mockInfinite(): IInfiniteSequenceGenerator {
  return {
    generateInitial: vi.fn().mockResolvedValue(null),
    generateFromEndState: vi.fn().mockResolvedValue(null),
    getSessionCount: vi.fn().mockReturnValue(0),
  };
}

function mockBroadcast(): IBroadcastProvider {
  return {
    subscribeToBroadcast: vi.fn().mockReturnValue(() => {}),
    calculateServerTimeOffset: vi.fn().mockResolvedValue(0),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SequenceChainingOrchestrator — propType", () => {
  it("defaults to PropType.STAFF", () => {
    const orch = new SequenceChainingOrchestrator(mockSpinner(), mockInfinite());
    expect(orch.propType).toBe(PropType.STAFF);
  });

  it("setPropType changes propType", () => {
    const orch = new SequenceChainingOrchestrator(mockSpinner(), mockInfinite());
    orch.setPropType(PropType.FAN);
    expect(orch.propType).toBe(PropType.FAN);
  });
});

describe("SequenceChainingOrchestrator — history", () => {
  it("starts with empty history", () => {
    const orch = new SequenceChainingOrchestrator(mockSpinner(), mockInfinite());
    expect(orch.getHistory()).toEqual([]);
  });

  it("historyCapacity defaults to 30", () => {
    const orch = new SequenceChainingOrchestrator(mockSpinner(), mockInfinite());
    expect(orch.historyCapacity).toBe(30);
  });

  it("accepts custom historyCapacity via constructor options", () => {
    const orch = new SequenceChainingOrchestrator(
      mockSpinner(),
      mockInfinite(),
      undefined,
      { historyCapacity: 10 }
    );
    expect(orch.historyCapacity).toBe(10);
  });
});

describe("SequenceChainingOrchestrator — broadcast provider", () => {
  it("constructor accepts IBroadcastProvider without error", () => {
    const broadcast = mockBroadcast();
    const orch = new SequenceChainingOrchestrator(
      mockSpinner(),
      mockInfinite(),
      broadcast
    );
    // No error thrown — orchestrator constructed successfully
    expect(orch).toBeDefined();
  });
});

describe("SequenceChainingOrchestrator — live mode guards", () => {
  it("checkAndChain is a no-op for 'live' mode", () => {
    const spinner = mockSpinner();
    const orch = new SequenceChainingOrchestrator(spinner, mockInfinite());
    // Call with conditions that would normally trigger chaining
    orch.checkAndChain(0, 4, "live", true, true);
    // getNextSequence would be called if chaining proceeded — verify it wasn't
    expect(spinner.getNextSequence).not.toHaveBeenCalled();
  });

  it("checkAndPreload is a no-op for 'live' mode", () => {
    const spinner = mockSpinner();
    const infinite = mockInfinite();
    const orch = new SequenceChainingOrchestrator(spinner, infinite);
    // Call with conditions that would normally trigger preloading
    orch.checkAndPreload(3, 8, "live", true, true);
    expect(spinner.getNextSequence).not.toHaveBeenCalled();
    expect(infinite.generateFromEndState).not.toHaveBeenCalled();
  });
});
