/**
 * Static contract test for the one-surface 3D prop picker.
 *
 * Choosing a 3D prop happens on ScenePropPicker, everywhere, reading
 * scene-prop-catalog.ts, always. Before that was true the performer inspector
 * and the Prop Studio had drifted into two different pickers over two
 * different data sources: the inspector grouped props by category and offered
 * no finish or fan-appearance controls at all, so a build reachable in the
 * studio was unreachable in the actual 3D environment.
 *
 * This test locks the shape that fixed it: every host renders the shared
 * picker, no host reaches past it into its parts, and the picker's own choices
 * come from the catalog rather than a private list.
 *
 * The Prop Studio was the second host and is now none: it mounts
 * SceneControlWorkspace, the rail every other 3D stage carries, so its props
 * are chosen inside the performer inspector like everywhere else. It stays
 * below as a NON_HOST — it must never grow its own picker back.
 *
 * If this test fails, fix the host — do not loosen the assertions.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

const PICKER_PATH =
  "src/lib/shared/3d/components/controls/ScenePropPicker.svelte";
const CATALOG_PATH = "src/lib/shared/3d/domain/scene-prop-catalog.ts";

/** Every surface where a person picks a 3D prop. Add new ones here. */
const HOSTS: Record<string, string> = {
  "performer inspector": path.join(
    "src/lib/shared/3d/components/controls/PerformerHubDetail.svelte"
  ),
};

/**
 * Surfaces that reach prop choice through the shared rail instead of hosting a
 * picker. They must stay that way: mounting a picker here would put a second
 * prop surface back on screen beside the inspector's.
 */
const NON_HOSTS: Record<string, string> = {
  "prop studio": "src/routes/test/prop-3d-studio/+page.svelte",
};

/**
 * The picker's own parts. A host importing one of these is building a second
 * prop picker, which is the exact drift this file exists to stop.
 */
const PICKER_INTERNALS = [
  "PropBuildPicker",
  "PropCompositionPreview",
  "propFinishState",
  "finishPreviewOptions",
  "fanBuildPreviewOptions",
  "fanFramePreviewOptions",
  "fanCoverPreviewOptions",
  "propBuildPreviewImage",
  "SCENE_PROP_REPRESENTATIVES",
];

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

describe("scene prop picker contract", () => {
  it("renders the shared picker on every host", () => {
    for (const [name, hostPath] of Object.entries(HOSTS)) {
      const source = read(hostPath);
      expect(source, `${name} must import ScenePropPicker`).toContain(
        "ScenePropPicker.svelte"
      );
      expect(source, `${name} must render <ScenePropPicker>`).toContain(
        "<ScenePropPicker"
      );
    }
  });

  it("keeps rail-driven surfaces from growing their own picker", () => {
    for (const [name, surfacePath] of Object.entries(NON_HOSTS)) {
      const source = read(surfacePath);
      expect(
        source.includes("<ScenePropPicker"),
        `${name} renders its own ScenePropPicker; it reaches prop choice through SceneControlWorkspace`
      ).toBe(false);
      expect(
        source,
        `${name} must mount SceneControlWorkspace to reach the shared picker`
      ).toContain("SceneControlWorkspace");
    }
  });

  it("keeps hosts out of the picker's internals", () => {
    for (const [name, hostPath] of Object.entries({
      ...HOSTS,
      ...NON_HOSTS,
    })) {
      const source = read(hostPath);
      for (const internal of PICKER_INTERNALS) {
        expect(
          source.includes(internal),
          `${name} imports ${internal}; that belongs inside ScenePropPicker`
        ).toBe(false);
      }
    }
  });

  it("has exactly one component that picks a 3D prop", () => {
    const picker = read(PICKER_PATH);
    expect(picker).toContain("SCENE_PROP_REPRESENTATIVES");
    expect(picker).toContain("scene-prop-catalog");
  });

  it("reads which props exist from the catalog, not a private list", () => {
    const picker = read(PICKER_PATH);
    const catalog = read(CATALOG_PATH);

    // Representatives and family labels are declared once, in the catalog.
    expect(catalog).toContain("export const SCENE_PROP_REPRESENTATIVES");
    expect(picker).not.toMatch(/PropType\.(MINIHOOP|BUUGENG|DOUBLESTAR)/);

    // Same for the build pictures.
    expect(catalog).toContain("/images/props/build-previews");
    expect(picker).not.toContain("/images/props/build-previews");
  });

  it("supports performer build overrides while preserving the scene-default fallback", () => {
    const picker = read(PICKER_PATH);
    expect(picker).toContain("onBuildChange?: (build: PropBuild) => void");
    expect(picker).toContain("buildOverride ?? propFinishState.build");
    for (const setter of [
      "propFinishState.set(",
      "propFinishState.setFanBuild(",
      "propFinishState.setFanFrameColor(",
      "propFinishState.setFanCover(",
    ]) {
      expect(picker, `picker must call ${setter}`).toContain(setter);
    }
  });
});
