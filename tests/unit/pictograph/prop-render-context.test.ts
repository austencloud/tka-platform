import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { HandSide } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  applyEditorTorchPalette,
  EDITOR_TORCH_FLAME_OUTLINE,
  EDITOR_TORCH_PALETTE,
  needsEditorContrast,
} from "$lib/shared/pictograph/prop/domain/prop-render-context";
import { contrastRatio } from "$lib/shared/settings/utils/background-theme-calculator";
import { applyMotionColorToSvg } from "$lib/shared/utils/svg-color-utils";
import { getPropDimensions } from "$lib/shared/animation-engine/services/IPropTextureLoader";
import { generatePropSvg } from "$lib/shared/animation-engine/services/svg-generator";

describe("editor prop contrast contract", () => {
  it.each([PropType.TORCH, PropType.BIGTORCH])(
    "targets only editor-rendered %s props",
    (propType) => {
      expect(needsEditorContrast("editor", propType)).toBe(true);
      expect(needsEditorContrast("standard", propType)).toBe(false);
    }
  );

  it("does not target unrelated props", () => {
    expect(needsEditorContrast("editor", PropType.STAFF)).toBe(false);
    expect(needsEditorContrast("editor", undefined)).toBe(false);
  });

  it.each(["dark", "light"] as const)(
    "keeps the %s shaft and metal above WCAG 2.2's 3:1 target",
    (mode) => {
      const colors = EDITOR_TORCH_PALETTE[mode];
      expect(
        contrastRatio(colors.shaft, colors.background)
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(colors.metal, colors.background)
      ).toBeGreaterThanOrEqual(3);
    }
  );

  it("keeps the original flame colors discernible across real grid points", () => {
    expect(
      contrastRatio(
        EDITOR_TORCH_PALETTE.dark.flame,
        EDITOR_TORCH_PALETTE.dark.background
      )
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(EDITOR_TORCH_FLAME_OUTLINE, "#d0d0d0")
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(EDITOR_TORCH_PALETTE.light.flame, "#000000")
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(
        EDITOR_TORCH_FLAME_OUTLINE,
        EDITOR_TORCH_PALETTE.light.background
      )
    ).toBeGreaterThanOrEqual(3);
  });

  it("replaces the wick with the flame in both editor themes", () => {
    expect(EDITOR_TORCH_PALETTE.dark.wick).toBe("none");
    expect(EDITOR_TORCH_PALETTE.light.wick).toBe("none");
  });

  it("removes editor markers without changing standard artwork", () => {
    const original = '<path data-torch-shaft="true" style="fill:#231F20;" />';

    expect(
      applyEditorTorchPalette(original, "standard", PropType.TORCH, true)
    ).toBe('<path style="fill:#231F20;" />');
  });

  it("keeps the small-torch handle overlay invisible outside editor rendering", () => {
    const original = readFileSync(
      resolve(
        process.cwd(),
        "static",
        "images",
        "props",
        "pictograph",
        "torch.svg"
      ),
      "utf8"
    );
    const standard = applyEditorTorchPalette(
      original,
      "standard",
      PropType.TORCH,
      true
    );

    expect(standard).toContain('style="fill:none;stroke:none;"');
    expect(standard).not.toContain("data-torch-shaft");
  });

  it.each([
    [PropType.TORCH, "torch.svg", HandSide.LEFT, 1],
    [PropType.TORCH, "torch.svg", HandSide.RIGHT, 1],
    [PropType.BIGTORCH, "bigtorch.svg", HandSide.LEFT, 3],
    [PropType.BIGTORCH, "bigtorch.svg", HandSide.RIGHT, 3],
  ])(
    "marks and recolors the real %s (%s) geometry for the %s hand",
    (propType, filename, color, shaftPartCount) => {
      const original = readFileSync(
        resolve(
          process.cwd(),
          "static",
          "images",
          "props",
          "pictograph",
          filename
        ),
        "utf8"
      );

      expect(original.match(/data-torch-shaft="true"/g)).toHaveLength(
        shaftPartCount
      );
      expect(original.match(/data-torch-metal="true"/g)).toHaveLength(1);
      expect(original.match(/data-torch-wick="true"/g)).toHaveLength(1);

      const handColored = applyMotionColorToSvg(original, color, {
        makeClassNamesUnique: true,
        selectiveColorMode: true,
        themeMode: "dark",
      });
      const edited = applyEditorTorchPalette(
        handColored,
        "editor",
        propType,
        true
      );

      expect(
        edited.match(new RegExp(`fill:${EDITOR_TORCH_PALETTE.dark.shaft}`, "g"))
      ).toHaveLength(shaftPartCount);
      expect(
        edited.match(new RegExp(`fill:${EDITOR_TORCH_PALETTE.dark.metal}`, "g"))
      ).toHaveLength(1);
      const wickTag = edited.match(
        /<[^>]+\sdata-torch-wick=(?:"[^"]*"|'[^']*')[^>]*>/i
      )?.[0];
      expect(wickTag).toContain(`fill:${EDITOR_TORCH_PALETTE.dark.wick}`);
      expect(edited.match(/data-torch-flame="true"/g)).toHaveLength(1);
      expect(edited.match(/data-torch-flame-part=/g)).toHaveLength(2);
      expect(edited).toContain(`fill="${EDITOR_TORCH_PALETTE.dark.flame}"`);
      expect(edited).toContain(
        `data-torch-flame-size="${propType === PropType.BIGTORCH ? "big" : "standard"}"`
      );

      const standard = applyEditorTorchPalette(
        handColored,
        "standard",
        propType,
        true
      );
      expect(standard).not.toContain("data-torch-shaft");
      expect(standard).not.toContain("data-torch-metal");
      expect(standard).not.toContain("data-torch-wick");
      expect(standard).not.toContain("data-torch-flame");
      expect(standard).not.toContain(EDITOR_TORCH_PALETTE.dark.shaft);
      expect(standard).toContain("#F6E5B6");
    }
  );

  it.each([
    [PropType.TORCH, "torch.svg"],
    [PropType.BIGTORCH, "bigtorch.svg"],
  ])(
    "hides the %s wick in editor rendering but preserves it in standard rendering",
    (propType, filename) => {
      const original = readFileSync(
        resolve(
          process.cwd(),
          "static",
          "images",
          "props",
          "pictograph",
          filename
        ),
        "utf8"
      );
      const handColored = applyMotionColorToSvg(original, HandSide.LEFT, {
        makeClassNamesUnique: true,
        selectiveColorMode: true,
        themeMode: "light",
      });
      const edited = applyEditorTorchPalette(
        handColored,
        "editor",
        propType,
        false
      );

      expect(edited).toContain("fill:none");
      expect(
        applyEditorTorchPalette(handColored, "standard", propType, false)
      ).toContain("#F6E5B6");
    }
  );

  it.each([
    [
      PropType.TORCH,
      "torch.svg",
      -30,
      -10.1,
      360,
      35.7,
      284.4,
      7.75,
      0.36,
      150,
      7.75,
    ],
    [
      PropType.BIGTORCH,
      "bigtorch.svg",
      -38.5,
      -12.35,
      402,
      57.3,
      290.4,
      16.3,
      0.53,
      162.5,
      16.3,
    ],
  ])(
    "replaces the %s wick with an unclipped two-tone flame in animation assets",
    (
      propType,
      filename,
      minX,
      minY,
      width,
      height,
      baseX,
      centerY,
      scale,
      pivotX,
      pivotY
    ) => {
      const original = readFileSync(
        resolve(
          process.cwd(),
          "static",
          "images",
          "props",
          "animated",
          filename
        ),
        "utf8"
      );
      const handColored = applyMotionColorToSvg(original, HandSide.LEFT, {
        makeClassNamesUnique: true,
        selectiveColorMode: true,
        themeMode: "dark",
      });
      const wickTag = handColored.match(
        /<[^>]+\sdata-animated-torch-wick=(?:"[^"]*"|'[^']*')[^>]*>/i
      )?.[0];

      expect(wickTag).toContain("fill:none");
      expect(wickTag).toContain("stroke:none");
      expect(
        handColored.match(/data-animated-torch-flame="true"/g)
      ).toHaveLength(1);
      expect(
        handColored.match(/data-animated-torch-flame-part=/g)
      ).toHaveLength(2);
      expect(handColored).toContain('fill="#F2673A"');
      expect(handColored).toContain('fill="#F4EA02"');
      expect(handColored).toContain(
        `transform="translate(${baseX} ${centerY}) rotate(90) scale(${scale}) translate(-48.77 -125)"`
      );
      expect(original).toContain(
        `viewBox="${minX} ${minY} ${width} ${height}"`
      );

      const maxX = minX + width;
      const maxY = minY + height;
      expect(baseX + 125 * scale).toBeLessThanOrEqual(maxX);
      expect(centerY - 48.77 * scale).toBeGreaterThanOrEqual(minY);
      expect(centerY + 48.77 * scale).toBeLessThanOrEqual(maxY);

      // The expanded artwork stays centered on the original hand pivot.
      expect(minX + width / 2).toBeCloseTo(pivotX);
      expect(minY + height / 2).toBeCloseTo(pivotY);
    }
  );

  it.each([
    [PropType.TORCH, "torch.svg", 2],
    [PropType.BIGTORCH, "bigtorch.svg", 3],
  ])(
    "uses a light %s shaft in dark animation and a black shaft in light animation",
    async (propType, filename, shaftPartCount) => {
      const original = readFileSync(
        resolve(
          process.cwd(),
          "static",
          "images",
          "props",
          "animated",
          filename
        ),
        "utf8"
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          text: async () => original,
        }))
      );

      try {
        const dark = await generatePropSvg(propType, "#3575E2", "dark");
        const light = await generatePropSvg(propType, "#3D44B8", "light");
        const markedTagPattern =
          /<[^>]+\sdata-animated-torch-shaft=(?:"[^"]*"|'[^']*')[^>]*>/gi;
        const darkShaftParts = dark.svg.match(markedTagPattern) ?? [];
        const lightShaftParts = light.svg.match(markedTagPattern) ?? [];

        expect(darkShaftParts).toHaveLength(shaftPartCount);
        expect(lightShaftParts).toHaveLength(shaftPartCount);
        expect(
          darkShaftParts.every((tag) =>
            tag.includes(`fill:${EDITOR_TORCH_PALETTE.dark.shaft}`)
          )
        ).toBe(true);
        expect(
          lightShaftParts.every((tag) =>
            tag.includes(`fill:${EDITOR_TORCH_PALETTE.light.shaft}`)
          )
        ).toBe(true);
      } finally {
        vi.unstubAllGlobals();
      }
    }
  );

  it("uses the expanded flame-safe bounds before animated textures finish loading", () => {
    expect(getPropDimensions("torch")).toEqual({ width: 360, height: 35.7 });
    expect(getPropDimensions("bigtorch")).toEqual({
      width: 402,
      height: 57.3,
    });
  });

  it("replaces an existing editor flame instead of duplicating it", () => {
    const original = '<path data-torch-wick="true" fill="#F6E5B6" />';
    const firstPass = applyEditorTorchPalette(
      original,
      "editor",
      PropType.TORCH,
      true
    );
    const secondPass = applyEditorTorchPalette(
      firstPass,
      "editor",
      PropType.TORCH,
      true
    );

    expect(secondPass.match(/data-torch-flame="true"/g)).toHaveLength(1);
  });
});
