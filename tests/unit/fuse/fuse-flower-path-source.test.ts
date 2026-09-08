import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { Flower } from "$lib/shared/shape-matrix/domain/flower-signature";

const mocks = vi.hoisted(() => ({
  buildFlowerSequence: vi.fn(),
  loadDiamondEdges: vi.fn(),
  resolveFlowerArchetype: vi.fn(),
  resolveRotationStyleMatrices: vi.fn(),
}));

vi.mock("$lib/features/lab/vtg-lab/services/build-flower-sequence", () => ({
  buildFlowerSequence: mocks.buildFlowerSequence,
}));
vi.mock("$lib/features/choreo-card/services/pictograph-letter-lookup", () => ({
  loadDiamondEdges: mocks.loadDiamondEdges,
}));
vi.mock("$lib/shared/shape-matrix/services/flower-archetype", () => ({
  resolveFlowerArchetype: mocks.resolveFlowerArchetype,
}));
vi.mock(
  "$lib/features/lab/vtg-lab/services/resolve-rotation-style-matrices",
  () => ({ resolveRotationStyleMatrices: mocks.resolveRotationStyleMatrices })
);

import { buildFuseFlowerPath } from "$lib/features/fuse/services/fuse-flower-path-source";

const flower: Flower = {
  style: "pro",
  turns: 1,
  ori: "in",
  grid: "diamond",
  petals: 2,
};

const sequence = {
  id: "flower",
  name: "flower",
  word: "A",
  steps: [],
} as unknown as SequenceData;

describe("buildFuseFlowerPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRotationStyleMatrices.mockResolvedValue({ pro: sequence });
    mocks.loadDiamondEdges.mockResolvedValue([]);
    mocks.resolveFlowerArchetype.mockReturnValue(sequence);
    mocks.buildFlowerSequence.mockReturnValue(sequence);
  });

  it.each(["left", "right"] as const)(
    "passes the performer-relative %s hand to the shared flower builder",
    async (side) => {
      await buildFuseFlowerPath(flower, side);

      expect(mocks.buildFlowerSequence).toHaveBeenCalledWith(
        sequence,
        flower,
        side,
        []
      );
    }
  );
});
