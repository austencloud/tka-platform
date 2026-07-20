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
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";

const EXPORT_OPTIONS_KEY = "tka_export_options";
const IMAGE_COMPOSITION_KEY = "tka-image-composition-settings";

describe("card column preferences", () => {
  const composition = getImageCompositionManager();

  beforeEach(() => {
    localStorage.clear();
    auth.currentUser = null;
    updateSetting.mockClear();
    composition.setColumnCountForStepCount(8, null);
    composition.setColumnCountForStepCount(16, null);
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

  it("returns a sequence length to Auto by removing its saved override", () => {
    composition.setColumnCountForStepCount(16, 8);
    composition.setColumnCountForStepCount(16, null);

    expect(composition.getColumnCountForStepCount(16)).toBeNull();
    expect(composition.getSettings().columnCountOverrides).not.toHaveProperty(
      "16"
    );
  });

  it("saves an authenticated user's manual choice to account settings", () => {
    auth.currentUser = { uid: "user-1" };
    composition.setColumnCountForStepCount(16, 8);

    expect(updateSetting).toHaveBeenCalledWith(
      "imageExport",
      expect.objectContaining({ columnCountOverrides: { "16": 8 } })
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
