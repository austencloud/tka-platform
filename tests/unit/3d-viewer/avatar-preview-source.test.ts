import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveAvatarPreviewPerformer } from "$lib/shared/3d/components/controls/avatar-select/avatar-preview-source";

const pickerSource = readFileSync(
  resolve("src/lib/shared/3d/components/controls/PerformerAvatarPicker.svelte"),
  "utf8"
);
const previewSource = readFileSync(
  resolve(
    "src/lib/shared/3d/components/controls/avatar-select/AvatarCardLivePreview.svelte"
  ),
  "utf8"
);

describe("avatar picker live preview source", () => {
  const performers = [{ id: "performer-1" }, { id: "performer-2" }];

  it("uses the lowest-number performer for an all-performers preview", () => {
    expect(resolveAvatarPreviewPerformer(performers, null)).toBe(performers[0]);
  });

  it("uses the selected performer and safely falls back when selection is stale", () => {
    expect(resolveAvatarPreviewPerformer(performers, 1)).toBe(performers[1]);
    expect(resolveAvatarPreviewPerformer(performers, 99)).toBe(performers[0]);
    expect(resolveAvatarPreviewPerformer([], null)).toBeNull();
  });

  it("keeps WebGL to the pinned personal portrait plus one interaction preview", () => {
    expect(pickerSource.match(/<AvatarCardLivePreview/g)).toHaveLength(1);
    expect(pickerSource).toContain("{#if hasLivePreview}");
    expect(pickerSource).toContain(
      "isPersonalAvatar || livePreviewAvatarId === definition.id"
    );
    expect(previewSource).toContain("<CanvasLifecycle />");
    expect(previewSource).toContain('renderMode="on-demand"');
    expect(previewSource).not.toContain("<Scene3D");
  });

  it("plays only the hovered or focused preview and honors reduced motion", () => {
    expect(previewSource).toContain(
      "active && !reduceMotion && previewState.hasSequence"
    );
    expect(previewSource).toContain("autoRotate={active && !reduceMotion}");
    expect(pickerSource).toContain(
      "focusedAvatarId ?? hoveredAvatarId ?? restingPreviewAvatarId"
    );
    expect(pickerSource).toMatch(/personalAvatarId\s*\?\?\s*selectedAvatarId/);
  });
});
