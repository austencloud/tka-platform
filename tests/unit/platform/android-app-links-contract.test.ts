import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = readFileSync(
  resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml"),
  "utf8"
);

describe("Android App Links", () => {
  it("opens QR scans and deliberate app-entry routes in the installed app", () => {
    expect(manifest).toContain('android:pathPrefix="/q/"');
    expect(manifest).toContain('android:pathPrefix="/sequence/"');
    expect(manifest).toContain('android:pathPrefix="/store/"');
  });
});
