import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  currentUser: null as { uid: string } | null,
}));
const updateSetting = vi.hoisted(() => vi.fn());

vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$lib/shared/auth/firebase", () => ({
  getAuthSync: () => auth,
}));
vi.mock("$lib/shared/settings/state/settings-state.svelte", () => ({
  settingsService: { currentSettings: {}, updateSetting },
}));
vi.mock(
  "$lib/shared/animation-engine/state/animation-visibility-state.svelte",
  () => ({
    getAnimationVisibilityManager: () => ({
      isDarkMode: () => false,
      registerObserver: () => {},
    }),
  })
);

import { createExportOptionsState } from "$lib/shared/animation-panel/state/export-options-state.svelte";

type ImageCompositionManager = ReturnType<
  (typeof import("$lib/shared/share/state/image-composition-state.svelte"))["getImageCompositionManager"]
>;

const EXPORT_OPTIONS_KEY = "tka_export_options";
const IMAGE_COMPOSITION_KEY = "tka-image-composition-settings";

describe("card column preferences", () => {
  let composition: ImageCompositionManager;

  beforeEach(async () => {
    localStorage.clear();
    auth.currentUser = null;
    updateSetting.mockClear();
    vi.resetModules();
    const { getImageCompositionManager } =
      await import("$lib/shared/share/state/image-composition-state.svelte");
    composition = getImageCompositionManager();
  });

  it("defaults every sequence length to Auto", () => {
    expect(composition.getColumnCountForStepCount(8)).toBeNull();
    expect(composition.getColumnCountForStepCount(16)).toBeNull();
  });

  it("saves a manual choice only for the sequence length the user changed", () => {
    composition.setColumnCountForStepCount(16, 8);

    expect(composition.getColumnCountForStepCount(16)).toBe(8);
    expect(composition.getColumnCountForStepCount(8)).toBeNull();
    const persisted = JSON.parse(
      localStorage.getItem(IMAGE_COMPOSITION_KEY) ?? "{}"
    );
    expect(persisted.columnCountOverrides).toEqual({ "16": 8 });
  });

  it("persists Auto explicitly so a remote merge cannot restore the old value", () => {
    composition.setColumnCountForStepCount(8, 4);
    composition.setColumnCountForStepCount(16, 8);
    composition.setColumnCountForStepCount(16, null);

    expect(composition.getColumnCountForStepCount(16)).toBeNull();
    expect(composition.getSettings().columnCountOverrides).toEqual({
      "8": 4,
      "16": null,
    });
    const persisted = JSON.parse(
      localStorage.getItem(IMAGE_COMPOSITION_KEY) ?? "{}"
    );
    expect(persisted.columnCountOverrides).toEqual({ "8": 4, "16": null });
  });

  it("saves an authenticated user's manual choice to account settings", () => {
    auth.currentUser = { uid: "user-1" };
    composition.setColumnCountForStepCount(16, 8);

    expect(updateSetting).toHaveBeenCalledWith(
      "imageExport",
      expect.objectContaining({ columnCountOverrides: { "16": 8 } })
    );
  });

  it("saves an authenticated user's Auto choice as an explicit null", () => {
    auth.currentUser = { uid: "user-1" };
    composition.setColumnCountForStepCount(16, 8);
    updateSetting.mockClear();

    composition.setColumnCountForStepCount(16, null);

    expect(updateSetting).toHaveBeenCalledWith(
      "imageExport",
      expect.objectContaining({ columnCountOverrides: { "16": null } })
    );
  });

  it("ignores and retires a legacy browser-global eight-column value", () => {
    localStorage.setItem(
      EXPORT_OPTIONS_KEY,
      JSON.stringify({ image: { columnCount: 8 } })
    );

    const exportOptions = createExportOptionsState();
    expect(exportOptions.getImageOptions()).not.toHaveProperty("columnCount");

    exportOptions.setImageDarkMode(false);
    const persisted = JSON.parse(
      localStorage.getItem(EXPORT_OPTIONS_KEY) ?? "{}"
    );
    expect(persisted.image).not.toHaveProperty("columnCount");
  });
});
