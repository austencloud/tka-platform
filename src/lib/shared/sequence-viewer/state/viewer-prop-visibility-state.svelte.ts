import { untrack } from "svelte";
import type {
  getSettings,
  updateSettings,
} from "$lib/shared/application/state/app-state.svelte";
import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { getSequenceMotionVisibility } from "$lib/shared/foundation/services/sequence-motion-profile";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { ImageCompositionSyncState } from "../components/image-composition-sync.svelte";
import { SequenceViewerVisibilityState } from "./viewer-visibility-state.svelte";

interface ViewerPropVisibilityInputs {
  imageComposition: ImageCompositionSyncState;
  getSequence: () => SequenceData | null;
  getHandPathMode: () => boolean;
  getInitialBlueVisible: () => boolean | undefined;
  getInitialRedVisible: () => boolean | undefined;
  getAnimationServicesReady: () => boolean;
  getHapticService: () => HapticFeedback | null;
  onUrlParamChange: ((key: string, value: string) => void) | undefined;
}

interface ViewerPropVisibilityDependencies {
  getSettings: typeof getSettings;
  updateSettings: typeof updateSettings;
  getSequenceMotionVisibility: typeof getSequenceMotionVisibility;
  updateAnimationPropTypes: (
    bluePropType: PropType,
    redPropType: PropType
  ) => void;
  setAnimationDarkMode: (darkMode: boolean) => void;
  encodePropForUrl: (propType: PropType) => string;
}

function applyMotionVisibility(
  state: SequenceViewerVisibilityState,
  visibility: { showBlueMotion: boolean; showRedMotion: boolean }
): void {
  state.reset();
  if (!visibility.showBlueMotion) state.setBlueMotion(false);
  if (!visibility.showRedMotion) state.setRedMotion(false);
}

export function createViewerPropVisibilityState(
  inputs: ViewerPropVisibilityInputs,
  dependencies: ViewerPropVisibilityDependencies
) {
  const settings = $derived(dependencies.getSettings());
  const isHandPath = $derived(
    inputs.getHandPathMode() ||
      Boolean(inputs.getSequence()?.metadata?.isHandPathVisualization)
  );
  const bluePropType = $derived(settings.bluePropType);
  const redPropType = $derived(settings.redPropType);
  const catDogModeEnabled = $derived(settings.catDogMode);
  const activeBlueProp = $derived(
    isHandPath ? PropType.HAND : (bluePropType ?? PropType.STAFF)
  );
  const activeRedProp = $derived(
    isHandPath ? PropType.HAND : (redPropType ?? PropType.STAFF)
  );
  const activeCatDog = $derived(
    isHandPath ? false : (catDogModeEnabled ?? false)
  );

  const viewerVisibility = new SequenceViewerVisibilityState();
  applyMotionVisibility(
    viewerVisibility,
    inputs.getSequence()
      ? dependencies.getSequenceMotionVisibility(inputs.getSequence()!)
      : { showBlueMotion: true, showRedMotion: true }
  );

  $effect(() => {
    const sequence = inputs.getSequence();
    void sequence?.id;
    const visibility = sequence
      ? dependencies.getSequenceMotionVisibility(sequence)
      : { showBlueMotion: true, showRedMotion: true };
    untrack(() => {
      applyMotionVisibility(viewerVisibility, {
        showBlueMotion:
          visibility.showBlueMotion && (inputs.getInitialBlueVisible() ?? true),
        showRedMotion:
          visibility.showRedMotion && (inputs.getInitialRedVisible() ?? true),
      });
    });
  });

  $effect(() => {
    if (!inputs.getAnimationServicesReady()) return;
    try {
      dependencies.updateAnimationPropTypes(activeBlueProp, activeRedProp);
    } catch {
      // A viewer can select props before the animation service finishes
      // loading. The service reads the same settings when startup completes.
    }
  });

  function handlePropTypeChange(propType: PropType): void {
    void dependencies.updateSettings({
      bluePropType: propType,
      redPropType: propType,
    });
    if (inputs.getAnimationServicesReady()) {
      dependencies.updateAnimationPropTypes(propType, propType);
    }
    const encoded = dependencies.encodePropForUrl(propType);
    inputs.onUrlParamChange?.("bp", encoded);
    inputs.onUrlParamChange?.("rp", encoded);
  }

  function handleUnifiedDarkModeToggle(): void {
    inputs.getHapticService()?.trigger("selection");
    const darkMode = !inputs.imageComposition.imgDarkMode;
    void dependencies.updateSettings({ darkMode });
    inputs.imageComposition.imageComposition.setDarkMode(darkMode);
    dependencies.setAnimationDarkMode(darkMode);
  }

  return {
    viewerVisibility,
    get isHandPath() {
      return isHandPath;
    },
    get activeBlueProp() {
      return activeBlueProp;
    },
    get activeRedProp() {
      return activeRedProp;
    },
    get activeCatDog() {
      return activeCatDog;
    },
    handlePropTypeChange,
    handleUnifiedDarkModeToggle,
  };
}

export type ViewerPropVisibilityState = ReturnType<
  typeof createViewerPropVisibilityState
>;
