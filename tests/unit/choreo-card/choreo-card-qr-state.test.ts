import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { QRCodeResult } from "$lib/shared/qr/services/types";
import { createChoreoCardQrStateHarness } from "./choreo-card-qr-state-harness.svelte";

const sequence = {
  id: "sequence-1",
  word: "TEST",
  steps: [],
  metadata: {},
} as unknown as SequenceData;

function qrResult(label: string): QRCodeResult {
  return {
    svg: `<svg>${label}</svg>`,
    dataUrl: `data:image/svg+xml,${label}`,
    encodedUrl: `https://tka.run/TEST?bp=${label}&rp=${label}`,
    shortCode: "TEST",
  };
}

describe("choreo card QR state", () => {
  it("regenerates the QR with the current props when the viewer prop changes", async () => {
    const generateForSequence = vi
      .fn()
      .mockResolvedValueOnce(qrResult("staff"))
      .mockResolvedValueOnce(qrResult("club"));
    const harness = createChoreoCardQrStateHarness({
      sequence,
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
      generateForSequence,
    });

    try {
      flushSync();
      expect(generateForSequence).toHaveBeenCalledTimes(1);
      expect(generateForSequence).toHaveBeenLastCalledWith(
        sequence,
        expect.objectContaining({
          bluePropType: PropType.STAFF,
          redPropType: PropType.STAFF,
        })
      );

      harness.setProps(PropType.CLUB, PropType.CLUB);
      flushSync();

      expect(generateForSequence).toHaveBeenCalledTimes(2);
      expect(generateForSequence).toHaveBeenLastCalledWith(
        sequence,
        expect.objectContaining({
          bluePropType: PropType.CLUB,
          redPropType: PropType.CLUB,
        })
      );

      await Promise.resolve();
      expect(harness.qrState.dataUrl).toBe("data:image/svg+xml,club");
    } finally {
      harness.dispose();
    }
  });
});
