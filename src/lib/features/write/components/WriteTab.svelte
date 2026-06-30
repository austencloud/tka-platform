<!-- Write Tab - Act creation and editing with pixel-perfect desktop replica -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { getMusicPlayer } from "../get-music-player";
  import { onMount } from "svelte";
  import ActBrowser from "./ActBrowser.svelte";
  import ActSheet from "./ActSheet.svelte";
  import MusicPlayer from "./MusicPlayer.svelte";
  import WriteToolbar from "./WriteToolbar.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import ChoreoSheetView from "./sheet/ChoreoSheetView.svelte";

  import {
    createDefaultMusicPlayerState,
    createEmptyAct,
    type ActData,
    type ActThumbnailInfo,
    type MusicPlayerState,
  } from "../domain/types/write";

  // State management using runes

  let currentAct = $state<ActData | null>(null);
  let availableActs = $state<ActThumbnailInfo[]>([]);
  let isLoading = $state<boolean>(false);
  let hasUnsavedChanges = $state<boolean>(false);
  let musicPlayerState = $state<MusicPlayerState>(
    createDefaultMusicPlayerState()
  );

  // Act (performance playlist) vs Sheet (printable choreo roster) mode.
  let writeMode = $state<"act" | "sheet">("act");
  let sheetSeed = $state<ActData | null>(null);
  const modeOptions: { value: "act" | "sheet"; label: string }[] = [
    { value: "act", label: "Act" },
    { value: "sheet", label: "Sheet" },
  ];

  // Hand the current Act's roster to the sheet builder, then switch to Sheet mode.
  function handleSendToSheet() {
    if (!currentAct) return;
    sheetSeed = currentAct;
    writeMode = "sheet";
  }

  // Services
  let hapticService: HapticFeedback;

  onMount(() => {
    hapticService = getHapticFeedback();

    // Surface playback/loading failures from the audio engine into the player
    // state so the UI shows them instead of only logging to the console.
    const player = getMusicPlayer();
    player.onError((message) => {
      musicPlayerState.error = message;
      musicPlayerState.isPlaying = false;
    });

    return () => player.onError(null);
  });

  // Layout state
  let browserWidth = $state(300); // Default browser width
  let isDragging = $state(false);

  // Initialize with sample data
  $effect(() => {
    // TODO: Load actual acts from storage/API
    availableActs = [
      {
        id: "1",
        name: "Sample Act 1",
        description: "A sample act for demonstration",
        filePath: "/acts/sample1.json",
        sequenceCount: 3,
        hasMusic: true,
        updatedAt: new Date(Date.now() - 86400000), // 1 day ago
      },
      {
        id: "2",
        name: "Sample Act 2",
        description: "Another sample act",
        filePath: "/acts/sample2.json",
        sequenceCount: 1,
        hasMusic: false,
        updatedAt: new Date(Date.now() - 172800000), // 2 days ago
      },
    ];
  });

  // Toolbar handlers
  function handleNewActRequested() {
    currentAct = createEmptyAct();
    hasUnsavedChanges = true;
  }

  function handleSaveRequested() {
    if (!currentAct) return;
    // TODO: Implement actual save logic
    hasUnsavedChanges = false;
  }

  function handleSaveAsRequested() {
    if (!currentAct) return;
    // TODO: Implement save as dialog
  }

  // Act browser handlers
  function handleActSelected(filePath: string) {
    // TODO: Load actual act from file
    const actInfo = availableActs.find((act) => act.filePath === filePath);
    if (actInfo) {
      currentAct = {
        id: actInfo.id,
        name: actInfo.name,
        description: actInfo.description,
        sequences: [], // TODO: Load actual sequences
        duration: 0,
        createdAt: actInfo.createdAt || new Date(),
        updatedAt: actInfo.updatedAt || new Date(),
      };
      hasUnsavedChanges = false;
    }
  }

  function handleActBrowserRefresh() {
    isLoading = true;
    // TODO: Refresh acts from storage
    setTimeout(() => {
      isLoading = false;
    }, 1000);
  }

  // Act sheet handlers
  function handleActInfoChanged(name: string, description: string) {
    if (!currentAct) return;
    currentAct.name = name;
    currentAct.description = description;
    hasUnsavedChanges = true;
  }

  function handleMusicLoadRequested() {
    // TODO: Implement music file selection
  }

  function handleSequenceClicked(position: number) {
    // TODO: Open sequence in construct tab
  }

  function handleSequenceRemoveRequested(position: number) {
    if (!currentAct) return;
    currentAct.sequences.splice(position, 1);
    hasUnsavedChanges = true;
  }

  // Music player handlers
  function handlePlayRequested() {
    musicPlayerState.error = null;
    musicPlayerState.isPlaying = true;
  }

  function handlePauseRequested() {
    musicPlayerState.isPlaying = false;
  }

  function handleStopRequested() {
    musicPlayerState.isPlaying = false;
    musicPlayerState.currentTime = 0;
  }

  function handleSeekRequested(position: number) {
    musicPlayerState.currentTime = position;
  }

  // Splitter handlers
  function handleSplitterMouseDown(event: MouseEvent) {
    // Trigger selection haptic feedback for splitter drag start
    hapticService?.trigger("selection");

    isDragging = true;
    event.preventDefault();

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      browserWidth = newWidth;
    };

    const handleMouseUp = () => {
      // Trigger navigation haptic feedback for splitter drag end
      hapticService?.trigger("selection");

      isDragging = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  // Keyboard support for splitter
  function handleSplitterKeyDown(event: KeyboardEvent) {
    const step = 10;
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        // Trigger selection haptic feedback for keyboard resize
        hapticService?.trigger("selection");
        browserWidth = Math.max(200, browserWidth - step);
        break;
      case "ArrowRight":
        event.preventDefault();
        // Trigger selection haptic feedback for keyboard resize
        hapticService?.trigger("selection");
        browserWidth = Math.min(500, browserWidth + step);
        break;
    }
  }
