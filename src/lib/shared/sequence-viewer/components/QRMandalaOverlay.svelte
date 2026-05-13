<!--
  QRMandalaOverlay.svelte

  Manages QR code generation/caching and mandala placement computation
  for ChoreoCard. Renderless state component - exposes computed state
  via callback props. The actual rendering happens inside CardGridLayout.
  Extracted from ChoreoCard.svelte.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getQRCodeGenerator } from "$lib/shared/qr/getQRCodeGenerator";
  import { getMandalaPlacements } from "../services/getMandalaPlacements";
  import type { BrowseViewMode } from "$lib/shared/browse/domain/BrowseViewMode";
  import { encodeViewMode } from "$lib/shared/browse/domain/BrowseViewMode";

  interface MandalaPlacement {
    row: number;
    col: number;
    variant: "blue" | "red" | "full";
  }

  interface MandalaLayoutOverride {
    cols: number;
    rows: number;
    startPos: { col: number; row: number };
    qrPos: { col: number; row: number };
    stepPositions: { col: number; row: number }[];
  }

  interface Props {
    sequence: SequenceData;
    showQRCode: boolean;
    showMandala: boolean;
    includeStartPosition: boolean;
    darkMode: boolean;
    bluePropType: PropType | undefined;
    redPropType: PropType | undefined;
    showBlueMotion: boolean;
    showRedMotion: boolean;
    browseViewMode?: BrowseViewMode;
    baseColumns: number;
    baseRows: number;
    startPositionLayout: "row" | "column";
    // Callbacks to push computed state up to ChoreoCard
    onQrDataUrlChange: (url: string | null) => void;
    onMandalaResultChange: (result: {
      placements: MandalaPlacement[];
      layoutOverride: MandalaLayoutOverride | null;
    }) => void;
  }

  const {
    sequence,
    showQRCode,
    showMandala,
    includeStartPosition,
    darkMode,
    bluePropType,
    redPropType,
    showBlueMotion,
    showRedMotion,
    browseViewMode,
    baseColumns,
    baseRows,
    startPositionLayout,
    onQrDataUrlChange,
    onMandalaResultChange,
  }: Props = $props();

  // QR code state - generated async, cached by sequence ID + dark mode.
  let qrDataUrl = $state<string | null>(null);
  const qrCacheMap = new Map<string, string>();
  let lastQrKey = "";

  // Derive a stable cache key from the values that actually matter for QR content.
  const encodedViewMode = $derived(browseViewMode ? encodeViewMode(browseViewMode) : undefined);

  const qrCacheKey = $derived.by(() => {
    if (!showQRCode || !sequence) return "";
    const seqId = sequence.id ?? sequence.word ?? "unknown";
    return `${seqId}:${darkMode}${encodedViewMode ? `:${encodedViewMode}` : ""}`;
  });

  $effect(() => {
    const key = qrCacheKey;
    if (!key) {
      qrDataUrl = null;
      lastQrKey = "";
      onQrDataUrlChange(null);
      return;
    }

    // Skip if we already generated for this exact key
    if (key === lastQrKey) return;
    lastQrKey = key;

    // Check cache first
    const cached = qrCacheMap.get(key);
    if (cached) {
      qrDataUrl = cached;
      onQrDataUrlChange(cached);
      return;
    }

    const seq = sequence;
    const isDark = darkMode;
    const bProp = bluePropType ? String(bluePropType) : undefined;
    const rProp = redPropType ? String(redPropType) : undefined;
    const vm = encodedViewMode;
    const qrGenerator = getQRCodeGenerator();
    if (!qrGenerator || !seq) return;

    qrGenerator
      .generateForSequence(seq, {
        size: 200,
        margin: 1,
        style: "modern",
        darkMode: isDark,
        offline: false,
        bluePropType: bProp,
        redPropType: rProp,
        viewMode: vm,
      })
      .then((result) => {
        qrCacheMap.set(key, result.dataUrl);
        // Only update if this is still the current key (sequence didn't change mid-flight)
        if (lastQrKey === key) {
          qrDataUrl = result.dataUrl;
          onQrDataUrlChange(result.dataUrl);
        }
      })
      .catch(() => {
        // QR is optional - don't block the card
      });
  });

  // Compute mandala placements + optional 4-count horizontal layout override.
  const mandalaResult = $derived.by(() => {
    return getMandalaPlacements({
      stepCount: sequence?.steps?.length ?? 0,
      cols: baseColumns,
      rows: baseRows,
      includeStartPosition,
      showQRCode,
      blueVisible: showBlueMotion,
      redVisible: showRedMotion,
      mandalaEnabled: showMandala,
      startPositionLayout,
    });
  });

  // Push mandala result changes up to ChoreoCard
  $effect(() => {
    const result = mandalaResult;
    onMandalaResultChange(result);
  });
</script>
