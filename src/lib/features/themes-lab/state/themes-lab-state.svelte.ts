import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import { createSceneLabState } from "$lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte";
import { createComposerEditorState } from "$lib/shared/3d/scene-composer/composer-editor-state.svelte";
import {
  THEME_OPTIONS,
  getThemeOption,
  type ThemeId,
} from "../domain/theme-types";
import type { SceneLabContext } from "$lib/features/lab/tabs/scene-lab/context/scene-lab-context";

export type ThemeMode = "2d" | "3d";

export function createThemesLabState() {
  let themeId = $state<ThemeId>("ocean");
  let mode = $state<ThemeMode>("2d");

  const sceneState = createSceneLabState();
  const composerState = createComposerEditorState();

  function setTheme(id: ThemeId) {
    themeId = id;

    const option = getThemeOption(id);
    if (!option) return;

    sceneState.setSceneId(option.sceneId);

    void settingsService.updateSetting("backgroundCategory", "animated");
    void settingsService.updateSetting("backgroundType", option.backgroundType);
  }

  function setMode(m: ThemeMode) {
    mode = m;
  }

  const sceneLabContext: SceneLabContext = {
    get state() {
      return sceneState;
    },
    get composerState() {
      return composerState;
    },
  };

  return {
    get themeId() {
      return themeId;
    },
    get mode() {
      return mode;
    },
    get sceneState() {
      return sceneState;
    },
    get composerState() {
      return composerState;
    },
    get sceneLabContext() {
      return sceneLabContext;
    },
    get currentTheme() {
      return getThemeOption(themeId);
    },
    setTheme,
    setMode,
    themeOptions: THEME_OPTIONS,
  };
}

export type ThemesLabState = ReturnType<typeof createThemesLabState>;
