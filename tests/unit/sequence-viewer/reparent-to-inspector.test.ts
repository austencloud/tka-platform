import { describe, expect, it } from "vitest";
import { reparentToInspector } from "$lib/shared/sequence-viewer/components/reparent-to-inspector";

describe("reparentToInspector", () => {
  it("moves one mounted node into the inspector and restores its exact slot", () => {
    const html = (tagName: string): HTMLElement =>
      document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        tagName
      ) as HTMLElement;
    const origin = html("div");
    const before = html("span");
    const settings = html("section");
    const after = html("span");
    const inspector = html("aside");
    origin.appendChild(before);
    origin.appendChild(settings);
    origin.appendChild(after);

    const action = reparentToInspector(settings, inspector);
    expect(inspector.firstElementChild).toBe(settings);

    action.update(null);
    expect(Array.from(origin.children)).toEqual([before, settings, after]);

    action.update(inspector);
    action.destroy();
    expect(Array.from(origin.children)).toEqual([before, settings, after]);
  });
});
