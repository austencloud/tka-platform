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
  getInitialLeftVisible: () => boolean | undefined;
  getInitialRightVisible: () => boolean | undefined;
  getAnimationServicesReady: () => boolean;
  getHapticService: () => HapticFeedback | null;
  onUrlParamChange: ((key: string, value: string) => void) | undefined;
}

interface ViewerPropVisibilityDependencies {
  getSettings: typeof getSettings;
  updateSettings: typeof updateSettings;
  getSequenceMotionVisibility: typeof getSequenceMotionVisibility;
  updateAnimationPropTypes: (
    leftPropType: PropType,
    rightPropType: PropType
  ) => void;
  setAnimationDarkMode: (darkMode: boolean) => void;
  encodePropForUrl: (propType: PropType) => string;
}

function applyMotionVisibility(
  state: SequenceViewerVisibilityState,
  visibility: { showLeftMotion: boolean; showRightMotion: boolean }
): void {
  state.reset();
  if (!visibility.showLeftMotion) state.setLeftMotion(false);
  if (!visibility.showRightMotion) state.setRightMotion(false);
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
  const leftPropType = $derived(settings.leftPropType);
  const rightPropType = $derived(settings.rightPropType);
  const catDogModeEnabled = $derived(settings.catDogMode);
  const activeLeftProp = $derived(
    isHandPath ? PropType.HAND : (leftPropType ?? PropType.STAFF)
  );
  const activeRightProp = $derived(
    isHandPath ? PropType.HAND : (rightPropType ?? PropType.STAFF)
  );
  const activeCatDog = $derived(
    isHandPath ? false : (catDogModeEnabled ?? false)
  );

  const viewerVisibility = new SequenceViewerVisibilityState();
  applyMotionVisibility(
    viewerVisibility,
    inputs.getSequence()
      ? dependencies.getSequenceMotionVisibility(inputs.getSequence()!)
      : { showLeftMotion: true, showRightMotion: true }
  );

  $effect(() => {
    const sequence = inputs.getSequence();
    void sequence?.id;
    const visibility = sequence
      ? dependencies.getSequenceMotionVisibility(sequence)
      : { showLeftMotion: true, showRightMotion: true };
    untrack(() => {
      applyMotionVisibility(viewerVisibility, {
        showLeftMotion:
          visibility.showLeftMotion && (inputs.getInitialLeftVisible() ?? true),
        showRightMotion:
          visibility.showRightMotion && (inputs.getInitialRightVisible() ?? true),
      });
    });
  });

  $effect(() => {
    if (!inputs.getAnimationServicesReady()) return;
    try {
      dependencies.updateAnimationPropTypes(activeLeftProp, activeRightProp);
    } catch {
      // A viewer can select props before the animation service finishes
      // loading. The service reads the same settings when startup completes.
    }
  });

  function handlePropTypeChange(propType: PropType): void {
    void dependencies.updateSettings({
      leftPropType: propType,
      rightPropType: propType,
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
    get activeLeftProp() {
      return activeLeftProp;
    },
    get activeRightProp() {
      return activeRightProp;
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
