import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SELECTIVE_COLOR_PROP_TYPES,
  applyMotionColorToSvg,
  getMotionColor,
} from "$lib/shared/utils/svg-color-utils";

const CLUB_ASSETS = [
  "static/images/props/club.svg",
  "static/images/props/animated/club.svg",
  "static/images/props/buttons/club.svg",
  "static/images/props/pictograph/club.svg",
  "mcp-server-pkg/assets/images/props/club.svg",
] as const;

function readAsset(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function clubPart(svg: string, part: string): string {
  const tag = new RegExp(
    `<[^>]+data-club-part=["']${part}["'][^>]*>`,
    "i"
  ).exec(svg)?.[0];
  if (!tag) throw new Error(`Missing club part: ${part}`);
  return tag;
}

describe("regular 2D club artwork", () => {
  it("keeps every renderer on the same measured silhouette and material split", () => {
    const canonical = readAsset(CLUB_ASSETS[0]);

    expect(canonical).toContain('viewBox="0 0 258.67 34.17"');
    expect(canonical).toContain('data-club-art="regular"');
    for (const part of ["knob", "handle", "marker", "body", "cap"]) {
      expect(clubPart(canonical, part)).toBeTruthy();
    }
    for (const path of CLUB_ASSETS.slice(1)) {
      expect(readAsset(path)).toBe(canonical);
    }
  });

  it.each(["blue", "red"] as const)(
    "colors only the club body %s",
    (motionColor) => {
      const original = readAsset(CLUB_ASSETS[0]);
      const colored = applyMotionColorToSvg(original, motionColor, {
        selectiveColorMode: true,
        themeMode: "dark",
      });

      expect(SELECTIVE_COLOR_PROP_TYPES as readonly string[]).toContain("club");
      expect(clubPart(colored, "body")).toContain(
        `fill="${getMotionColor(motionColor, "dark")}"`
      );
      expect(clubPart(colored, "knob")).toContain('fill="#1B1B1E"');
      expect(clubPart(colored, "handle")).toContain('fill="#EEF2FF"');
      expect(clubPart(colored, "marker")).toContain('fill="#141416"');
      expect(clubPart(colored, "cap")).toContain('fill="#1B1B1E"');
    }
  );
});
