import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = readFileSync(
  resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml"),
  "utf8"
);

describe("Android App Links", () => {
  it("opens QR scans and deliberate app-entry routes in the installed app", () => {
    expect(manifest).toContain('android:host="tka.run"');
    expect(manifest).toContain('android:pathPrefix="/q/"');
    expect(manifest).toContain('android:pathPrefix="/sequence/"');
    expect(manifest).toContain('android:pathPrefix="/store/"');
  });

  it("verifies the short-code and application hosts independently", () => {
    const verifiedFilters = manifest.match(
      /<intent-filter android:autoVerify="true">[\s\S]*?<\/intent-filter>/g
    );

    expect(verifiedFilters).toEqual(
      expect.arrayContaining([
        expect.stringContaining('android:host="tkaflowarts.com"'),
        expect.stringContaining('android:host="tka.run"'),
      ])
    );
    expect(
      verifiedFilters?.some(
        (filter) =>
          filter.includes('android:host="tkaflowarts.com"') &&
          filter.includes('android:host="tka.run"')
      )
    ).toBe(false);
  });
});
