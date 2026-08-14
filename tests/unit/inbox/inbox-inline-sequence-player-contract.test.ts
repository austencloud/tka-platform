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
const player = read(
  "src/lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
);

describe("inbox inline sequence player contract", () => {
  it("keeps playback out of the eager inbox graph until Play is selected", () => {
    expect(preview).toContain("LazyMount");
    expect(preview).toMatch(
      /loader=\{\(\) =>[\s\S]*import\("\$lib\/features\/browse\/sequences\/display\/components\/media-viewer\/InlineAnimationPlayer\.svelte"\)/
    );
    expect(preview).toContain("let playerRequested = $state(false)");
    expect(preview).toContain("active={playerMounted}");
    expect(preview).toContain("keepAlive={false}");
    expect(preview).toContain("onclick={requestPlayback}");
    expect(preview).not.toContain("autoStart");
    expect(preview).not.toContain("onpointerenter");
    expect(preview).not.toContain("onHoverStart");
  });

  it("composes the Choreo Card and compact player in one fixed stage", () => {
    expect(preview).toContain("PropAwareThumbnail");
    expect(preview).toContain(
      'import("$lib/shared/timeline/StepStrip.svelte")'
    );
    expect(preview).toContain('class="card-layer"');
    expect(preview).toContain('class="strip-zone"');
    expect(preview).toContain("currentStep: playbackStep");
    expect(preview).toContain(
      "onStepChange: (step: number) => (playbackStep = step)"
    );
    expect(preview).toContain('density: "compact"');
    expect(preview).toContain("fillHeight: true");
    expect(preview).toContain("interactive: true");
    expect(preview).toContain('hoverHint: "none"');
    expect(preview).toContain("cornerToggle: true");
    expect(preview).toContain("playbackAllowed: playbackActive && visible");
    expect(preview).toContain("resumeWhenPlaybackAllowed: true");
    expect(preview).toContain("disableContextMenu: true");
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
    expect(preview).toContain("createAnimationScope");
    expect(preview).toContain("visibilityManagerOverride:");
    expect(preview).toContain("effectsConfigState:");
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
    expect(preview).toContain(
      "playbackMounted && playerRequested && sequence !== null"
    );
  });
});
