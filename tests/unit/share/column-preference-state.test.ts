import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  currentUser: null as { uid: string } | null,
}));
const updateSetting = vi.hoisted(() => vi.fn());
// Stands in for the account-settings store: `currentSettings` is the localStorage
// mirror read at construction, `remoteListeners` the Firestore-arrival seam.
const settingsMock = vi.hoisted(() => ({
  currentSettings: {} as { imageExport?: Record<string, unknown> },
  updateSetting,
  remoteListeners: new Set<(settings: Record<string, unknown>) => void>(),
  onRemoteSettingsApplied(listener: (settings: Record<string, unknown>) => void) {
    settingsMock.remoteListeners.add(listener);
    return () => settingsMock.remoteListeners.delete(listener);
  },
  emitRemote(settings: Record<string, unknown>) {
    settingsMock.remoteListeners.forEach((listener) => listener(settings));
  },
}));

vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$lib/shared/auth/firebase", () => ({
  getAuthSync: () => auth,
}));
vi.mock("$lib/shared/settings/state/settings-state.svelte", () => ({
  settingsService: settingsMock,
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

  async function loadManager(): Promise<ImageCompositionManager> {
    vi.resetModules();
    settingsMock.remoteListeners.clear();
    const { getImageCompositionManager } =
      await import("$lib/shared/share/state/image-composition-state.svelte");
    return getImageCompositionManager();
  }

  beforeEach(async () => {
    localStorage.clear();
    auth.currentUser = null;
    updateSetting.mockClear();
    settingsMock.currentSettings = {};
    composition = await loadManager();
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

  // Regression: a saved "Auto" reappearing as 8 on the next launch. Firestore held
  // the correct null while the UI showed 8, so the defect was on the read side —
  // the account-settings localStorage mirror (only written while signed in) went
  // stale and outranked the dedicated store on load.
  it("mirrors a signed-out change into account settings so the local copies cannot diverge", () => {
    composition.setColumnCountForStepCount(8, null);

    expect(updateSetting).toHaveBeenCalledWith(
      "imageExport",
      expect.objectContaining({ columnCountOverrides: { "8": null } })
    );
  });

  it("prefers the dedicated local store over a stale account-settings mirror", async () => {
    localStorage.setItem(
      IMAGE_COMPOSITION_KEY,
      JSON.stringify({ columnCountOverrides: { "8": null } })
    );
    settingsMock.currentSettings = {
      imageExport: { columnCountOverrides: { "8": 8 } },
    };
    auth.currentUser = { uid: "user-1" };

    const reloaded = await loadManager();

    expect(reloaded.getColumnCountForStepCount(8)).toBeNull();
  });

  it("adopts the server copy once the real Firestore settings arrive", async () => {
    localStorage.setItem(
      IMAGE_COMPOSITION_KEY,
      JSON.stringify({ columnCountOverrides: { "8": 8 } })
    );
    auth.currentUser = { uid: "user-1" };
    const reloaded = await loadManager();
    expect(reloaded.getColumnCountForStepCount(8)).toBe(8);

    settingsMock.emitRemote({ imageExport: { columnCountOverrides: { "8": null } } });

    expect(reloaded.getColumnCountForStepCount(8)).toBeNull();
    const persisted = JSON.parse(
      localStorage.getItem(IMAGE_COMPOSITION_KEY) ?? "{}"
    );
    expect(persisted.columnCountOverrides).toEqual({ "8": null });
  });

  it("keeps a choice made this session when a later snapshot carries an older value", async () => {
    auth.currentUser = { uid: "user-1" };
    const reloaded = await loadManager();
    reloaded.setColumnCountForStepCount(8, null);

    settingsMock.emitRemote({ imageExport: { columnCountOverrides: { "8": 8 } } });

    expect(reloaded.getColumnCountForStepCount(8)).toBeNull();
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
