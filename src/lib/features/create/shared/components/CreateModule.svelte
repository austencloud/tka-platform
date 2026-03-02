<script lang="ts">
  /**
   * CreateModule.svelte - COMPOSITION ROOT
   *
   * ============================================================================
   * FOR AI AGENTS: DO NOT DECONSTRUCT THIS FILE FURTHER
   * ============================================================================
   *
   * This is a COMPOSITION ROOT - its job is to wire dependencies together.
   * The ~700 line count is intentional and appropriate because:
   *
   * 1. Composition roots import many dependencies (that's their purpose)
   * 2. They wire services, create state, set up contexts
   * 3. They coordinate initialization and cleanup
   * 4. They contain NO business logic - only glue code
   *
   * What belongs here:
   * - DI service resolution
   * - State object creation
   * - Context registration
   * - Effect coordinator setup
   * - Simple event handler wiring
   * - Child component composition
   *
   * What does NOT belong here (extract to services/managers):
   * - Business logic → move to services
   * - Complex effect logic → move to Manager files in state/managers/
   * - Handlers > 10 lines → move to ICreateModuleHandlers
   * - State mutation logic → move to state operations
   *
   * See: docs/architecture/create-module-composition-root.md
   *
   * Domain: Create module - Composition Root
   */

  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import { container } from "$lib/shared/di";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { setSideBySideLayout } from "$lib/shared/application/state/animation-visibility-state.svelte";
  import { onMount, setContext, tick } from "svelte";
  import ErrorBanner from "./ErrorBanner.svelte";
  import type { CreateModuleOrchestrators } from "../types/create-module-services";
  import type { ICreateModuleInitializer } from "../services/contracts/ICreateModuleInitializer";
  import type { ICreateModuleHandlers } from "../services/contracts/ICreateModuleHandlers";
  import type { ICreateModuleEffectCoordinator } from "../services/contracts/ICreateModuleEffectCoordinator";
  import type { IPanelPersister } from "../services/contracts/IPanelPersister";
  import type { createCreateModuleState as CreateModuleStateType } from "../state/create-module-state.svelte";
  import type { createConstructTabState as ConstructTabStateType } from "../state/construct-tab-state.svelte";
  import { createPanelCoordinationState } from "../state/panel-coordination-state.svelte";
  import { setCreateModuleStateRef } from "../state/create-module-state-ref.svelte";
  import type { IToolPanelMethods } from "../types/create-module-types";
  import TransferConfirmDialog from "./TransferConfirmDialog.svelte";
  import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";
  import StandardWorkspaceLayout from "./StandardWorkspaceLayout.svelte";
  import { setCreateModuleContext } from "../context/create-module-context";
  import LOOPCoordinator from "./coordinators/LOOPCoordinator.svelte";
  import StartEndCoordinator from "./coordinators/StartEndCoordinator.svelte";
  import SequenceActionsCoordinator from "./coordinators/SequenceActionsCoordinator.svelte";
  import StepEditorCoordinator from "./coordinators/StepEditorCoordinator.svelte";
  import VideoRecordCoordinator from "./coordinators/VideoRecordCoordinator.svelte";
  import SequenceDrawerHost from "./coordinators/SequenceDrawerHost.svelte";
  import SaveToLibraryPanel from "./SaveToLibraryPanel.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { SessionManager } from "../services/SessionManager.svelte";
  import { Autosaver } from "../services/Autosaver";
  import { SequencePersister } from "../services/SequencePersister";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { createPanelHeightTracker } from "../state/managers/PanelHeightTracker.svelte";
  import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";
  import type { LetterSource } from "$lib/features/create/spell/domain/models/spell-models";

  const logger = createComponentLogger("CreateModule");

  type CreateModuleState = ReturnType<typeof CreateModuleStateType>;
  type ConstructTabState = ReturnType<typeof ConstructTabStateType>;

  // ============================================================================
  // PROPS
  // ============================================================================
  let {
    onTabAccessibilityChange,
    onCurrentWordChange,
  }: {
    onTabAccessibilityChange?: (canAccessEditAndExport: boolean) => void;
    onCurrentWordChange?: (word: string) => void;
  } = $props();

  // ============================================================================
  // SERVICES & STATE (Resolved via DI)
  // ============================================================================
  let services: CreateModuleOrchestrators | null = $state(null);
  let handlers: ICreateModuleHandlers | null = $state(null);
  let effectCoordinator: ICreateModuleEffectCoordinator | null = $state(null);
  let deepLinkService: any = $state(null);
  let panelPersistenceService: IPanelPersister | null = $state(null);
  let CreateModuleState: CreateModuleState | null = $state(null);
  let constructTabState: ConstructTabState | null = $state(null);

  // Session management services
  let sessionManager: SessionManager | null = $state(null);
  let autosaver: Autosaver | null = $state(null);
  let sequencePersister: SequencePersister | null = $state(null);

  // Settings service for user preferences
  let settingsService: ISettingsState | null = $state(null);

  // ============================================================================
  // COMPONENT STATE
  // ============================================================================
  let panelState = createPanelCoordinationState();
  let animatingStepNumber = $state<number | null>(null);
  let shouldUseSideBySideLayout = $state<boolean>(false);
  let error = $state<string | null>(null);
  let servicesInitialized = $state<boolean>(false);

  // Confirmation dialog states
  let showTransferConfirmation = $state(false);
  let showClearSequenceConfirm = $state(false);
  let isMobile = $state(false);
  let sequenceToTransfer: PictographData[] | null = $state(null);
  let toolPanelElement: HTMLElement | null = $state(null);
  let toolPanelRef: IToolPanelMethods | null = $state(null);
  let buttonPanelElement: HTMLElement | null = $state(null);
  let effectCleanup: (() => void) | null = null;
  let panelPersistenceCleanup: (() => void) | undefined = undefined;
  let panelHeightTrackerCleanup: (() => void) | null = null;
  let currentDisplayWord = $state<string>(""); // Current word with contextual messages
  let currentLetterSources = $state<LetterSource[] | null>(null); // Letter sources for spell tab styling
  let isInputMode = $state(false); // Input mode - collapse workspace when word input is focused on mobile

  // ============================================================================
  // CONTEXT PROVISION
  // ============================================================================
  setContext("panelState", panelState);

  const layoutContext = {
    get shouldUseSideBySideLayout() {
      return shouldUseSideBySideLayout;
    },
    isMobilePortrait() {
      return services?.layoutService?.isMobilePortrait() ?? false;
    },
    get isInputMode() {
      return isInputMode;
    },
    setInputMode(mode: boolean) {
      isInputMode = mode;
    },
  };

  setCreateModuleContext({
    get CreateModuleState() {
      if (!CreateModuleState) {
        throw new Error("CreateModuleState not yet initialized");
      }
      return CreateModuleState;
    },
    get constructTabState() {
      if (!constructTabState) {
        throw new Error("constructTabState not yet initialized");
      }
      return constructTabState;
    },
    panelState,
    get services() {
      if (!services) {
        throw new Error("Services not yet initialized");
      }
      return services;
    },
    get sessionManager() {
      return sessionManager;
    },
    get autosaver() {
      return autosaver;
    },
    get sequencePersister() {
      return sequencePersister;
    },
    layout: layoutContext,
    handlers: {
      onError: (err: string) => {
        error = err;
      },
    },
  });

  // ============================================================================
  // EFFECT COORDINATOR SETUP
  // ============================================================================
  function setupEffectCoordinator(): void {
    if (!effectCoordinator || !services) return;

    if (effectCleanup) {
      effectCleanup();
      effectCleanup = null;
    }

    effectCleanup = effectCoordinator.setupEffects({
      getCreateModuleState: () => CreateModuleState,
      getConstructTabState: () => constructTabState,
      panelState,
      navigationState,
      layoutService: services.layoutService,
      NavigationSyncer: services.NavigationSyncer,
      getDeepLinker: () => deepLinkService,
      getStepOperator: () => services?.StepOperator ?? null,
      getAutosaver: () => autosaver,
      isServicesInitialized: () => servicesInitialized,
      onLayoutChange: (layout) => {
        shouldUseSideBySideLayout = layout;
        setSideBySideLayout(layout);
      },
      getShouldUseSideBySideLayout: () => shouldUseSideBySideLayout,
      setAnimatingStepNumber: (beat) => {
        animatingStepNumber = beat;
      },
      onCurrentWordChange: (word: string) => {
        currentDisplayWord = word;
        onCurrentWordChange?.(word);
      },
      onLetterSourcesChange: (sources: LetterSource[] | null) => {
        currentLetterSources = sources;
      },
      onTabAccessibilityChange,
      // NOTE: Panel height tracking moved to separate $effect in CreateModule
      // because element bindings happen AFTER onMount completes
    });
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================
  onMount(() => {
    let checkIsMobile: (() => void) | null = null;

    // Run async initialization in an IIFE
    (async () => {
      // Track if a deep link was processed (declared once for entire async scope)
      let hasDeepLink = false;

      try {
        // Create services available synchronously via ITI
        const initService = container.items.createModuleInitializer;

        const result = await initService.initialize();

        // Extract all services and state from initialization result
        services = {
          sequenceService: result.sequenceService,
          SequencePersister: result.SequencePersister,
          StartPositionManager: result.StartPositionManager,
          CreateModuleOrchestrator: result.CreateModuleOrchestrator,
          layoutService: result.layoutService,
          NavigationSyncer: result.NavigationSyncer,
          StepOperator: result.StepOperator,
          shareService: result.shareService,
        };

        CreateModuleState = result.CreateModuleState;
        constructTabState = result.constructTabState;

        // Extract UI coordination services from result (no manual resolution needed)
        handlers = result.handlers;
        effectCoordinator = result.effectCoordinator;
        deepLinkService = result.deepLinkService;
        panelPersistenceService = result.panelPersistenceService;

        // Ensure state is initialized before setting reference
        if (!CreateModuleState || !constructTabState) {
          throw new Error(
            "Failed to initialize CreateModuleState or constructTabState"
          );
        }

        // Set global reference for keyboard shortcuts
        setCreateModuleStateRef({
          CreateModuleState,
          constructTabState,
          panelState,
        });

        servicesInitialized = true;

        // Resolve settings service for user preferences
        settingsService = container.items.settingsState;

        initService.configureEventCallbacks(CreateModuleState, panelState);

        // Start panel persistence tracking (handles navigation changes, panel close detection)
        panelPersistenceCleanup = panelPersistenceService?.startTracking({
          panelState,
          canRestorePanels: () => CreateModuleState?.canAccessEditTab ?? false,
        });

        // Start effect coordinator (manages all reactive effects)
        setupEffectCoordinator();

        // Initialize session management
        sessionManager = new SessionManager();
        autosaver = new Autosaver();
        sequencePersister = new SequencePersister();

        // Wait for auth to be initialized before creating session
        // This prevents race condition where CreateModule initializes before Firebase auth
        if (!authState.isInitialized) {
          logger.info("Waiting for auth to initialize...");
          // Poll for auth initialization (max 5 seconds)
          let waited = 0;
          while (!authState.isInitialized && waited < 5000) {
            await new Promise((r) => setTimeout(r, 100));
            waited += 100;
          }
        }

        // Only create session if user is authenticated
        if (authState.isAuthenticated) {
          try {
            await sessionManager.createSession();

            // Start autosave interval (every 30 seconds)
            autosaver.startAutosave(
              () => CreateModuleState?.sequenceState.currentSequence || null,
              sessionManager.getCurrentSession()?.sessionId || "",
              30000
            );

            logger.success("Session management initialized");
          } catch (sessionError) {
            logger.warn("Session creation failed:", sessionError);
          }
        } else {
          logger.info("Session management skipped (user not authenticated)");
        }

        logger.success("CreateModule initialized successfully");

        // Load sequence from deep link or pending edit, then initialize persistence
        await tick(); // Ensure DOM is ready
        const loadResult =
          await initService.loadSequenceAndInitializePersistence(
            (sequence: any) =>
              CreateModuleState!.sequenceState.setCurrentSequence(sequence),
            () => CreateModuleState!.initializeWithPersistence()
          );

        if (loadResult.sequenceLoaded) {
          // Navigate to target tab if specified (deep link only)
          if (loadResult.targetTab) {
            navigationState.setActiveTab(loadResult.targetTab);
          }

          hasDeepLink = true;
        }

        // Restore previously open panel if returning to create module
        // Only restore if no deep link was processed (deep link takes priority)
        // AND there's actually a sequence to work with (canAccessEditTab)
        // AND the panel is supported for the current tab
        if (!hasDeepLink && CreateModuleState.canAccessEditTab) {
          const currentTab = navigationState.activeTab;
          const savedPanel = navigationState.getLastPanelForTab(
            "create",
            currentTab
          );
          if (
            savedPanel &&
            panelPersistenceService?.isPanelSupportedForTab(
              savedPanel as any,
              currentTab
            )
          ) {
            logger.log(
              `Restoring saved panel "${savedPanel}" for tab "create:${currentTab}"`
            );
            await tick();
            panelPersistenceService?.restoreSavedPanel(
              panelState,
              savedPanel as any
            );
          }
        }

        // Detect if we're on mobile for responsive dialog rendering
        checkIsMobile = () => {
          isMobile = window.innerWidth < 768;
        };
        checkIsMobile();
        window.addEventListener("resize", checkIsMobile);
      } catch (err) {
        error =
          err instanceof Error
            ? err.message
            : "Failed to initialize CreateModule";
        console.error("CreateModule: Initialization error:", err);
      }
    })();

    // Return cleanup function synchronously (required for Svelte 5 onMount)
    return () => {
      if (checkIsMobile) {
        window.removeEventListener("resize", checkIsMobile);
      }
      setCreateModuleStateRef(null);

      // Cleanup effect coordinator
      if (effectCleanup) {
        effectCleanup();
        effectCleanup = null;
      }

      // Cleanup panel persistence tracking
      if (panelPersistenceCleanup) {
        panelPersistenceCleanup();
        panelPersistenceCleanup = undefined;
      }

      // Cleanup panel height tracker
      if (panelHeightTrackerCleanup) {
        panelHeightTrackerCleanup();
        panelHeightTrackerCleanup = null;
      }

      // Cleanup session management
      autosaver?.stopAutosave();
      sessionManager?.abandonSession();
    };
  });

  // ============================================================================
  // EVENT HANDLERS (Delegated to Services)
  // ============================================================================
  async function handleOptionSelected(option: PictographData): Promise<void> {
    if (!handlers) {
      error = "Handlers service not initialized";
      return;
    }
    try {
      await handlers.handleOptionSelected(option);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to select option";
    }
  }

  function clearError() {
    error = null;
  }

  function handleOpenShareHubPanel() {
    if (!handlers) return;
    handlers.handleOpenShareHubPanel(panelState);
  }

  function handleClearSequence() {
    if (!handlers || !CreateModuleState || !constructTabState) return;

    // Skip confirmation if user has opted out (undo is always available)
    if (settingsService?.currentSettings?.skipClearConfirmation) {
      confirmClearSequence();
      return;
    }

    // Show confirmation dialog
    showClearSequenceConfirm = true;
  }

  async function confirmClearSequence() {
    if (!handlers || !CreateModuleState || !constructTabState) return;

    try {
      await handlers.handleClearSequence({
        CreateModuleState,
        constructTabState,
        panelState,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to clear sequence";
    } finally {
      showClearSequenceConfirm = false;
    }
  }

  function cancelClearSequence() {
    showClearSequenceConfirm = false;
  }

  function handleSkipClearConfirmationChange(checked: boolean) {
    if (checked && settingsService) {
      settingsService.updateSetting("skipClearConfirmation", true);
    }
  }

  function handleOpenFilterPanel() {
    if (!handlers) return;
    handlers.handleOpenFilterPanel(panelState);
  }


  function handleOpenSequenceActions() {
    if (!handlers) return;
    handlers.handleOpenSequenceActions(panelState);
  }

  /**
   * Transfer sequence to Constructor workspace
   */
  async function transferSequenceToConstructor(sequence: any) {
    if (!services || !CreateModuleState) return;

    try {
      // Save the sequence to Constructor's localStorage key
      await services.SequencePersister.saveCurrentState({
        currentSequence: sequence,
        selectedStartPosition: sequence.steps[0] || null,
        hasStartPosition: sequence.steps.length > 0,
        activeBuildSection: "construct",
      });

      // Switch to Construct tab
      navigationState.setActiveTab("construct");
    } catch (error) {
      console.error("❌ Failed to transfer sequence to Constructor:", error);
    }
  }

  /**
   * Handle confirmation of sequence transfer
   */
  async function handleConfirmTransfer() {
    if (!sequenceToTransfer || !CreateModuleState) return;

    const currentSequence = CreateModuleState.sequenceState.currentSequence;
    if (currentSequence) {
      await transferSequenceToConstructor(currentSequence);
    }

    // Reset state
    showTransferConfirmation = false;
    sequenceToTransfer = null;
  }

  /**
   * Handle cancellation of sequence transfer
   */
  function handleCancelTransfer() {
    showTransferConfirmation = false;
    sequenceToTransfer = null;
  }

  // ============================================================================
  // PANEL HEIGHT TRACKER (Separate from effect coordinator to handle timing)
  // ============================================================================
  /**
   * Set up panel height tracker when elements become available.
   *
   * This runs in a separate $effect because toolPanelElement and buttonPanelElement
   * are bound AFTER onMount completes (element bindings happen after first render).
   *
   * The effect coordinator runs during onMount's async initialization, when elements
   * are still null, so we need to watch for when they become available.
   */
  $effect(() => {
    // Clean up previous tracker if it exists
    if (panelHeightTrackerCleanup) {
      panelHeightTrackerCleanup();
      panelHeightTrackerCleanup = null;
    }

    // Only set up tracker if at least one element is available
    if (toolPanelElement || buttonPanelElement) {
      panelHeightTrackerCleanup = createPanelHeightTracker({
        toolPanelElement,
        buttonPanelElement,
        panelState,
      });
    }
  });
</script>

{#if error}
  <ErrorBanner message={error} onDismiss={clearError} />
{:else if CreateModuleState && constructTabState && services}
  <div class="create-tab">
    <StandardWorkspaceLayout
      {shouldUseSideBySideLayout}
      {CreateModuleState}
      {panelState}
      {currentDisplayWord}
      {currentLetterSources}
      {isInputMode}
      bind:animatingStepNumber
      bind:toolPanelRef
      bind:buttonPanelElement
      bind:toolPanelElement
      onClearSequence={handleClearSequence}
      onShareHub={handleOpenShareHubPanel}
      onSequenceActionsClick={handleOpenSequenceActions}
      onOptionSelected={handleOptionSelected}
      onOpenFilters={handleOpenFilterPanel}
      onCloseFilters={() => {
        panelState.closeFilterPanel();
      }}
    />
  </div>

  <!-- Video Record Coordinator -->
  <VideoRecordCoordinator />

  <!-- Sequence Drawer Host (provides animation state + context) -->
  <SequenceDrawerHost />

  <!-- Sequence Actions Coordinator -->
  <SequenceActionsCoordinator />

  <!-- Beat Editor Coordinator - Opens when clicking a pictograph -->
  <StepEditorCoordinator />

  <!-- LOOP Coordinator -->
  <LOOPCoordinator />

  <!-- Start/End Options Coordinator -->
  <StartEndCoordinator />

  <!-- Save to Library Panel - Rendered at root level to avoid stacking context issues -->
  <SaveToLibraryPanel
    show={panelState.isSaveToLibraryPanelOpen}
    word={currentDisplayWord}
    onClose={() => panelState.closeSaveToLibraryPanel()}
  />

  <!-- Sequence Transfer Confirmation Dialog -->
  <TransferConfirmDialog
    bind:isOpen={showTransferConfirmation}
    {isMobile}
    onConfirm={handleConfirmTransfer}
    onCancel={handleCancelTransfer}
  />

  <!-- Clear Sequence Confirmation Dialog -->
  <ConfirmDialog
    bind:isOpen={showClearSequenceConfirm}
    title="Clear Sequence?"
    message="This will remove all steps and the start position. Use undo to restore if needed."
    confirmText="Clear All"
    cancelText="Keep"
    variant="danger"
    showDontAskAgain={true}
    onConfirm={confirmClearSequence}
    onCancel={cancelClearSequence}
    onDontAskAgainChange={handleSkipClearConfirmationChange}
  />
{:else}
  <!-- Loading state while async initialization completes -->
  <div class="create-tab create-loading">
    <ProgressRing percent={-1} size={32} strokeWidth={3} />
  </div>
{/if}

<style>
  .create-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    transition: background-color var(--duration-normal) ease-out;
  }

  .create-loading {
    align-items: center;
    justify-content: center;
  }

</style>
