import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("canonical layout motion", () => {
  it("routes structural changes through one documented owner map", () => {
    const agents = read("AGENTS.md");
    const rule = read(".claude/rules/no-layout-shift.md");
    const capabilities = read(".claude/rules/canonical-capabilities.md");

    expect(agents).toContain("## Motion Communicates Change");
    expect(agents).toContain("createLayoutMotion()");
    expect(rule).toMatch(
      /An intentional layout change that instantly pops to its new location is a UI\s+defect\./
    );
    expect(rule).toContain("## Canonical Motion Routing");
    expect(rule).toContain("prefers-reduced-motion: reduce");
    expect(capabilities).toContain(
      "layout motion, reflow, panel expand, collapse, insert, remove, reorder"
    );
  });

  it("keeps shared helpers reduced-motion aware and generically named", () => {
    const motion = read("src/lib/shared/transitions/motion.ts");
    const layout = read("src/lib/shared/transitions/layout-flip.ts");

    expect(motion).toContain("export function flexPresence");
    expect(motion).toContain("duration: motionDuration(duration)");
    expect(layout).toContain("export function createLayoutMotion");
    expect(layout).toContain("export const LAYOUT_MOTION_DURATION_MS");
    expect(layout).toContain(
      "export const createLayoutFlip = createLayoutMotion"
    );
  });

  it("makes structural panel motion the PanelGroup default", () => {
    const panels = read("src/lib/shared/panels/PanelGroup.svelte");

    expect(panels).toContain("transition:flexPresence");
    expect(panels).toContain("transition:growFade");
    expect(panels).toContain("flex-grow var(--transition-emphasis)");
    expect(panels).toContain(".panel-group.dragging .panel-wrapper");
    expect(panels).toContain("transition: none");
  });

  it("keeps one Stage timeline mounted across dock and editor modes", () => {
    const stage = read("src/lib/features/stage/StageModule.svelte");
    const timeline = read(
      "src/lib/features/stage/components/StageTimeline.svelte"
    );

    expect(stage).toContain("content: timelinePanel");
    expect(stage).toContain(
      'mode={timelineDisclosure === "editor" ? "editor" : "dock"}'
    );
    expect(stage).not.toContain("timelineDockPanel");
    expect(stage).not.toContain("timelineEditorPanel");
    expect(timeline).toContain("transition:flyFade");
    expect(timeline).toContain("<Crossfade key={mode}");
  });
});
