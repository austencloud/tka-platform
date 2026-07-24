import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WINDOWS_GRADLE_WRAPPER = resolve("android/gradlew.bat");

describe("Android Unicode asset packaging", () => {
  it("switches Windows to UTF-8 before Gradle launches AAPT2", () => {
    const wrapper = readFileSync(WINDOWS_GRADLE_WRAPPER, "utf8");
    const utf8CodePage = wrapper.indexOf("@chcp 65001 >nul");
    const failedCodePageGuard = wrapper.indexOf("@if errorlevel 1");
    const gradleLaunch = wrapper.indexOf(' -jar "');

    expect(utf8CodePage).toBeGreaterThanOrEqual(0);
    expect(failedCodePageGuard).toBeGreaterThan(utf8CodePage);
    expect(gradleLaunch).toBeGreaterThan(utf8CodePage);
  });

  it("keeps canonical Greek names in source assets", () => {
    const representativeAssets = [
      "static/images/letters_trimmed/Type2/Σ.svg",
      "static/images/letters_trimmed/Type3/Δ-.svg",
      "static/images/letters_trimmed/Type4/Φ.svg",
      "static/images/letters_trimmed/Type5/Ψ-.svg",
      "static/images/letters_trimmed/Type6/γ.svg",
      "static/images/letters_trimmed/Type6/⊕.svg",
    ];

    for (const asset of representativeAssets) {
      expect(existsSync(resolve(asset)), asset).toBe(true);
    }
  });
});
