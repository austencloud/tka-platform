<!--
  PrintPrepView.svelte - Print Preparation Tab

  Renders all cards in a loaded deck at standard poker card specifications
  (2.5" × 3.5" at 300 DPI with bleed) and exports as PDF or ZIP of PNGs.
  Sidebar provides card specs, export options, theme selection, and
  step-by-step MPC upload guidance.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { Deck, DeckFamily } from "../domain/models/Deck";
  import type { IPrintCardRenderer, PrintRenderOptions } from "../services/contracts/IPrintCardRenderer";
  import type { IPrintPDFExporter, CardPair } from "../services/contracts/IPrintPDFExporter";
  import type { IPrintZipExporter } from "../services/contracts/IPrintZipExporter";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";

  interface Props {
    deck: Deck | null;
    deckSequences: SequenceData[];
    onSwitchToDecks: () => void;
  }

  let { deck, deckSequences, onSwitchToDecks }: Props = $props();

  // ── Persisted settings ──────────────────────────────────────────────
  let includeInfoCards = $state(loadBool("printPrep.includeInfoCards", true));
  let showBleedOverlay = $state(loadBool("printPrep.showBleed", false));
  let selectedTheme = $state(loadString("printPrep.theme", "nightSky"));

  // ── Visibility settings (shared with other choreo card tabs via localStorage) ──
  let showGrid = $state(loadBool("choreoCard.showGrid", true));
  let showTKA = $state(loadBool("choreoCard.showTKA", true));
  let showWord = $state(loadBool("choreoCard.showWord", true));
  let includeStartPosition = $state(loadBool("choreoCard.includeStartPosition", true));
  let handPointsVisible = $state(loadBool("choreoCard.handPointsVisible", true));

  // Read startPositionLayout from the shared composition manager
  const imageComposition = getImageCompositionManager();

  /** Build render options from current settings */
  function buildRenderOptions(): PrintRenderOptions {
    return {
      showGrid,
      showTKA,
      showWord,
      includeStartPosition,
      startPositionLayout: imageComposition.startPositionLayout,
      handPointsVisible,
      theme: selectedTheme,
      bluePropType: settingsService.settings.bluePropType as PropType,
      redPropType: settingsService.settings.redPropType as PropType,
    };
  }

  // Track prop type for reactive re-rendering
  let lastBlueProp = $state(settingsService.settings.bluePropType);
  let lastRedProp = $state(settingsService.settings.redPropType);

  // Auto-rerender all cards in-place when prop type changes (no DOM teardown)
  $effect(() => {
    const currentBlue = settingsService.settings.bluePropType;
    const currentRed = settingsService.settings.redPropType;
    if (
      (currentBlue !== lastBlueProp || currentRed !== lastRedProp) &&
      printRenderer && renderedPairs.length > 0
    ) {
      lastBlueProp = currentBlue;
      lastRedProp = currentRed;
      rerenderAllInPlace();
    }
  });

  /** Re-render every card's images in-place without tearing down the grid */
  async function rerenderAllInPlace() {
    if (!printRenderer) return;
    const options = buildRenderOptions();

    // Mark all cards as re-rendering
    rerenderingCards = new Set(renderedPairs.map((_, i) => i));

    for (let i = 0; i < renderedPairs.length; i++) {
      const pair = renderedPairs[i]!;
      try {
        const front = await printRenderer.renderFront(pair.sequence, options);
        const back = await printRenderer.renderBack(pair.sequence, options);
        renderedPairs[i] = {
          ...pair,
          front,
          back,
          frontSrc: front.toDataURL("image/png"),
          backSrc: back.toDataURL("image/png"),
        };
      } catch (err) {
        console.error(`Failed to rerender card ${i}:`, err);
      }
      // Remove from loading set as each card completes
      const next = new Set(rerenderingCards);
      next.delete(i);
      rerenderingCards = next;
    }
  }

  // ── Render state ────────────────────────────────────────────────────
  // Store data URL strings (not canvases) so Svelte can detect changes for <img> reactivity
  let renderedPairs = $state<Array<{
    frontSrc: string;
    backSrc: string;
    front: HTMLCanvasElement;
    back: HTMLCanvasElement;
    label: string;
    familyId: string;
    sequence: SequenceData;
  }>>([]);
  let infoCardPair = $state<{ frontSrc: string; backSrc: string; front: HTMLCanvasElement; back: HTMLCanvasElement } | null>(null);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  /** Tracks which card indices are currently re-rendering (for loading overlays) */
  let rerenderingCards = $state(new Set<number>());

  // ── Export state ────────────────────────────────────────────────────
  let isExporting = $state(false);
  let exportProgress = $state(0);
  let exportTotal = $state(0);
  let exportFormat = $state<"pdf" | "zip">("zip");

  // ── Context menu ───────────────────────────────────────────────────
  let contextMenuState: ContextMenuState = $state({ open: false });
  let contextMenuTarget: { index: number } | null = $state(null);

  function openContextMenu(e: MouseEvent, pairIndex: number) {
    e.preventDefault();
    contextMenuTarget = { index: pairIndex };
    contextMenuState = { open: true, x: e.clientX, y: e.clientY };
  }

  function closeContextMenu() {
    contextMenuState = { open: false };
    contextMenuTarget = null;
  }

  const contextMenuItems: ContextMenuEntry[] = $derived([
    {
      id: "rerender",
      label: "Rerender",
      icon: "fas fa-sync-alt",
      action: () => {
        if (contextMenuTarget !== null) rerenderCard(contextMenuTarget.index);
        closeContextMenu();
      },
    },
    {
      id: "rerender-all",
      label: "Rerender all",
      icon: "fas fa-redo",
      action: () => {
        rerenderAllInPlace();
        closeContextMenu();
      },
    },
  ]);

  async function rerenderCard(index: number) {
    if (!printRenderer) return;
    const pair = renderedPairs[index];
    if (!pair) return;

    rerenderingCards = new Set([...rerenderingCards, index]);
    const options = buildRenderOptions();

    try {
      const front = await printRenderer.renderFront(pair.sequence, options);
      const back = await printRenderer.renderBack(pair.sequence, options);
      renderedPairs[index] = {
        ...pair,
        front,
        back,
        frontSrc: front.toDataURL("image/png"),
        backSrc: back.toDataURL("image/png"),
      };
    } catch (err) {
      console.error(`Failed to rerender card ${index}:`, err);
    }

    const next = new Set(rerenderingCards);
    next.delete(index);
    rerenderingCards = next;
  }

  // ── Services ────────────────────────────────────────────────────────
  let printRenderer: IPrintCardRenderer | null = $state(null);
  let pdfExporter: IPrintPDFExporter | null = $state(null);
  let zipExporter: IPrintZipExporter | null = $state(null);

  // ── Theme options ───────────────────────────────────────────────────
  const THEME_OPTIONS = [
    { id: "nightSky", label: "Night Sky", color: "#4338ca" },
    { id: "deepOcean", label: "Deep Ocean", color: "#0891b2" },
    { id: "snowfall", label: "Snowfall", color: "#3b82f6" },
    { id: "emberGlow", label: "Ember Glow", color: "#ea580c" },
    { id: "sakuraDrift", label: "Sakura", color: "#db2777" },
    { id: "fireflyForest", label: "Firefly Forest", color: "#22c55e" },
    { id: "autumnDrift", label: "Autumn Drift", color: "#d97706" },
    { id: "pride", label: "Pride", color: "#f43f5e" },
  ] as const;

  // ── Derived state ───────────────────────────────────────────────────
  const pairsByFamily = $derived.by(() => {
    if (!deck) return [];
    const groups: Array<{ family: DeckFamily; pairs: typeof renderedPairs }> = [];
    for (const family of deck.families) {
      const familyPairs = renderedPairs.filter((p) => p.familyId === family.id);
      if (familyPairs.length > 0) {
        groups.push({ family, pairs: familyPairs });
      }
    }
    return groups;
  });

  const totalCards = $derived(
    renderedPairs.length + (includeInfoCards && infoCardPair ? 1 : 0)
  );

  // ── Persistence helpers ─────────────────────────────────────────────
  function loadBool(key: string, defaultVal: boolean): boolean {
    if (typeof window === "undefined") return defaultVal;
    const stored = localStorage.getItem(key);
    return stored === null ? defaultVal : stored === "true";
  }

  function loadString(key: string, defaultVal: string): string {
    if (typeof window === "undefined") return defaultVal;
    return localStorage.getItem(key) ?? defaultVal;
  }

  function persistBool(key: string, value: boolean) {
    if (typeof window !== "undefined") localStorage.setItem(key, String(value));
  }

  function persistString(key: string, value: string) {
    if (typeof window !== "undefined") localStorage.setItem(key, value);
  }

  // ── Setting handlers ────────────────────────────────────────────────
  function toggleInfoCards() {
    includeInfoCards = !includeInfoCards;
    persistBool("printPrep.includeInfoCards", includeInfoCards);
  }

  function toggleBleedOverlay() {
    showBleedOverlay = !showBleedOverlay;
    persistBool("printPrep.showBleed", showBleedOverlay);
  }

  function handleThemeChange(themeId: string) {
    selectedTheme = themeId;
    persistString("printPrep.theme", themeId);
    // Re-render with new theme (in-place, no DOM teardown)
    if (renderedPairs.length > 0 && printRenderer) {
      rerenderAllInPlace();
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────
  onMount(() => {
    printRenderer = container.items.printCardRenderer as IPrintCardRenderer;
    pdfExporter = container.items.printPDFExporter as IPrintPDFExporter;
    zipExporter = container.items.printZipExporter as IPrintZipExporter;
  });

  // Re-render when deck changes (not when settings change)
  let lastDeckId: string | null = null;
  let lastSeqCount = 0;
  $effect(() => {
    const deckId = deck?.id ?? null;
    const seqCount = deckSequences.length;
    // Only trigger on actual deck/sequence changes, not settings
    if (deckId !== lastDeckId || seqCount !== lastSeqCount) {
      lastDeckId = deckId;
      lastSeqCount = seqCount;
      if (deck && seqCount > 0 && printRenderer) {
        renderAllCards();
      }
    }
  });

  // ── Rendering ───────────────────────────────────────────────────────
  async function renderAllCards() {
    if (!printRenderer || !deck) return;

    isRendering = true;
    renderedPairs = [];
    renderProgress = 0;

    // Build ordered list of sequences matching deck family order
    const orderedSequences: Array<{ seq: SequenceData; familyId: string }> = [];
    for (const family of deck.families) {
      for (const seqId of family.sequenceIds) {
        const seq = deckSequences.find((s) => s.id === seqId);
        if (seq) orderedSequences.push({ seq, familyId: family.id });
      }
    }

    renderTotal = orderedSequences.length;

    const options = buildRenderOptions();

    // Render info cards
    try {
      const infoFront = await printRenderer.renderInfoCardFront(selectedTheme);
      const infoBack = await printRenderer.renderInfoCardBack(selectedTheme);
      infoCardPair = {
        front: infoFront,
        back: infoBack,
        frontSrc: infoFront.toDataURL("image/png"),
        backSrc: infoBack.toDataURL("image/png"),
      };
    } catch (err) {
      console.error("Failed to render info cards:", err);
    }

    // Render sequence cards progressively
    for (let i = 0; i < orderedSequences.length; i++) {
      const { seq, familyId } = orderedSequences[i]!;
      try {
        const front = await printRenderer.renderFront(seq, options);
        const back = await printRenderer.renderBack(seq, options);
        renderedPairs = [
          ...renderedPairs,
          {
            front,
            back,
            frontSrc: front.toDataURL("image/png"),
            backSrc: back.toDataURL("image/png"),
            label: simplifyRepeatedWord(seq.word ?? seq.name ?? `Card ${i + 1}`),
            familyId,
            sequence: seq,
          },
        ];
      } catch (err) {
        console.error(`Failed to render card ${i}:`, err);
      }
      renderProgress = i + 1;
    }

    isRendering = false;
  }

  // ── Export: PDF ──────────────────────────────────────────────────────
  async function exportPDF() {
    if (!pdfExporter || !deck) return;

    isExporting = true;
    exportProgress = 0;

    const pairs: CardPair[] = buildExportPairs();
    exportTotal = pairs.length;

    try {
      const blob = await pdfExporter.exportHomePrintPDF(pairs, deck.name, (current, total) => {
        exportProgress = current;
        exportTotal = total;
      });
      triggerDownload(blob, `${sanitizeName(deck.name)}_home_print.pdf`);
    } catch (err) {
      console.error("Failed to export PDF:", err);
    }

    isExporting = false;
  }

  // ── Export: ZIP ─────────────────────────────────────────────────────
  async function exportZIP() {
    if (!zipExporter || !deck) return;

    isExporting = true;
    exportProgress = 0;

    const pairs = buildExportPairs();
    exportTotal = pairs.length;

    try {
      const blob = await zipExporter.exportDeckZIP(pairs, deck.name, (current, total) => {
        exportProgress = current;
        exportTotal = total;
      });
      triggerDownload(blob, `${sanitizeName(deck.name)}_cards.zip`);
    } catch (err) {
      console.error("Failed to export ZIP:", err);
    }

    isExporting = false;
  }

  function handleExport() {
    if (exportFormat === "pdf") exportPDF();
    else exportZIP();
  }

  // ── Individual card download ────────────────────────────────────────
  function downloadCard(canvas: HTMLCanvasElement, filename: string) {
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, filename);
    }, "image/png");
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  function buildExportPairs(): CardPair[] {
    const pairs: CardPair[] = [];
    if (includeInfoCards && infoCardPair) {
      pairs.push({
        front: infoCardPair.front,
        back: infoCardPair.back,
        label: "How_to_Read_a_Choreo_Card",
      });
    }
    for (const pair of renderedPairs) {
      pairs.push({ front: pair.front, back: pair.back, label: pair.label });
    }
    return pairs;
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");
  }
