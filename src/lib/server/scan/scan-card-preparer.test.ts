import { describe, expect, it } from "vitest";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { ShortCodeData } from "$lib/shared/qr/services/types";
import { prepareScanPayload } from "./scan-card-preparer";

const ENCODED_B2ZM =
  "s~r1:sm:f2938653:q1:HYPQN1Z0M/2Q 5Q:66VH93T9PYLH504WU/L92IGQSUG54HJCJQILD2JEQS+MO:9YE1U33FNO5*Q$ZMWDNXZ9PI5B32+80QLL8PR";
const WORD = "Λ-γYΘγΛ-γYΘγ";

function record(overrides: Partial<ShortCodeData> = {}): ShortCodeData {
  return {
    sequence: WORD,
    payloadWord: WORD,
    encoded: ENCODED_B2ZM,
    createdAt: "2026-07-30T00:00:00.000Z",
    createdBy: "test",
    scanCount: 0,
    bluePropType: PropType.STAFF,
    redPropType: PropType.STAFF,
    ...overrides,
  };
}

describe("prepareScanPayload", () => {
  it("turns a self-contained record into a hydrated sequence and canonical cell URLs", async () => {
    const prepared = await prepareScanPayload("B2ZM", record());

    expect(prepared).not.toBeNull();
    expect(prepared?.sequence.id).toBe("B2ZM");
    expect(prepared?.sequence.steps).toHaveLength(10);
    expect(prepared?.sequence.startPosition).toBeTruthy();
    expect(prepared?.card.word).toBe(WORD);
    expect(prepared?.card.cells).toHaveLength(11);
    expect(prepared?.card.cells[0]).toMatchObject({
      index: -1,
      label: "Start",
    });
    expect(
      prepared?.card.cells.every((cell) =>
        cell.imageUrl.startsWith(
          "https://firebasestorage.googleapis.com/v0/b/the-kinetic-alphabet.firebasestorage.app/o/pictograph-cells%2F"
        )
      )
    ).toBe(true);
    expect(prepared?.propConfig).toEqual({
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
      catDogMode: false,
    });
  });

  it("lets URL prop intent override the record before deriving cell hashes", async () => {
    const prepared = await prepareScanPayload("B2ZM", record(), {
      bluePropType: PropType.POI,
      redPropType: PropType.FAN,
      catDogMode: true,
    });

    expect(prepared?.propConfig).toEqual({
      bluePropType: PropType.POI,
      redPropType: PropType.FAN,
      catDogMode: true,
    });
  });

  it("returns null when a legacy record has no self-contained payload", async () => {
    await expect(
      prepareScanPayload("OLD1", record({ encoded: undefined }))
    ).resolves.toBeNull();
  });
});
