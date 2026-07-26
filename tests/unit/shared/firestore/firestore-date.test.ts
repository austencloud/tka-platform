import { describe, expect, it } from "vitest";
import { firestoreDate, firestoreDateLenient } from "../../../../src/lib/shared/firestore/firestore-date";
import { LibrarySequenceDocSchema } from "../../../../src/lib/shared/library/domain/library-schemas";

describe("firestoreDate", () => {
  it("converts a Timestamp-like { toDate() } to a Date", () => {
    const d = new Date("2026-07-01T00:00:00Z");
    expect(firestoreDate.parse({ toDate: () => d })).toEqual(d);
  });

  it("coerces ISO strings", () => {
    expect(firestoreDate.parse("2026-07-01T00:00:00Z")).toBeInstanceOf(Date);
  });

  it("lenient variant treats an unresolved serverTimestamp sentinel as absent", () => {
    expect(firestoreDateLenient.parse({ _methodName: "serverTimestamp" })).toBeUndefined();
    expect(firestoreDateLenient.parse(undefined)).toBeUndefined();
    expect(firestoreDateLenient.parse("2026-07-01T00:00:00Z")).toBeInstanceOf(Date);
  });

  it("still rejects the sentinel where a date is required", () => {
    expect(() => firestoreDate.parse({ _methodName: "serverTimestamp" })).toThrow();
  });
});

describe("LibrarySequenceDocSchema with corrupted timestamps", () => {
  it("parses a doc whose createdAt/updatedAt are unresolved sentinels (the b231098b class)", () => {
    const result = LibrarySequenceDocSchema.safeParse({
      id: "b231098b-9053-4f5e-91ff-a7cf475e4836",
      name: "AΘ-SX-AΘ-SX-",
      word: "AΘ-SX-AΘ-SX-",
      ownerId: "PBp3GSBO6igCKPwJyLZNmVEmamI3",
      createdAt: { _methodName: "serverTimestamp" },
      updatedAt: { _methodName: "serverTimestamp" },
      thumbnails: [],
      visibility: "private",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBeUndefined();
      expect(result.data.updatedAt).toBeUndefined();
    }
  });
});
