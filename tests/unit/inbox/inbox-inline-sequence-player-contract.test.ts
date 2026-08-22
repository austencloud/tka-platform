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
const bubble = read(
  "src/lib/shared/inbox/components/messages/MessageBubble.svelte"
);
const thread = read(
  "src/lib/shared/inbox/components/messages/MessageThread.svelte"
);
const preview = read(
  "src/lib/shared/inbox/components/messages/SequenceMessagePreview.svelte"
);
const showcase = read(
  "src/lib/shared/sequence-preview/components/SequenceShowcasePreview.svelte"
);
const player = read(
  "src/lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
);

describe("inbox inline sequence player contract", () => {
  it("keeps playback out of the eager inbox graph until Play is selected", () => {
    expect(preview).toContain("SequenceShowcasePreview");
    expect(preview).toContain('activation="manual"');
    expect(preview).not.toContain('activation="ambient"');
    expect(showcase).toContain("LazyMount");
    expect(showcase).toMatch(
      /loader=\{\(\) =>[\s\S]*import\("\$lib\/features\/browse\/sequences\/display\/components\/media-viewer\/InlineAnimationPlayer\.svelte"\)/
    );
    expect(showcase).toContain("let manualPlayerRequested = $state(false)");
    expect(showcase).toContain("active={playerMounted}");
    expect(showcase).toContain("keepAlive={false}");
    expect(showcase).toContain("onclick={requestPlayback}");
    expect(showcase).not.toContain("autoStart");
  });

  it("composes the Choreo Card and compact player in one fixed stage", () => {
    expect(showcase).toContain("PropAwareThumbnail");
    expect(showcase).toContain(
      'import("$lib/shared/timeline/StepStrip.svelte")'
    );
    expect(showcase).toContain('class="card-layer"');
    expect(showcase).toContain('class="strip-zone"');
    expect(showcase).toContain("currentStep: playbackStep");
    expect(showcase).toContain(
      "onStepChange: (step: number) => (playbackStep = step)"
    );
    expect(showcase).toContain('density: "compact"');
    expect(showcase).toContain("fillHeight: true");
    expect(showcase).toContain('interactive: activation === "manual"');
    expect(showcase).toContain('hoverHint: "none"');
    expect(showcase).toContain('cornerToggle: activation === "manual"');
    expect(showcase).toContain(
      "playbackActive && visible && !ambientCardRevealed"
    );
    expect(showcase).toContain("resumeWhenPlaybackAllowed: true");
    expect(showcase).toContain("disableContextMenu: true");
    expect(player).toContain('hoverHint = "badge"');
    expect(player).toContain("cornerToggle = false");
    expect(player).toContain("playbackAllowed = true");
    expect(player).toContain(
      "if (!servicesReady || !playbackController) return;"
    );
    expect(player).toContain("{cornerToggle}");
    expect(player).toContain("pausedByPlaybackGate");
  });

  it("keeps live playback and full-view navigation as separate controls", () => {
    expect(card).toContain("<SequenceMessagePreview");
    expect(card).toContain("Open in Sequence Viewer");
    expect(card).toContain(
      'import("$lib/shared/sequence-viewer/services/sequence-data-provider")'
    );
    expect(card).toContain(
      'import("$lib/shared/sequence-viewer/services/sequence-viewer-navigator")'
    );
    expect(card).toContain("openSequenceViewer(viewerSequence");
    expect(card).not.toContain("resolveSequenceRoute");
    expect(card).not.toContain("goto(sequenceRoute)");
    expect(card).not.toMatch(/<button[\s\S]{0,80}class="card-content"/);
    expect(card).not.toContain("buildThumbnailUrl");
    expect(card).not.toContain("fa-music");
    expect(card).not.toContain('class="meta-row"');
  });

  it("isolates inline animation state from the Create workspace", () => {
    expect(showcase).toContain("createAnimationScope");
    expect(showcase).toContain("visibilityManagerOverride:");
    expect(showcase).toContain("effectsConfigState:");
    expect(player).toContain("syncSharedWorkspaceState: false");
  });

  it("gives one message preview exclusive playback ownership", () => {
    expect(thread).toContain("createSequencePreviewCoordinator");
    expect(thread).toContain("isPlaybackActive");
    expect(thread).not.toContain("beginHoverPreview");
    expect(thread).not.toContain("shouldAutoStart");
    expect(thread).toContain("onSequencePlaybackRequest");
    expect(bubble).toContain("playbackActive={sequencePlaybackActive}");
    expect(bubble).not.toContain("onSequenceHoverStart");
    expect(card).toContain("{playbackActive}");
    expect(preview).toContain('activation="manual"');
    expect(showcase).toContain(
      "playbackMounted && playerRequested && sequence !== null"
    );
  });
});
