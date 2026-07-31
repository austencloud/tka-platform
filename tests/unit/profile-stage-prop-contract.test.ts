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
      'blue: settingsService.settings.bluePropType ?? "staff"'
    );
    expect(artifactTile).toContain(
      'red: settingsService.settings.redPropType ?? "staff"'
    );
    expect(artifactTile).toContain("bluePropType={seqPropTypes.blue}");
    expect(artifactTile).toContain("redPropType={seqPropTypes.red}");
    expect(artifactTile).toMatch(
      /InlineAnimationPlayer\.svelte"[\s\S]{0,500}bluePropType: seqPropTypes\.blue,[\s\S]{0,100}redPropType: seqPropTypes\.red/
    );
    expect(artifactTile).not.toContain("creatorIntent?.propConfig");
  });
});
