import { describe, expect, it } from "vitest";
import { load as redirectLegacyGlossary } from "../../src/routes/(public)/glossary/+page";

describe("Kinetic Atlas route contract", () => {
  it("permanently redirects old glossary links without losing explorer state", () => {
    const url = new URL(
      "https://tkaflowarts.com/glossary?board=atlas&letter=B&grid=box&variation=3#cat-letter"
    );

    expect(() => redirectLegacyGlossary({ url } as never)).toThrowError(
      expect.objectContaining({
        status: 308,
        location: "/atlas?board=atlas&letter=B&grid=box&variation=3#cat-letter",
      })
    );
  });
});
