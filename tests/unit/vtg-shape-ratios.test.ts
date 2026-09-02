import { describe, expect, it } from "vitest";
import { GLOSSARY } from "../../packages/domain/src/data/glossary";
import { searchVTG } from "../../packages/vtg-domain/src/reference/search";

describe("VTG shape ratio canon", () => {
  it("finds the 0:1 Float ratio and the 1:2 negative-quarter ratio", () => {
    expect(searchVTG("0:1")[0]).toMatchObject({
      type: "glossary",
      name: "0:1 ratio",
    });
    expect(searchVTG("1:2")[0]).toMatchObject({
      type: "glossary",
      name: "1:2 ratio",
    });
  });

  it("keeps Float separate from the numeric -0.25 TKA value", () => {
    expect(GLOSSARY.turns.definition).toContain("-0.25 for the VTG 1:2 ratio");
    expect(GLOSSARY.turns.definition).toContain(
      "Float remains a separate shift state"
    );
    expect(GLOSSARY.turns.definition).toContain("VTG 0:1 ratio");
  });
});
