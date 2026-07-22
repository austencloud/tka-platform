import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Capacitor service-worker contract", () => {
  it("does not register the web app service worker in a native shell", () => {
    const source = readFileSync(resolve("src/hooks.client.ts"), "utf8");

    expect(source).toContain("!Capacitor.isNativePlatform()");
    expect(source).toMatch(
      /!Capacitor\.isNativePlatform\(\)[\s\S]*navigator\.serviceWorker[\s\S]*\.register\("\/sw\.js"/
    );
  });

  it("clears localhost worker caches before the app modules boot", () => {
    const source = readFileSync(resolve("src/app.html"), "utf8");

    expect(source).toContain("caches.delete(key)");
    expect(source).toContain("tka-local-sw-cleared");
  });
});
