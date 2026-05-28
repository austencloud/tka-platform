import { describe, it, expect, vi, beforeEach } from "vitest";
import { PropGeometryAdjustmentRepository } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/services/implementations/PropGeometryAdjustmentRepository";
import type { PropGeometryAdjustmentInput, PropGeometryKey } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/domain/PropGeometryAdjustment";

// Force admin so the guard passes.
vi.mock("$lib/shared/auth/state/authState.svelte", () => ({
  authState: { user: { email: "austencloud@gmail.com" } },
}));

function makePersister() {
  return {
    loadAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => {}),
  };
}

const input: PropGeometryAdjustmentInput = {
  gridMode: "diamond",
  propType: "staff",
  otherPropType: "staff",
  positionType: "beta",
  endOrientation: "in",
  otherEndOrientation: "in",
  motionType: "static",
  turns: "0",
  arrowColor: "blue",
  adjustmentX: 12,
  adjustmentY: -8,
};

const key: PropGeometryKey = {
  gridMode: "diamond",
  propType: "staff",
  otherPropType: "staff",
  positionType: "beta",
  endOrientation: "in",
  otherEndOrientation: "in",
  motionType: "static",
  turns: "0",
  arrowColor: "blue",
};

describe("PropGeometryAdjustmentRepository edit parity", () => {
  let persister: ReturnType<typeof makePersister>;
  let repo: PropGeometryAdjustmentRepository;

  beforeEach(async () => {
    persister = makePersister();
    repo = new PropGeometryAdjustmentRepository(persister as never);
    await repo.initialize();
  });

  it("saveAdjustmentLocal updates in-memory state without persisting", () => {
    repo.saveAdjustmentLocal(input);
    expect(repo.getAdjustment(key)).toEqual({ x: 12, y: -8 });
    expect(repo.hasAdjustment(key)).toBe(true);
    expect(persister.save).not.toHaveBeenCalled();
  });

  it("deleteAdjustmentLocal removes from in-memory state without persisting", () => {
    repo.saveAdjustmentLocal(input);
    repo.deleteAdjustmentLocal(key);
    expect(repo.getAdjustment(key)).toBeNull();
    expect(persister.delete).not.toHaveBeenCalled();
  });

  it("deleteAdjustment persists the delete", async () => {
    await repo.deleteAdjustment(key);
    expect(persister.delete).toHaveBeenCalledTimes(1);
  });
});
