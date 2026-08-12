import type { BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";
import {
  createChoreoCardQrState,
  type ChoreoCardQrDeps,
} from "$lib/shared/choreo-card/state/choreo-card-qr-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { getQRCodeGenerator } from "$lib/shared/qr/get-qr-code-generator";

interface HarnessOptions {
  sequence: SequenceData;
  bluePropType: PropType;
  redPropType: PropType;
  generateForSequence: ReturnType<
    typeof getQRCodeGenerator
  >["generateForSequence"];
}

export function createChoreoCardQrStateHarness(options: HarnessOptions) {
  let deps = $state<ChoreoCardQrDeps>({
    sequence: options.sequence,
    showQRCode: true,
    darkMode: false,
    isAuthenticated: true,
    bluePropType: options.bluePropType,
    redPropType: options.redPropType,
    browseViewMode: undefined,
  });

  const generator = {
    generateForSequence: options.generateForSequence,
  } as ReturnType<typeof getQRCodeGenerator>;

  let qrState!: ReturnType<typeof createChoreoCardQrState>;
  const dispose = $effect.root(() => {
    qrState = createChoreoCardQrState(() => deps, {
      getGenerator: () => generator,
    });
  });

  return {
    get qrState() {
      return qrState;
    },
    setProps(bluePropType: PropType, redPropType: PropType) {
      deps = { ...deps, bluePropType, redPropType };
    },
    setViewMode(browseViewMode: BrowseViewMode | undefined) {
      deps = { ...deps, browseViewMode };
    },
    dispose,
  } as const;
}
