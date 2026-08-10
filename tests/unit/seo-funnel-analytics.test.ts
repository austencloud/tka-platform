import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf-8");

describe("SEO acquisition funnel analytics", () => {
  it("captures SvelteKit history navigation after analytics initialization", () => {
    const posthog = read("src/lib/shared/analytics/services/posthog.ts");
    const layout = read("src/routes/+layout.svelte");

    expect(posthog).toContain(
      'capture_pageview: captureEnabled ? "history_change" : false'
    );
    expect(layout).toContain("const { initPostHog } = await imports.posthog;");
    expect(layout).toContain("await initPostHog();");
  });

  it("tracks every Composer launch CTA with its placement and destination", () => {
    const composer = read("src/routes/(public)/composer/+page.svelte");
    const locations = Array.from(
      composer.matchAll(/trackOpenComposer\("([^"]+)"\)/g),
      (match) => match[1]
    );

    expect(locations).toEqual(["hero", "viewer_3d", "footer"]);
    expect(composer).toContain('destination: "/create"');
  });

  it("counts completed exports and shares without counting canceled share sheets", () => {
    const imageExporter = read(
      "src/lib/shared/sequence-viewer/services/sequence-modal-exporter.svelte.ts"
    );
    const videoExporter = read(
      "src/lib/shared/sequence-viewer/components/export-coordinator.svelte.ts"
    );
    const viewerShareActions = read(
      "src/lib/shared/sequence-viewer/services/viewer-share-actions.ts"
    );

    expect(imageExporter).toContain("if (!shareCanceled)");
    expect(imageExporter).toContain('exportFormat: "png"');
    expect(videoExporter).toContain(
      "result.success && !result.canceled && !measuredVideoUrls.has(url)"
    );
    expect(videoExporter).toContain('exportFormat: "mp4"');
    expect(viewerShareActions).toContain('logShareAction("sequence_share"');
    expect(viewerShareActions).toContain('logShareAction("link_copy"');
  });
});
