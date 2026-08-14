import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const card = read(
  "src/lib/shared/inbox/components/messages/SequenceMessageCard.svelte"
);
const preview = read(
  "src/lib/shared/inbox/components/messages/SequenceMessagePreview.svelte"
);
const player = read(
  "src/lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
);

describe("inbox inline sequence player contract", () => {
  it("keeps playback out of the eager inbox graph and behind user intent", () => {
    expect(preview).toContain("LazyMount");
    expect(preview).toMatch(
      /loader=\{\(\) =>[\s\S]*import\("\$lib\/features\/browse\/sequences\/display\/components\/media-viewer\/InlineAnimationPlayer\.svelte"\)/
    );
    expect(preview).toContain("let playerRequested = $state(false)");
    expect(preview).toContain("active={playerActive}");
    expect(preview).toContain("onclick={requestPlayback}");
  });

  it("composes the existing compact controls and pauses offscreen", () => {
    expect(preview).toContain("interactive: true");
    expect(preview).toContain('hoverHint: "none"');
    expect(preview).toContain("cornerToggle: true");
    expect(preview).toContain("playbackAllowed: visible");
    expect(preview).toContain("disableContextMenu: true");
    expect(player).toContain('hoverHint = "badge"');
    expect(player).toContain("cornerToggle = false");
    expect(player).toContain("playbackAllowed = true");
    expect(player).toContain("{cornerToggle}");
    expect(player).toMatch(/if \(playbackAllowed \|\| !isPlaying/);
  });

  it("keeps live playback and full-view navigation as separate controls", () => {
    expect(card).toContain("<SequenceMessagePreview");
    expect(card).toContain("Open sequence");
    expect(card).not.toMatch(/<button[\s\S]{0,80}class="card-content"/);
    expect(card).not.toContain("buildThumbnailUrl");
  });
});
