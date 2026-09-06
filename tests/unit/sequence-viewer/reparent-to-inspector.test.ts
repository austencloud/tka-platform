import { describe, expect, it, vi } from "vitest";
import { reparentToInspector } from "$lib/shared/sequence-viewer/components/reparent-to-inspector";

describe("reparentToInspector", () => {
  const element = (tag: string) =>
    document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      tag
    ) as HTMLElement;
  it("uses pre-layout visual bounds when sibling chrome leaves the host", () => {
    const origin = element("div"),
      target = element("div"),
      surface = element("section"),
      visual = element("div");
    visual.className = "visual";
    surface.append(visual);
    origin.append(surface);
    document.body.append(origin, target);
    let visualHeight = 740;
    const rect = (height: number) => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: height,
      width: 400,
      height,
      toJSON: () => ({}),
    });
    surface.getBoundingClientRect = () => rect(800);
    visual.getBoundingClientRect = () =>
      rect(surface.parentNode === origin ? visualHeight : 300);
    visual.getAnimations = () => [];
    visual.animate = vi.fn(
      () =>
        ({
          finished: new Promise(() => {}),
          cancel: vi.fn(),
        }) as unknown as Animation
    );
    const action = reparentToInspector(surface, {
      target: null,
      animate: true,
      visualSelector: ".visual",
    });
    action.capture();
    visualHeight = 800;
    action.update({ target, animate: true, visualSelector: ".visual" });
    expect(visual.animate).toHaveBeenCalledWith(
      [
        {
          transformOrigin: "top left",
          transform: `translate(0px, 0px) scale(1, ${740 / 300})`,
        },
        { transformOrigin: "top left", transform: "none" },
      ],
      expect.any(Object)
    );
    action.destroy();
    origin.remove();
    target.remove();
  });
  it("keeps the newest destination when an in-flight handoff reverses", async () => {
    const origin = element("div");
    const target = element("div");
    const surface = element("section");
    surface.style.color = "red";
    origin.append(surface);
    document.body.append(origin, target);
    const pending: { finish: () => void; animation: Animation }[] = [];
    surface.getAnimations = () => pending.map((entry) => entry.animation);
    surface.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: surface.parentNode === origin ? 0 : 400,
      top: 0,
      right: 600,
      bottom: 300,
      width: 200,
      height: 300,
      toJSON: () => ({}),
    });
    surface.animate = vi.fn(() => {
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const animation = {
        finished,
        cancel: vi.fn(finish),
      } as unknown as Animation;
      pending.push({ finish, animation });
      return animation;
    });
    const moving = vi.fn();
    const action = reparentToInspector(surface, {
      target,
      animate: true,
      onMoving: moving,
    });
    expect(surface.parentNode).toBe(document.body);
    action.update({ target: null, animate: true, onMoving: moving });
    pending[0].finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(surface.parentNode).not.toBe(target);
    pending.at(-1)!.finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(surface.parentNode).toBe(origin);
    expect(surface.getAttribute("style")).toBe("color: red;");
    expect(moving).toHaveBeenLastCalledWith(false);
    action.destroy();
    origin.remove();
    target.remove();
  });

  it("moves instantly under reduced motion, without leaving an overlay", () => {
    document.documentElement.dataset.motionPreference = "reduce";
    const origin = element("div");
    const target = element("div");
    const surface = element("section");
    origin.append(surface);
    document.body.append(origin, target);
    surface.animate = vi.fn();
    const action = reparentToInspector(surface, { target, animate: true });
    expect(surface.parentNode).toBe(target);
    expect(surface.animate).not.toHaveBeenCalled();
    action.destroy();
    expect(surface.parentNode).toBe(origin);
    origin.remove();
    target.remove();
    delete document.documentElement.dataset.motionPreference;
  });

  it("does not resurrect a surface already removed by its owning block", () => {
    const origin = element("div"),
      target = element("div"),
      surface = element("section");
    origin.append(surface);
    const action = reparentToInspector(surface, target);
    surface.remove();
    action.destroy();
    expect(origin.children.length).toBe(0);
    expect(surface.parentNode).toBeNull();
  });

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
