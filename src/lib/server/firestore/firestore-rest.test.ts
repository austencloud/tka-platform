import { describe, expect, it } from "vitest";
import {
  hashPrivateValue,
  readFirestoreBoolean,
  readFirestoreInteger,
  readFirestoreString,
  toFirestoreFields,
  type FirestoreDocument,
} from "./firestore-rest";

describe("Firestore REST value mapping", () => {
  it("maps nested application data into Firestore REST envelopes", () => {
    expect(
      toFirestoreFields({
        name: "Deck 7",
        count: 3,
        ratio: 1.5,
        active: true,
        absent: null,
        createdAt: new Date("2026-07-27T12:00:00.000Z"),
        tags: ["print", "serialized"],
        provenance: { eventId: null, era: "serialized-v1" },
        skipped: undefined,
      })
    ).toEqual({
      name: { stringValue: "Deck 7" },
      count: { integerValue: "3" },
      ratio: { doubleValue: 1.5 },
      active: { booleanValue: true },
      absent: { nullValue: null },
      createdAt: { timestampValue: "2026-07-27T12:00:00.000Z" },
      tags: {
        arrayValue: {
          values: [{ stringValue: "print" }, { stringValue: "serialized" }],
        },
      },
      provenance: {
        mapValue: {
          fields: {
            eventId: { nullValue: null },
            era: { stringValue: "serialized-v1" },
          },
        },
      },
    });
  });

  it("reads typed scalar fields without coercing the wrong envelope", () => {
    const document: FirestoreDocument = {
      name: "projects/test/databases/(default)/documents/example/one",
      fields: {
        label: { stringValue: "ABCD" },
        count: { integerValue: "12" },
        enabled: { booleanValue: true },
      },
    };

    expect(readFirestoreString(document, "label")).toBe("ABCD");
    expect(readFirestoreString(document, "count")).toBeNull();
    expect(readFirestoreInteger(document, "count")).toBe(12);
    expect(readFirestoreInteger(document, "label")).toBeNull();
    expect(readFirestoreBoolean(document, "enabled")).toBe(true);
    expect(readFirestoreBoolean(document, "label")).toBeNull();
  });

  it("hashes private identifiers deterministically without retaining the input", async () => {
    const first = await hashPrivateValue("device-1");
    const second = await hashPrivateValue("device-1");

    expect(first).toBe(second);
    expect(first).not.toContain("device-1");
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
