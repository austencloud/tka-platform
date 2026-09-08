import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/shared/3d/components/performer-interaction/PerformerMoveHandle.svelte"
  ),
  "utf8"
);

describe("worker move-handle source parity contract", () => {
  it("keeps world placement, labels, and interaction semantics tied to production", () => {
    expect(source).toContain(
      "<T.Group position={[position.x, groundY + 0.08, position.z]}>"
    );
    expect(source).toContain("<HTML center sprite>");
    expect(source).toContain(
      'selectedCount === 1 ? "Move character" : `Move ${selectedCount}`'
    );
    expect(source).toContain('type="button"');
    expect(source).toContain('class="fas fa-arrows-up-down-left-right"');
    expect(source).toContain("onlostpointercapture={onpointercancel}");
    expect(source).toContain(
      "oncontextmenu={(event) => event.preventDefault()}"
    );
    expect(source).toContain("ondragstart={(event) => event.preventDefault()}");
  });

  it("keeps geometry, materials, focus, and dragging states tied to production", () => {
    for (const declaration of [
      "min-width: 48px;",
      "min-height: 48px;",
      "padding: 0 0.875rem;",
      "border: 1px solid var(--theme-accent, #8b5cf6);",
      "border-radius: 999px;",
      "gap: 0.5rem;",
      "background: var(--theme-panel-bg, rgba(0, 0, 0, 0.82));",
      "color: var(--theme-text, #fff);",
      "0 0 0 1px rgba(0, 0, 0, 0.5)",
      "0 0.4rem 1.1rem rgba(0, 0, 0, 0.42)",
      "font-size: max(14px, var(--font-size-min, 0.875rem));",
      "font-weight: 700;",
      "cursor: grab;",
      "touch-action: none;",
      "user-select: none;",
      "border-color: var(--theme-accent-text, #a78bfa);",
      "background: var(--theme-card-hover-bg, rgba(24, 20, 40, 0.94));",
      "outline: 2px solid var(--theme-accent-text, #a78bfa);",
      "outline-offset: 3px;",
      "cursor: grabbing;",
      "width: 1rem;",
    ]) {
      expect(source, declaration).toContain(declaration);
    }
  });

  it("keeps popIn and reduced-motion behavior tied to production", () => {
    expect(source).toContain("transition:popIn");
    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
    expect(source).toContain("transition: none;");
  });
});
