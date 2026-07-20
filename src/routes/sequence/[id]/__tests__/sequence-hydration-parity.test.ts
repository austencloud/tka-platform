import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const viewerSource = readFileSync(
  resolve(process.cwd(), "src/routes/sequence/[id]/SequenceViewerPage.svelte"),
  "utf8"
);

describe("sequence route hydration parity", () => {
  it("keeps the sequence identity and description in the hydrated viewer", () => {
    expect(viewerSource).toContain("data-sequence-index-content");
    expect(viewerSource).toMatch(/<h1[^>]*>\{seo\.heading\}<\/h1>/);
    expect(viewerSource).toContain("<p>{seo.description}</p>");
    expect(viewerSource).toContain("Flow Arts Composer");
  });
});
