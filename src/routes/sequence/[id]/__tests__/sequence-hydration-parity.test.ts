import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const viewerSource = readFileSync(
  resolve(process.cwd(), "src/routes/sequence/[id]/SequenceViewerPage.svelte"),
  "utf8"
);
const routeSource = readFileSync(
  resolve(process.cwd(), "src/routes/sequence/[id]/+page.svelte"),
  "utf8"
);

describe("sequence route hydration parity", () => {
  it("keeps SEO metadata in the document head without duplicating viewer chrome", () => {
    expect(routeSource).toContain("<Seo");
    expect(routeSource).toContain("title={seo.title}");
    expect(routeSource).toContain("description={seo.description}");
    expect(viewerSource).not.toContain("data-sequence-index-content");
    expect(viewerSource).not.toContain("contextContent={routeContext}");
  });
});