</script>

<div class="write-tab">
  <!-- Toolbar -->
  <div class="toolbar-section">
    <div class="mode-switch">
      <SegmentedControl
        options={modeOptions}
        value={writeMode}
        onchange={(v) => (writeMode = v)}
        color="accent"
        size="sm"
      />
    </div>
    {#if writeMode === "act"}
      <WriteToolbar
        {hasUnsavedChanges}
        disabled={isLoading}
        onNewActRequested={handleNewActRequested}
        onSaveRequested={handleSaveRequested}
        onSaveAsRequested={handleSaveAsRequested}
      />
      <button
        type="button"
        class="send-to-sheet"
        onclick={handleSendToSheet}
        disabled={!currentAct || currentAct.sequences.length === 0}
      >
        <i class="fa-solid fa-table-cells" aria-hidden="true"></i>
        Send to Sheet
      </button>
    {/if}
  </div>

  {#if writeMode === "act"}
  <!-- Main content area with horizontal layout -->
  <div class="main-content">
    <!-- Act Browser -->
    <div class="browser-section" style="width: {browserWidth}px;">
      <ActBrowser
        acts={availableActs}
        selectedActId={currentAct?.id}
        {isLoading}
        onActSelected={handleActSelected}
        onRefresh={handleActBrowserRefresh}
      />
    </div>

    <!-- Splitter -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="splitter"
      class:dragging={isDragging}
      onmousedown={handleSplitterMouseDown}
      onkeydown={handleSplitterKeyDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      aria-valuenow={browserWidth}
      aria-valuemin={200}
      aria-valuemax={500}
      tabindex="0"
    ></div>

    <!-- Right panel with act sheet and music player -->
    <div class="right-panel">
      <!-- Act Sheet -->
      <div class="sheet-section">
        <ActSheet
          act={currentAct}
          disabled={isLoading}
          onActInfoChanged={handleActInfoChanged}
          onMusicLoadRequested={handleMusicLoadRequested}
          onSequenceClicked={handleSequenceClicked}
          onSequenceRemoveRequested={handleSequenceRemoveRequested}
        />
      </div>

      <!-- Music Player -->
      <div class="player-section">
        <MusicPlayer
          playerState={musicPlayerState}
          disabled={isLoading}
          onPlayRequested={handlePlayRequested}
          onPauseRequested={handlePauseRequested}
          onStopRequested={handleStopRequested}
          onSeekRequested={handleSeekRequested}
        />
      </div>
    </div>
  </div>
  {:else}
    <div class="sheet-mode-content">
      <ChoreoSheetView seedAct={sheetSeed ?? undefined} />
    </div>
  {/if}
</div>

<style>
  .write-tab {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: transparent;
    overflow: hidden;
  }

  .toolbar-section {
    flex-shrink: 0;
    padding: var(--spacing-sm);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .mode-switch {
    width: 180px;
    flex-shrink: 0;
  }

  .send-to-sheet {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0 var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    cursor: pointer;
  }

  .send-to-sheet:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .sheet-mode-content {
    flex: 1;
    min-height: 0;
    padding: 0 var(--spacing-sm) var(--spacing-sm);
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    display: flex;
    min-height: 0;
    gap: 0;
    padding: 0 var(--spacing-sm) var(--spacing-sm) var(--spacing-sm);
  }

  .browser-section {
    flex-shrink: 0;
    min-width: 200px;
    max-width: 500px;
  }

  .splitter {
    width: 12px;
    background: transparent;
    cursor: col-resize;
    transition: background-color var(--duration-normal) ease;
    flex-shrink: 0;
    position: relative;
  }

  .splitter::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 4px;
    transform: translateX(-50%);
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    transition: background-color var(--duration-normal) ease;
  }

  .splitter:hover::before,
  .splitter.dragging::before {
    background: var(--theme-accent, #6366f1);
  }

  .splitter:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .splitter:focus-visible::before {
    background: var(--theme-accent, #6366f1);
  }

  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    min-width: 0;
  }

  .sheet-section {
    flex: 1;
    min-height: 0;
  }

  .player-section {
    flex-shrink: 0;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .main-content {
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .browser-section {
      width: 100% !important;
      max-height: 200px;
      overflow-y: auto;
    }

    .splitter {
      display: none;
    }

    .right-panel {
      gap: var(--spacing-xs);
    }
  }

  @media (max-width: 480px) {
    .toolbar-section {
      padding: var(--spacing-xs);
    }

    .main-content {
      padding: 0 var(--spacing-xs) var(--spacing-xs) var(--spacing-xs);
    }

    .browser-section {
      max-height: 152px;
    }
  }

  /* Prevent text selection during drag */
  .splitter.dragging {
    user-select: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .splitter,
    .splitter::before {
      transition: none;
    }
  }
</style>
