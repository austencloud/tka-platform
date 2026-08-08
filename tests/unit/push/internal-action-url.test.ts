import { describe, expect, it } from "vitest";
import { safeInternalActionUrl } from "../../../firebase-functions/src/push/internalActionUrl";

describe("safeInternalActionUrl", () => {
  it.each([
    [
      "/admin/parity-audit?notification=123",
      "/admin/parity-audit?notification=123",
    ],
    ["/app?tab=notifications", "/app?tab=notifications"],
    ["https://example.com", null],
    ["//example.com", null],
    ["javascript:alert(1)", null],
    [null, null],
  ])("maps %j to %j", (value, expected) => {
    expect(safeInternalActionUrl(value)).toBe(expected);
  });
});
