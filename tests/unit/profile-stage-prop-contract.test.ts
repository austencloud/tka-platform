import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const artifactTile = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/features/creators/components/profile/stage/ArtifactTile.svelte"
  ),
  "utf8"
);

describe("profile stage sequence prop contract", () => {
  it("feeds the selected prop pair to both the mandala floor and animation", () => {
    expect(artifactTile).toContain(
      'import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";'
    );
    expect(artifactTile).toContain(
      'left: settingsService.settings.leftPropType ?? "staff"'
    );
    expect(artifactTile).toContain(
      'right: settingsService.settings.rightPropType ?? "staff"'
    );
    expect(artifactTile).toContain("leftPropType={seqPropTypes.left}");
    expect(artifactTile).toContain("rightPropType={seqPropTypes.right}");
    expect(artifactTile).toMatch(
      /InlineAnimationPlayer\.svelte"[\s\S]{0,500}leftPropType: seqPropTypes\.left,[\s\S]{0,100}rightPropType: seqPropTypes\.right/
    );
    expect(artifactTile).not.toContain("creatorIntent?.propConfig");
  });
});
