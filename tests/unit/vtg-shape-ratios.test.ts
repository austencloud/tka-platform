import { describe, expect, it } from "vitest";
import { GLOSSARY } from "../../packages/domain/src/data/glossary";
import { searchVTG } from "../../packages/vtg-domain/src/reference/search";

describe("VTG shape ratio canon", () => {
  it("finds the 1:0 Float ratio and the 2:1 negative-quarter ratio", () => {
    expect(searchVTG("1:0")[0]).toMatchObject({
      type: "glossary",
      name: "1:0 ratio",
    });
    expect(searchVTG("2:1")[0]).toMatchObject({
      type: "glossary",
      name: "2:1 ratio",
    });
  });

  it("keeps Float separate from the numeric -0.25 TKA value", () => {
    expect(GLOSSARY.turns.definition).toContain("-0.25 for 2:1");
    expect(GLOSSARY.turns.definition).toContain(
      "Float remains a separate shift state"
    );
    expect(GLOSSARY.turns.definition).toContain("1:0 ratio");
  });
});
