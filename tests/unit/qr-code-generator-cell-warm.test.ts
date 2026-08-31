import { beforeEach, describe, expect, it, vi } from "vitest";

const getRawData = vi
  .fn()
  .mockResolvedValue(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"));
vi.mock("qr-code-styling", () => ({
  default: class QRCodeStylingMock {
    getRawData = getRawData;
  },
}));

vi.mock("$lib/shared/render/services/warm-sequence-cells", () => ({
  warmSequenceCells: vi.fn(),
}));

import { QRCodeGenerator } from "$lib/shared/qr/services/qr-code-generator";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  SIGNUP_CARD_ART_REVISION,
  SIGNUP_CARD_RELAY_CLOSING,
  SIGNUP_CARD_RELAY_STEPS,
  SIGNUP_CARD_URL,
} from "$lib/features/choreo-card/services/signup-card-canvas-renderer";

const sequence = {
  id: "sequence-1",
  word: "AB",
  steps: [{ letter: "A", motions: {} }],
} as unknown as SequenceData;

const imageCache = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
};

describe("QRCodeGenerator canonical cell readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    imageCache.get.mockResolvedValue(null);
  });

  it("verifies both themes with the printed prop pair before creating a code", async () => {
    const events: string[] = [];
    const createShortCode = vi.fn(async () => {
      events.push("shortcode");
      return { code: "ABCD", url: "https://tka.run/ABCD", isNew: true };
    });
    const warm = vi.fn(async (_sequence, options) => {
      events.push(options.isDark ? "warm-dark" : "warm-light");
      return { total: 2, ready: 2, hashes: [], failures: [] };
    });
    const generator = new QRCodeGenerator(
      { createShortCode } as never,
      imageCache as never,
      warm
    );

    await generator.generateForSequence(sequence, {
      leftPropType: PropType.POI,
      rightPropType: PropType.FAN,
    });

    expect(warm).toHaveBeenCalledTimes(2);
    expect(warm).toHaveBeenNthCalledWith(
      1,
      sequence,
      expect.objectContaining({
        isDark: true,
        leftPropType: PropType.POI,
        rightPropType: PropType.FAN,
        catDogMode: true,
        requireComplete: true,
      })
    );
    expect(warm).toHaveBeenNthCalledWith(
      2,
      sequence,
      expect.objectContaining({ isDark: false, requireComplete: true })
    );
    expect(createShortCode).toHaveBeenCalledWith(
      sequence,
      expect.objectContaining({
        leftPropType: PropType.POI,
        rightPropType: PropType.FAN,
        catDogMode: true,
      })
    );
    expect(events).toEqual(["warm-dark", "warm-light", "shortcode"]);
  });

  it("does not create or render a QR when canonical assets are incomplete", async () => {
    const createShortCode = vi.fn();
    const warm = vi.fn().mockRejectedValue(new Error("assets incomplete"));
    const generator = new QRCodeGenerator(
      { createShortCode } as never,
      imageCache as never,
      warm
    );

    await expect(generator.generateForSequence(sequence)).rejects.toThrow(
      "assets incomplete"
    );
    expect(createShortCode).not.toHaveBeenCalled();
    expect(getRawData).not.toHaveBeenCalled();
  });

  it("finishes one theme before starting the next and stops after cancellation", async () => {
    let finishDark!: () => void;
    const darkWarm = new Promise<void>((resolve) => {
      finishDark = resolve;
    });
    const warm = vi.fn(async (_sequence, options) => {
      if (options.isDark) await darkWarm;
      return { total: 2, ready: 2, hashes: [], failures: [] };
    });
    const createShortCode = vi.fn();
    const generator = new QRCodeGenerator(
      { createShortCode } as never,
      imageCache as never,
      warm
    );
    const controller = new AbortController();
    const generating = generator.generateForSequence(sequence, {
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(warm).toHaveBeenCalledOnce());
    controller.abort();
    finishDark();

    await expect(generating).rejects.toMatchObject({ name: "AbortError" });
    expect(warm).toHaveBeenCalledOnce();
    expect(createShortCode).not.toHaveBeenCalled();
  });
});

describe("festival signup card relay", () => {
  it("prints the complete learn, teach, pass cycle", () => {
    expect(SIGNUP_CARD_RELAY_STEPS).toEqual([
      {
        label: "SCAN + LEARN",
        body: "Scan the QR on a choreo card. Learn its sequence.",
      },
      {
        label: "TEACH",
        body: "Teach the sequence to another person.",
      },
      {
        label: "PASS IT ON",
        body: "Give them the card. They start again at step one.",
      },
    ]);
    expect(SIGNUP_CARD_RELAY_CLOSING).toBe(
      "Keep the loop going until the world speaks this language."
    );
  });

  it("keeps the live signup destination on the card", () => {
    expect(SIGNUP_CARD_URL).toBe("https://tkaflowarts.com/start");
    expect(SIGNUP_CARD_ART_REVISION).toBe("2026-08-14-relay-v1");
  });
});
