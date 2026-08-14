import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("Android splash resource routing", () => {
  it("uses the responsive launch drawable for cold and warm covers", () => {
    expect(read("android/app/src/main/res/values/styles.xml")).toContain(
      '<item name="android:background">@drawable/launch_splash</item>'
    );
    expect(read("android/app/src/main/res/layout/launch_screen.xml")).toContain(
      'android:background="@drawable/launch_splash"'
    );
    expect(read("capacitor.config.ts")).toMatch(
      /layoutName:\s*["']launch_screen["']/
    );
  });

  it.each([
    "drawable/launch_splash.xml",
    "drawable-land/launch_splash.xml",
    "drawable-sw600dp/launch_splash.xml",
    "drawable-sw600dp-land/launch_splash.xml",
  ])("keeps %s on the shared background and wordmark", (resource) => {
    const xml = read(`android/app/src/main/res/${resource}`);
    expect(xml).toContain("@drawable/launch_splash_base");
    expect(xml).toContain("@drawable/splash_wordmark");
    expect(xml).toContain("@drawable/splash_signature");
  });
});
