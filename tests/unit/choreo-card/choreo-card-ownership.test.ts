import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("ChoreoCard ownership boundaries", () => {
  const facadePath =
    "src/lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  const facade = source(facadePath);
  const cardHeader = source(
    "src/lib/shared/sequence-viewer/components/CardHeader.svelte"
  );
  const cardFooter = source(
    "src/lib/shared/sequence-viewer/components/CardFooter.svelte"
  );

  it("keeps the public component as a facade over named behavior owners", () => {
    expect(facade).toContain("createChoreoCardDisplayState");
    expect(facade).toContain("createChoreoCardQrState");
    expect(facade).toContain("createChoreoCardSizingState");
    expect(facade).toContain("createChoreoCardRenderEngine");
    expect(facade).toContain("createChoreoCardRenderLifecycle");
  });

  it("does not pull async rendering and DOM measurement back into the facade", () => {
    expect(facade).not.toContain("async function renderAllCells");
    expect(facade).not.toContain("new ResizeObserver");
    expect(facade).not.toContain("generateForSequence(");
  });

  it("removes the obsolete parallel QR and mandala owner", () => {
    expect(
      existsSync(
        resolve(
          process.cwd(),
          "src/lib/shared/sequence-viewer/components/QRMandalaOverlay.svelte"
        )
      )
    ).toBe(false);
  });

  it("keeps non-letter artifact titles in the canonical card header", () => {
    expect(facade).toContain("customTitleText?: string");
    expect(facade).toContain("frameColors?:");
    expect(facade).toContain("class:has-frame={!!frameColors}");
    expect(facade).toContain("{customTitleText}");
    expect(cardHeader).toContain("{customTitleText}");
    expect(cardHeader).toContain("text-title");
    expect(cardFooter).toContain("var(--font-size-compact, 12px)");
  });
});
