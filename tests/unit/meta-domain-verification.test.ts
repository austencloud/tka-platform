import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FACEBOOK_DOMAIN_VERIFICATION = "f86okp6001wzku7pu04ryrtk62j0h7";

describe("Meta domain verification", () => {
  it("publishes the portfolio token once in the document head", () => {
    const source = readFileSync(resolve("src/app.html"), "utf8");
    const metaTags = source.match(/<meta\b[^>]*>/g) ?? [];
    const verificationTags = metaTags.filter((tag) =>
      /\bname=["']facebook-domain-verification["']/.test(tag)
    );

    expect(verificationTags).toHaveLength(1);
    expect(verificationTags[0]).toMatch(
      new RegExp(`\\bcontent=["']${FACEBOOK_DOMAIN_VERIFICATION}["']`)
    );
  });
});
