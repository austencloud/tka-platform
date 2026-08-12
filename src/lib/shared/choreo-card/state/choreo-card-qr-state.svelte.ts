import type { BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";
import { encodeViewMode } from "$lib/shared/browse/domain/browse-view-mode";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { getQRCodeGenerator } from "$lib/shared/qr/get-qr-code-generator";

export interface ChoreoCardQrDeps {
  readonly sequence: SequenceData;
  readonly showQRCode: boolean;
  readonly darkMode: boolean;
  readonly isAuthenticated: boolean;
  readonly bluePropType: PropType | undefined;
  readonly redPropType: PropType | undefined;
  readonly browseViewMode: BrowseViewMode | undefined;
}

export interface ChoreoCardQrServices {
  readonly getGenerator: typeof getQRCodeGenerator;
}

/** Owns QR minting, stale-result rejection, and the per-card QR cache. */
export function createChoreoCardQrState(
  getDeps: () => ChoreoCardQrDeps,
  services: ChoreoCardQrServices
) {
  let dataUrl = $state<string | null>(null);
  let generating = $state(false);
  const cache = new Map<string, string>();
  let activeKey = "";

  const encodedViewMode = $derived.by(() => {
    const mode = getDeps().browseViewMode;
    return mode ? encodeViewMode(mode) : undefined;
  });

  const cacheKey = $derived.by(() => {
    const deps = getDeps();
    if (!deps.showQRCode) return "";
    const sequenceId = deps.sequence.id ?? deps.sequence.word ?? "unknown";
    const authTag = deps.isAuthenticated ? "a" : "g";
    const blueProp = deps.bluePropType ?? "default";
    const redProp = deps.redPropType ?? "default";
    return `${sequenceId}:${deps.darkMode}:${authTag}:${blueProp}:${redProp}${encodedViewMode ? `:${encodedViewMode}` : ""}`;
  });

  $effect(() => {
    const key = cacheKey;
    if (!key) {
      dataUrl = null;
      generating = false;
      activeKey = "";
      return;
    }

    if (key === activeKey) return;
    activeKey = key;

    const cached = cache.get(key);
    if (cached) {
      dataUrl = cached;
      generating = false;
      return;
    }

    const deps = getDeps();
    if (!deps.isAuthenticated) {
      dataUrl = null;
      generating = false;
      return;
    }

    const generator = services.getGenerator();
    if (!generator) {
      generating = false;
      return;
    }

    // Keep the previous theme's QR visible until its replacement arrives. The
    // pending state is only needed when the reserved cell has no image at all.
    generating = true;
    void generator
      .generateForSequence(deps.sequence, {
        size: 200,
        margin: 1,
        style: "modern",
        darkMode: deps.darkMode,
        bluePropType: deps.bluePropType ? String(deps.bluePropType) : undefined,
        redPropType: deps.redPropType ? String(deps.redPropType) : undefined,
        viewMode: encodedViewMode,
      })
      .then((result) => {
        cache.set(key, result.dataUrl);
        if (activeKey === key) {
          dataUrl = result.dataUrl;
          generating = false;
        }
      })
      .catch(() => {
        // QR is optional. Settling the state prevents an indefinite spinner.
        if (activeKey === key) generating = false;
      });
  });

  const pending = $derived(getDeps().showQRCode && !dataUrl && generating);

  return {
    get dataUrl() {
      return dataUrl;
    },
    get pending() {
      return pending;
    },
  } as const;
}