</script>

<div class="print-prep">
  {#if !deck}
    <!-- Empty state: no deck selected -->
    <div class="empty-state">
      <div class="empty-icon">
        <i class="fas fa-print" aria-hidden="true"></i>
      </div>
      <h2 class="empty-title">Print Prep</h2>
      <p class="empty-description">
        Select a deck in the Decks tab first. Each deck becomes a print-ready
        set of standard poker-size playing cards (2.5" x 3.5").
      </p>
      <button class="go-to-decks" onclick={onSwitchToDecks}>
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        Go to Decks
      </button>
    </div>
  {:else}
    <div class="prep-layout">
      <!-- ─── Sidebar ──────────────────────────────────────────── -->
      <aside class="prep-sidebar themed-scrollbar">
        <!-- Card Specs -->
        <section class="sidebar-section">
          <h3 class="section-heading">Card Specs</h3>
          <div class="spec-grid">
            <div class="spec-item">
              <span class="spec-label">Size</span>
              <span class="spec-value">2.5" x 3.5"</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Resolution</span>
              <span class="spec-value">300 DPI</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Bleed</span>
              <span class="spec-value">36px (0.12")</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Pixels</span>
              <span class="spec-value">822 x 1122</span>
            </div>
          </div>
          <p class="spec-note">Standard poker card. Compatible with MakePlayingCards, DriveThruCards, and most print services.</p>
        </section>

        <div class="sidebar-divider"></div>

        <!-- Export -->
        <section class="sidebar-section">
          <h3 class="section-heading">Export</h3>
          <div class="export-format-picker">
            <button
              class="format-option"
              class:active={exportFormat === "zip"}
              onclick={() => (exportFormat = "zip")}
            >
              <i class="fas fa-file-zipper" aria-hidden="true"></i>
              <span class="format-label">ZIP (PNGs)</span>
              <span class="format-desc">For print services</span>
            </button>
            <button
              class="format-option"
              class:active={exportFormat === "pdf"}
              onclick={() => (exportFormat = "pdf")}
            >
              <i class="fas fa-file-pdf" aria-hidden="true"></i>
              <span class="format-label">PDF</span>
              <span class="format-desc">For home printing</span>
            </button>
          </div>
          <button
            class="export-btn"
            onclick={handleExport}
            disabled={isRendering || isExporting || renderedPairs.length === 0}
          >
            {#if isExporting}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Exporting {exportProgress}/{exportTotal}...
            {:else}
              <i class="fas fa-download" aria-hidden="true"></i>
              Export {totalCards} card{totalCards !== 1 ? "s" : ""}
            {/if}
          </button>
        </section>

        <div class="sidebar-divider"></div>

        <!-- Settings -->
        <section class="sidebar-section">
          <h3 class="section-heading">Settings</h3>
          <button
            class="toggle-chip"
            class:active={includeInfoCards}
            onclick={toggleInfoCards}
            aria-pressed={includeInfoCards}
          >
            <i class="fas fa-book-open" aria-hidden="true"></i>
            Rules card
          </button>
          <button
            class="toggle-chip"
            class:active={showBleedOverlay}
            onclick={toggleBleedOverlay}
            aria-pressed={showBleedOverlay}
          >
            <i class="fas fa-crop-alt" aria-hidden="true"></i>
            Bleed zone
          </button>
        </section>

        <div class="sidebar-divider"></div>

        <!-- Theme -->
        <section class="sidebar-section">
          <h3 class="section-heading">Card Back Theme</h3>
          <div class="theme-grid">
            {#each THEME_OPTIONS as theme}
              <button
                class="theme-swatch"
                class:active={selectedTheme === theme.id}
                style="--swatch-color: {theme.color}"
                onclick={() => handleThemeChange(theme.id)}
                title={theme.label}
                aria-label="Select {theme.label} theme"
              >
                <span class="swatch-dot"></span>
                <span class="swatch-label">{theme.label}</span>
              </button>
            {/each}
          </div>
        </section>

        <div class="sidebar-divider"></div>

        <!-- MPC Guide -->
        <section class="sidebar-section">
          <h3 class="section-heading">Print Service Guide</h3>
          <ol class="mpc-steps">
            <li>
              <strong>Export as ZIP</strong> to get individual front/back PNGs in separate folders.
            </li>
            <li>
              <strong>Upload fronts</strong> to your print service's "card fronts" upload area.
            </li>
            <li>
              <strong>Upload backs</strong> to the "card backs" area. Files are numbered to match.
            </li>
            <li>
              <strong>Order</strong> as "Poker Size" (2.5" x 3.5") with your preferred card stock.
            </li>
          </ol>
        </section>
      </aside>

      <!-- ─── Content ──────────────────────────────────────────── -->
      <div class="prep-content">
        <!-- Header -->
        <div class="prep-header">
          <div class="header-info">
            <h2 class="deck-name">{deck.name}</h2>
            <span class="card-count">
              {#if isRendering}
                Rendering {renderProgress}/{renderTotal}...
              {:else}
                {totalCards} card{totalCards !== 1 ? "s" : ""} ready
              {/if}
            </span>
          </div>
        </div>

        <!-- Progress bar during rendering -->
        {#if isRendering}
          <div class="progress-bar" role="progressbar" aria-valuenow={renderProgress} aria-valuemax={renderTotal}>
            <div
              class="progress-fill"
              style="width: {renderTotal > 0 ? (renderProgress / renderTotal) * 100 : 0}%"
            ></div>
          </div>
        {/if}

        <!-- Card preview grid -->
        <div class="prep-body themed-scrollbar">
          <!-- Info card pair -->
          {#if includeInfoCards && infoCardPair}
            <div class="family-section">
              <h3 class="family-label">Rules Card</h3>
              <div class="pair-grid">
                <div class="card-pair">
                  <div class="card-preview" class:show-bleed={showBleedOverlay}>
                    <img
                      class="preview-img"
                      src={infoCardPair.frontSrc}
                      alt="Rules card front"
                    />
                    {#if showBleedOverlay}<div class="bleed-overlay" aria-hidden="true"></div>{/if}
                    <span class="face-label">Front</span>
                    <button
                      class="download-overlay"
                      onclick={() => downloadCard(infoCardPair!.front, "rules_card_front.png")}
                      title="Download front PNG"
                      aria-label="Download rules card front"
                    >
                      <i class="fas fa-download" aria-hidden="true"></i>
                    </button>
                  </div>
                  <div class="card-preview" class:show-bleed={showBleedOverlay}>
                    <img
                      class="preview-img"
                      src={infoCardPair.backSrc}
                      alt="Rules card back"
                    />
                    {#if showBleedOverlay}<div class="bleed-overlay" aria-hidden="true"></div>{/if}
                    <span class="face-label">Back</span>
                    <button
                      class="download-overlay"
                      onclick={() => downloadCard(infoCardPair!.back, "rules_card_back.png")}
                      title="Download back PNG"
                      aria-label="Download rules card back"
                    >
                      <i class="fas fa-download" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- Sequence card pairs by family -->
          {#each pairsByFamily as group}
            <div class="family-section">
              <h3 class="family-label">{group.family.label}</h3>
              <div class="pair-grid">
                {#each group.pairs as pair, pairIdx}
                  {@const globalIdx = renderedPairs.indexOf(pair)}
                  {@const isRerendering = rerenderingCards.has(globalIdx)}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="card-pair"
                    class:rerendering={isRerendering}
                    oncontextmenu={(e) => openContextMenu(e, globalIdx)}
                  >
                    {#if isRerendering}
                      <div class="rerender-overlay" aria-label="Rendering {pair.label}">
                        <ProgressRing percent={-1} size={28} strokeWidth={2} />
                        <span class="rerender-status">Rendering</span>
                      </div>
                    {/if}
                    <div class="card-preview" class:show-bleed={showBleedOverlay}>
                      <img
                        class="preview-img"
                        class:dimmed={isRerendering}
                        src={pair.frontSrc}
                        alt="{pair.label} front"
                        loading="lazy"
                      />
                      {#if showBleedOverlay}<div class="bleed-overlay" aria-hidden="true"></div>{/if}
                      <span class="face-label">Front</span>
                      <button
                        class="download-overlay"
                        onclick={() => downloadCard(pair.front, `${sanitizeName(pair.label)}_front.png`)}
                        title="Download front PNG"
                        aria-label="Download {pair.label} front"
                      >
                        <i class="fas fa-download" aria-hidden="true"></i>
                      </button>
                    </div>
                    <div class="card-preview" class:show-bleed={showBleedOverlay}>
                      <img
                        class="preview-img"
                        class:dimmed={isRerendering}
                        src={pair.backSrc}
                        alt="{pair.label} back"
                        loading="lazy"
                      />
                      {#if showBleedOverlay}<div class="bleed-overlay" aria-hidden="true"></div>{/if}
                      <span class="face-label">Back</span>
                      <button
                        class="download-overlay"
                        onclick={() => downloadCard(pair.back, `${sanitizeName(pair.label)}_back.png`)}
                        title="Download back PNG"
                        aria-label="Download {pair.label} back"
                      >
                        <i class="fas fa-download" aria-hidden="true"></i>
                      </button>
                    </div>
                    <span class="pair-label">{pair.label}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/each}

          {#if !isRendering && renderedPairs.length === 0 && deckSequences.length > 0}
            <div class="render-empty">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              <p>Preparing cards...</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<ContextMenu menuState={contextMenuState} items={contextMenuItems} onClose={closeContextMenu} />

<style>
  .print-prep {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* ── Empty state ─────────────────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    padding: 32px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    margin-bottom: 8px;
  }

  .empty-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .empty-description {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    max-width: 380px;
    line-height: 1.5;
  }

  .go-to-decks {
    margin-top: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    background: var(--theme-accent, #6366f1);
    color: #ffffff;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }

  .go-to-decks:hover {
    filter: brightness(1.1);
  }

  .go-to-decks:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ── Layout ──────────────────────────────────────────────────────── */
  .prep-layout {
    display: flex;
    height: 100%;
    min-height: 0;
    gap: 0;
  }

  /* ── Sidebar ─────────────────────────────────────────────────────── */
  .prep-sidebar {
    width: 260px;
    flex-shrink: 0;
    overflow-y: auto;
    padding: 16px;
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .sidebar-section {
    padding: 12px 0;
  }

  .sidebar-section:first-child {
    padding-top: 0;
  }

  .sidebar-divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .section-heading {
    margin: 0 0 10px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── Spec grid ───────────────────────────────────────────────────── */
  .spec-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .spec-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .spec-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .spec-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    font-variant-numeric: tabular-nums;
  }

  .spec-note {
    margin: 10px 0 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    line-height: 1.4;
  }

  /* ── Export format picker ────────────────────────────────────────── */
  .export-format-picker {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }

  .format-option {
    flex: 1;
    padding: 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
    min-height: 44px;
  }

  .format-option i {
    font-size: 16px;
  }

  .format-option.active {
    border-color: #059669;
    background: rgba(5, 150, 105, 0.1);
    color: #34d399;
  }

  .format-option:hover:not(.active) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .format-option:focus-visible {
    outline: 2px solid #059669;
    outline-offset: 2px;
  }

  .format-label {
    font-weight: 600;
    font-size: var(--font-size-compact, 12px);
  }

  .format-desc {
    font-size: 10px;
    opacity: 0.7;
  }

  .export-btn {
    width: 100%;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: #059669;
    color: #ffffff;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
  }

  .export-btn:hover:not(:disabled) {
    background: #047857;
  }

  .export-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .export-btn:focus-visible {
    outline: 2px solid #059669;
    outline-offset: 2px;
  }

  /* ── Toggle chips ────────────────────────────────────────────────── */
  .toggle-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    min-height: 36px;
    text-align: left;
  }

  .toggle-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .toggle-chip.active {
    background: rgba(5, 150, 105, 0.15);
    border-color: rgba(5, 150, 105, 0.4);
    color: #34d399;
  }

  .toggle-chip:focus-visible {
    outline: 2px solid #059669;
    outline-offset: 2px;
  }

  /* ── Theme grid ──────────────────────────────────────────────────── */
  .theme-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .theme-swatch {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 11px;
    min-height: 32px;
  }

  .theme-swatch.active {
    border-color: var(--swatch-color);
    background: color-mix(in srgb, var(--swatch-color) 12%, transparent);
    color: var(--theme-text, #ffffff);
  }

  .theme-swatch:hover:not(.active) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .theme-swatch:focus-visible {
    outline: 2px solid var(--swatch-color);
    outline-offset: 2px;
  }

  .swatch-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--swatch-color);
    flex-shrink: 0;
  }

  .swatch-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── MPC Steps ───────────────────────────────────────────────────── */
  .mpc-steps {
    margin: 0;
    padding: 0 0 0 20px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    line-height: 1.5;
  }

  .mpc-steps li {
    margin-bottom: 8px;
  }

  .mpc-steps li:last-child {
    margin-bottom: 0;
  }

  .mpc-steps strong {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
  }

  /* ── Content area ────────────────────────────────────────────────── */
  .prep-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .prep-header {
    flex-shrink: 0;
    padding: 12px 20px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-info {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .deck-name {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .card-count {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* ── Progress bar ────────────────────────────────────────────────── */
  .progress-bar {
    position: relative;
    height: 3px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    flex-shrink: 0;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #059669, #34d399);
    transition: width 0.15s ease-out;
  }

  /* ── Card preview grid ───────────────────────────────────────────── */
  .prep-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .family-section {
    margin-bottom: 24px;
  }

  .family-section:last-child {
    margin-bottom: 0;
  }

  .family-label {
    margin: 0 0 10px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pair-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .card-pair {
    display: flex;
    gap: 8px;
    align-items: start;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    padding: 8px;
    position: relative;
  }

  /* ── Rerender loading overlay ────────────────────────────────────── */
  .rerender-overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    pointer-events: none;
  }

  .rerender-status {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
  }

  .preview-img.dimmed {
    opacity: 0.3;
  }

  .card-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    position: relative;
  }

  .preview-img {
    width: 100%;
    aspect-ratio: 822 / 1122;
    object-fit: contain;
    border-radius: 4px;
    background: #0a0e1a;
  }

  .face-label {
    font-size: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .pair-label {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    white-space: nowrap;
  }

  /* ── Bleed overlay ───────────────────────────────────────────────── */
  .bleed-overlay {
    position: absolute;
    /* 36px bleed on 822x1122 canvas = ~4.38% horizontal, ~3.21% vertical */
    top: 3.21%;
    left: 4.38%;
    right: 4.38%;
    bottom: calc(3.21% + 18px); /* account for face-label space */
    border: 1.5px dashed rgba(255, 80, 80, 0.6);
    border-radius: 2px;
    pointer-events: none;
  }

  /* ── Individual download overlay ─────────────────────────────────── */
  .download-overlay {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.6);
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .card-preview:hover .download-overlay {
    opacity: 1;
  }

  .download-overlay:hover {
    background: rgba(0, 0, 0, 0.8);
    color: #ffffff;
  }

  .download-overlay:focus-visible {
    opacity: 1;
    outline: 2px solid #059669;
    outline-offset: 2px;
  }

  /* ── Render empty state ──────────────────────────────────────────── */
  .render-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-min, 14px);
  }

  .render-empty i {
    font-size: 24px;
  }

  .render-empty p {
    margin: 0;
  }

  /* ── Responsive ──────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .prep-layout {
      flex-direction: column;
    }

    .prep-sidebar {
      width: 100%;
      max-height: 200px;
      border-right: none;
      border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
      flex-direction: row;
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: hidden;
      gap: 16px;
      padding: 12px 16px;
    }

    .sidebar-section {
      flex-shrink: 0;
      min-width: 200px;
      padding: 0;
    }

    .sidebar-divider {
      width: 1px;
      height: auto;
      min-height: 40px;
    }

    .pair-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 600px) {
    .prep-sidebar {
      max-height: 160px;
    }

    .sidebar-section {
      min-width: 180px;
    }

    .prep-body {
      padding: 12px;
    }

    .prep-header {
      padding: 10px 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill {
      transition: none;
    }

    .download-overlay {
      transition: none;
    }
  }
</style>
