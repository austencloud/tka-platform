/**
 * CellTransformStack Tests
 *
 * Verifies that the transform stack correctly replays transforms in order,
 * returns the original sequence when the stack is empty, and that push/pop
 * operations work as expected.
 */

import { describe, it, expect, vi } from "vitest";
import { CellTransformStack } from "$lib/features/compose/tabs/arrange/services/implementations/CellTransformStack";
import type { ArrangeLayerTransformer } from "$lib/features/compose/tabs/arrange/services/implementations/ArrangeLayerTransformer";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { AppliedTransform } from "$lib/features/compose/compose/domain/types";

function makeSequence(name: string): SequenceData {
  return {
    id: `seq-${name}`,
    name,
    word: name,
    steps: [],
    thumbnails: [],
  } as unknown as SequenceData;
}

function makeMockTransformer(): ArrangeLayerTransformer {
  return {
    applyTransform: vi.fn(async (seq: SequenceData, type: string) => ({
      success: true,
      transformed: { ...seq, name: `${seq.name}+${type}` } as SequenceData,
    })),
  };
}

describe("CellTransformStack", () => {
  describe("computeEffective", () => {
    it("returns original sequence when stack is empty", async () => {
      const transformer = makeMockTransformer();
      const stack = new CellTransformStack(transformer);
      const original = makeSequence("ABC");

      const result = await stack.computeEffective(original, []);

      expect(result).toBe(original);
      expect(transformer.applyTransform).not.toHaveBeenCalled();
    });

    it("replays a single transform", async () => {
      const transformer = makeMockTransformer();
      const stack = new CellTransformStack(transformer);
      const original = makeSequence("ABC");
      const transforms: AppliedTransform[] = [
        { type: "rotate90", hand: "both", timestamp: 1 },
      ];

      const result = await stack.computeEffective(original, transforms);

      expect(result.name).toBe("ABC+rotate90");
      expect(transformer.applyTransform).toHaveBeenCalledTimes(1);
    });

    it("replays transforms in order", async () => {
      const transformer = makeMockTransformer();
      const stack = new CellTransformStack(transformer);
      const original = makeSequence("ABC");
      const transforms: AppliedTransform[] = [
        { type: "rotate90", hand: "both", timestamp: 1 },
        { type: "mirror", hand: "both", timestamp: 2 },
        { type: "swapColors", hand: "both", timestamp: 3 },
      ];

      const result = await stack.computeEffective(original, transforms);

      // Each transform appends "+type" to the name, so the final name
      // shows the full chain: ABC -> ABC+rotate90 -> ABC+rotate90+mirror -> ...
      expect(result.name).toBe("ABC+rotate90+mirror+swapColors");
      expect(transformer.applyTransform).toHaveBeenCalledTimes(3);
    });

    it("skips failed transforms and continues with the last good state", async () => {
      const transformer: ArrangeLayerTransformer = {
        applyTransform: vi.fn()
          .mockResolvedValueOnce({
            success: true,
            transformed: { ...makeSequence("ABC"), name: "ABC+rotate90" },
          })
          .mockResolvedValueOnce({ success: false, error: "failed" })
          .mockResolvedValueOnce({
            success: true,
            transformed: { ...makeSequence("ABC"), name: "ABC+rotate90+swapColors" },
          }),
      };
      const stack = new CellTransformStack(transformer);
      const original = makeSequence("ABC");
      const transforms: AppliedTransform[] = [
        { type: "rotate90", hand: "both", timestamp: 1 },
        { type: "mirror", hand: "both", timestamp: 2 },
        { type: "swapColors", hand: "both", timestamp: 3 },
      ];

      const result = await stack.computeEffective(original, transforms);

      // Mirror failed, so swapColors was applied to the rotate90 result
      expect(result.name).toBe("ABC+rotate90+swapColors");
    });
  });

  describe("push", () => {
    it("adds a transform to an empty stack", () => {
      const stack = new CellTransformStack(makeMockTransformer());
      const result = stack.push([], "rotate90", "both");

      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("rotate90");
      expect(result[0]!.hand).toBe("both");
      expect(result[0]!.timestamp).toBeGreaterThan(0);
    });

    it("appends to existing stack without mutating it", () => {
      const stack = new CellTransformStack(makeMockTransformer());
      const existing: AppliedTransform[] = [
        { type: "mirror", hand: "both", timestamp: 1 },
      ];
      const result = stack.push(existing, "rotate90", "left");

      expect(result).toHaveLength(2);
      expect(existing).toHaveLength(1); // original not mutated
      expect(result[1]!.type).toBe("rotate90");
      expect(result[1]!.hand).toBe("left");
    });
  });

  describe("pop", () => {
    it("removes the last transform", () => {
      const stack = new CellTransformStack(makeMockTransformer());
      const existing: AppliedTransform[] = [
        { type: "mirror", hand: "both", timestamp: 1 },
        { type: "rotate90", hand: "both", timestamp: 2 },
      ];
      const result = stack.pop(existing);

      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("mirror");
      expect(existing).toHaveLength(2); // original not mutated
    });

    it("returns empty array when popping from single-item stack", () => {
      const stack = new CellTransformStack(makeMockTransformer());
      const existing: AppliedTransform[] = [
        { type: "mirror", hand: "both", timestamp: 1 },
      ];
      const result = stack.pop(existing);

      expect(result).toHaveLength(0);
    });

    it("returns empty array when popping from empty stack", () => {
      const stack = new CellTransformStack(makeMockTransformer());
      const result = stack.pop([]);

      expect(result).toHaveLength(0);
    });
  });

  describe("clear", () => {
    it("returns an empty array", () => {
      const stack = new CellTransformStack(makeMockTransformer());
      const result = stack.clear();

      expect(result).toEqual([]);
    });
  });
});
