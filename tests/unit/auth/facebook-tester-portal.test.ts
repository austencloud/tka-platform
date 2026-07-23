import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Facebook tester portal", () => {
  const portal = readSource("src/routes/test/facebook-login/+page.svelte");
  const providerConfig = readSource(
    "src/lib/shared/auth/services/auth-providers.config.ts"
  );

  it("offers the real Facebook flow only from the invited-tester route", () => {
    expect(portal).toContain("Test Facebook login");
    expect(portal).toContain('run("signInWithFacebook", signInWithFacebook)');
    expect(providerConfig).toMatch(
      /export const FACEBOOK_LOGIN_ENABLED\s*=\s*false/
    );
  });

  it("presents a branded invitation before the engineering controls", () => {
    const invitation = portal.indexOf(
      "Would you be interested in testing Facebook login?"
    );
    const diagnostics = portal.indexOf('<details class="tester-details">');

    expect(invitation).toBeGreaterThan(-1);
    expect(diagnostics).toBeGreaterThan(invitation);
    expect(portal).toContain("/branding/logo.jpg");
    expect(portal).toContain("Tester tools and technical details");
  });

  it("keeps the non-public tester route out of search indexes", () => {
    expect(portal).toContain(
      '<meta name="robots" content="noindex, nofollow" />'
    );
  });
});
