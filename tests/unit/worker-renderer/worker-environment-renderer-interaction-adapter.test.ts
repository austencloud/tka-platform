import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const environmentRenderer = source(
  "src/lib/shared/3d/worker-renderer/components/WorkerEnvironmentRenderer.svelte"
);
const interactionAdapter = source(
  "src/lib/shared/3d/worker-renderer/components/WorkerPerformerInteractionAdapter.svelte"
);
const moveHandle = source(
  "src/lib/shared/3d/worker-renderer/components/WorkerPerformerMoveHandle.svelte"
);

describe("worker environment performer interaction adapter", () => {
  it("keeps input on one stable host across worker canvas handoffs", () => {
    expect(environmentRenderer).toContain(
      'class="worker-environment-renderer__interaction-surface"'
    );
    expect(environmentRenderer).toContain(
      "container: mountedInteractionSurface"
    );
    expect(environmentRenderer).toContain("{interactionSurface}");
    expect(environmentRenderer).toContain("projectionContainer={container}");
    expect(interactionAdapter).toContain(
      "createWorkerPerformerInteractionBridge({"
    );
    expect(interactionAdapter).toContain("interactionSurface,");
    expect(interactionAdapter).not.toMatch(
      /querySelector\([^)]*canvas|getElementsByTagName\([^)]*canvas/
    );
  });

  it("updates clone-safe interaction frames from live camera snapshots", () => {
    expect(interactionAdapter).toContain(
      "function currentFrame(): WorkerPerformerInteractionFrame"
    );
    expect(interactionAdapter).toContain(
      "position: [...cameraSnapshot.position]"
    );
    expect(interactionAdapter).toContain("position: { ...performer.position }");
    expect(interactionAdapter).toContain(
      "stageBounds: { ...frame.stageBounds }"
    );
    expect(interactionAdapter).toContain("bridge.update(currentFrame())");
    expect(environmentRenderer).toContain("cameraSnapshot = snapshot");
    expect(environmentRenderer).toContain("onChange: applyCameraSnapshot");
  });

  it("publishes hover and drag state for app-owned worker snapshots", () => {
    expect(interactionAdapter).toContain(
      "hoveredIndex: bridge?.hoveredIndex ?? null"
    );
    expect(interactionAdapter).toContain(
      "draggingIndex: bridge?.draggingIndex ?? null"
    );
    expect(interactionAdapter).toContain("requestAnimationFrame(() => {");
    expect(interactionAdapter).toContain('"lostpointercapture"');
    expect(environmentRenderer).toContain("onPerformerInteractionChange");
    expect(environmentRenderer).toContain(
      "onInteractionChange={handlePerformerInteractionChange}"
    );
    expect(environmentRenderer).toContain(
      "performerInteractionState.draggingIndex !== null"
    );
  });

  it("mirrors production camera-drag arbitration and adaptive DPR", () => {
    expect(environmentRenderer).toContain(
      "onControlStart: handleCameraInteractionStart"
    );
    expect(environmentRenderer).toContain(
      "onControlEnd: handleCameraInteractionEnd"
    );
    expect(environmentRenderer).toContain(
      "onCameraInteractionStart?.(snapshot)"
    );
    expect(environmentRenderer).toContain("onCameraInteractionEnd?.(snapshot)");
    expect(environmentRenderer).toContain(
      "cameraController?.setEnabled(value)"
    );
    expect(environmentRenderer).toContain("pixelRatio?: number");
    expect(environmentRenderer).toContain("?.setPixelRatio?.(value)");
    expect(environmentRenderer).toMatch(
      /\$effect\(\(\) => \{\s+applyPixelRatio\(pixelRatio\);/
    );
  });

  it("reports unsupported and exceptional interaction failures", () => {
    expect(interactionAdapter).toContain('reason: "unsupported"');
    expect(interactionAdapter).toContain("blockers: [...capability.blockers]");
    expect(interactionAdapter).toContain('fail("update-failed", error)');
    expect(interactionAdapter).toContain(
      'fail("initialization-failed", error)'
    );
    expect(environmentRenderer).toContain(
      "onFailure={onPerformerInteractionFailure}"
    );
  });
});

describe("worker DOM move handle adapter", () => {
  it("renders the committed presentation owner at the bridge projection", () => {
    expect(moveHandle).toContain("createWorkerMoveHandleOwner(");
    expect(moveHandle).toContain("presentationOwner.update(");
    expect(moveHandle).toContain(
      "bridge.projectStagePosition({ x, z }, worldY)"
    );
    expect(moveHandle).toContain("presentation.geometry.minWidthPx");
    expect(moveHandle).toContain("presentation.material.borderColor");
    expect(moveHandle).toContain("presentation.typography.fontSize");
    expect(moveHandle).toContain("initial?.motion.durationMs");
  });

  it("preserves the accessible pointer, keyboard, and browser suppression contract", () => {
    expect(moveHandle).toContain("type={presentation.interaction.buttonType}");
    expect(moveHandle).toContain("aria-label={presentation.accessibleLabel}");
    expect(moveHandle).toContain("title={presentation.title}");
    expect(moveHandle).toContain("onkeydown={handleKeydown}");
    expect(moveHandle).toContain("onpointerdown={handlePointerDown}");
    expect(moveHandle).toContain("onlostpointercapture={handlePointerCancel}");
    expect(moveHandle).toContain(
      "oncontextmenu={(event) => event.preventDefault()}"
    );
    expect(moveHandle).toContain(
      "ondragstart={(event) => event.preventDefault()}"
    );
    expect(interactionAdapter).toContain(
      "interactionSurface.dispatchEvent(forwarded)"
    );
  });

  it("tracks focus-visible and reduced-motion changes through the owner", () => {
    expect(moveHandle).toContain('.matches(\n      ":focus-visible"\n    )');
    expect(moveHandle).toContain("prefersReducedMotion = reducedMotion()");
    expect(moveHandle).toContain(
      'window.matchMedia("(prefers-reduced-motion: reduce)")'
    );
    expect(moveHandle).toContain('attributeFilter: ["data-motion-preference"]');
  });
});
