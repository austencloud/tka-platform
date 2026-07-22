import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Capacitor environment contract", () => {
  it("embeds PostHog settings without requesting /_app/env.js", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/shared/analytics/services/posthog.ts"),
      "utf8"
    );

    expect(source).toContain('from "$env/static/public"');
    expect(source).not.toContain("$env/dynamic/public");
    expect(source).not.toContain('import("$env/');
  });

  it("keeps dynamic public environment imports out of client code", () => {
    const clientFiles = [
      "src/lib/features/admin/components/ActiveUsersPanel.svelte",
      "src/lib/features/choreo-card/components/scan-activity/ScanActivityTab.svelte",
      "src/lib/features/community/Community.svelte",
      "src/lib/features/community/get-geocoding-service.ts",
      "src/lib/features/festivals/components/map/FestivalMap.svelte",
    ];

    for (const file of clientFiles) {
      expect(readFileSync(resolve(file), "utf8")).not.toContain(
        "$env/dynamic/public"
      );
    }
  });
});
