import { describe, it, expect } from "vitest";
import {
  escapeHogQL,
  pulseProdFilter,
  EXCLUDED_ADMIN_UIDS,
} from "$lib/server/analytics/hogql-shared";

describe("escapeHogQL", () => {
  it("escapes single quotes so a uid cannot break out of a literal", () => {
    expect(escapeHogQL("o'brien")).toBe("o\\'brien");
  });

  it("escapes backslashes before quotes", () => {
    expect(escapeHogQL("a\\b")).toBe("a\\\\b");
  });
});

describe("pulseProdFilter", () => {
  it("excludes every admin uid", () => {
    const sql = pulseProdFilter();
    for (const uid of EXCLUDED_ADMIN_UIDS) {
      expect(sql).toContain(uid);
    }
  });

  it("excludes localhost, LAN, and the dev host", () => {
    const sql = pulseProdFilter();
    expect(sql).toContain("localhost%");
    expect(sql).toContain("192.168.%");
    expect(sql).toContain("dev.tkaflowarts.com");
  });
});
