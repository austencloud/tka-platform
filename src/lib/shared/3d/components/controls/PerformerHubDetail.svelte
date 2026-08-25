<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    AVATAR_DEFINITIONS,
    getAvatarModelPath,
    prepareAvatarForDisplay,
    type AvatarId,
  } from "@austencloud/scene-3d";
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { getPerformerColor } from "../../constants/performer-colors";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import PerformerPropSizeSlider from "./PerformerPropSizeSlider.svelte";
  import AvatarSelectWorkspace from "./avatar-select/AvatarSelectWorkspace.svelte";
  import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import PerformerSequencePanel from "./PerformerSequencePanel.svelte";
  import PerformerIdentityHeader from "./PerformerIdentityHeader.svelte";
  import EffortPalette from "$lib/shared/phrase-effort-lab/components/EffortPalette.svelte";
  import EffectsSettingsPanel from "./EffectsSettingsPanel.svelte";
  import PlanesPopover from "../PlanesPopover.svelte";
  import ScenePropPicker from "./ScenePropPicker.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { EffortId } from "$lib/shared/effort/domain/effort-types";
  import {
    reportViewerControlChange,
    type ViewerControlSink,
  } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";
  import type {
    PerformerEditSink,
    PerformerHubEdit,
    PerformerHubTab,
  } from "./performer-hub-types";

  interface Props {
    onSettingChange?: ViewerControlSink;
    /**
     * Supplied by a host that owns performer state (the Director, whose
     * performers are a projection of its film document). When present the hub
     * routes parameter changes here instead of writing them onto the manager.
     */
    onPerformerEdit?: PerformerEditSink;
    activeTab?: PerformerHubTab;
    showTabBar?: boolean;
  }
  let {
    onSettingChange,
    onPerformerEdit,
    activeTab = $bindable("prop"),
    showTabBar = true,
  }: Props = $props();

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const isAllMode = $derived(selectedIndex === null);
  const allPerformers = $derived(viewer.performerManager.performers);
  const performer = $derived(
    selectedIndex !== null ? (allPerformers[selectedIndex] ?? null) : null
  );

  const performerColor = $derived(
    selectedIndex !== null
      ? getPerformerColor(selectedIndex)
      : "var(--theme-accent)"
  );
  const canRemove = $derived(allPerformers.length > 1);

  const avatarDef = $derived(
    AVATAR_DEFINITIONS.find((a) => a.id === performer?.avatarModelId) ??
      AVATAR_DEFINITIONS[0]
  );
  // Resolved performer name: user-assigned override falls back to the avatar
  // model's name. This is what the editable header field shows.
  const performerName = $derived(
    performer?.displayName ?? avatarDef?.name ?? "—"
  );

  const sequence = $derived(performer?.loadedSequence ?? null);
  const sequenceWord = $derived(sequence?.word ?? sequence?.name ?? null);
  const sequenceSteps = $derived(sequence?.steps?.length ?? null);

  const currentAvatarId = $derived.by<AvatarId | null>(() => {
    if (!isAllMode) return performer?.avatarModelId ?? null;

    const first = allPerformers[0]?.avatarModelId;
    if (!first) return null;

    return allPerformers.every((item) => item.avatarModelId === first)
      ? first
      : null;
  });

  const avatarScopeKey = $derived(
    selectedIndex === null ? "all-performers" : `performer-${selectedIndex}`
  );

  async function pickAvatar(id: AvatarId): Promise<void> {
    cancelAvatarSelectionIntent();
    if (pendingAvatarId === id || currentAvatarId === id) return;

    const selectionRequest = ++avatarSelectionRequest;
    pendingAvatarId = id;
    try {
      await prepareAvatarSelection(id);
      if (selectionRequest !== avatarSelectionRequest) return;
      pendingAvatarId = null;

      const previous = currentAvatarId;
      if (
        !writeParameter({ field: "avatarId", value: id }, (p) =>
          p?.setAvatarModel(id)
        )
      )
        return;
      reportViewerControlChange(
        onSettingChange,
        "viewer_3d_performer",
        "avatar",
        previous,
        id
      );
    } catch (caught) {
      if (selectionRequest !== avatarSelectionRequest) return;
      pendingAvatarId = null;
      const failure =
        caught instanceof Error ? caught : new Error(String(caught));
      getErrorHandler().showUserError({
        message:
          "That avatar could not load. Your current avatar is still active.",
        technicalDetails: failure.message,
        error: failure,
        severity: "warning",
        context: {
          module: "3d",
          tab: "performer-avatar",
          action: "loadAvatar",
        },
      });
    }
  }

  let pendingAvatarId = $state<AvatarId | null>(null);
  let avatarSelectionRequest = 0;
  let avatarIntentTimer: ReturnType<typeof setTimeout> | null = null;

  function prepareAvatarSelection(id: AvatarId): Promise<void> {
    return prepareAvatarForDisplay(getAvatarModelPath(id));
  }

  function queueAvatarSelectionIntent(id: AvatarId): void {
    cancelAvatarSelectionIntent();
    avatarIntentTimer = setTimeout(() => {
      avatarIntentTimer = null;
      void prepareAvatarSelection(id).catch(() => {
        // Prewarming is opportunistic. A real click reports an earned failure.
      });
    }, 120);
  }

  function cancelAvatarSelectionIntent(): void {
    if (avatarIntentTimer === null) return;
    clearTimeout(avatarIntentTimer);
    avatarIntentTimer = null;
  }

  onDestroy(() => {
    cancelAvatarSelectionIntent();
    avatarSelectionRequest++;
  });

  // ─── Tabs ───
  const ALL_TABS: { id: PerformerHubTab; label: string; icon: string }[] = [
    { id: "avatar", label: "Avatar", icon: "fa-user" },
    { id: "sequence", label: "Sequence", icon: "fa-film" },
    { id: "prop", label: "Prop", icon: "fa-shapes" },
    { id: "planes", label: "Planes", icon: "fa-layer-group" },
    { id: "effort", label: "Effort", icon: "fa-gauge-high" },
    { id: "effects", label: "Effects", icon: "fa-wand-sparkles" },
  ];

  const GLOBAL_TABS: { id: PerformerHubTab; label: string; icon: string }[] = [
    { id: "avatar", label: "Avatar", icon: "fa-user" },
    { id: "prop", label: "Prop", icon: "fa-shapes" },
    { id: "planes", label: "Planes", icon: "fa-layer-group" },
    { id: "effort", label: "Effort", icon: "fa-gauge-high" },
    { id: "effects", label: "Effects", icon: "fa-wand-sparkles" },
  ];

  const TABS = $derived(isAllMode ? GLOBAL_TABS : ALL_TABS);
  const tabIndex = $derived(TABS.findIndex((t) => t.id === activeTab));

  $effect(() => {
    if (isAllMode && activeTab === "sequence") {
      const previous = activeTab;
      activeTab = "prop";
      reportViewerControlChange(
        onSettingChange,
        "viewer_3d_performer",
        "tab",
        previous,
        "prop",
        { count: false }
      );
    }
  });

  function selectTab(tab: PerformerHubTab): void {
    const previous = activeTab;
    activeTab = tab;
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "tab",
      previous,
      tab
    );
  }

  function handleTabKeydown(e: KeyboardEvent) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (tabIndex + dir + TABS.length) % TABS.length;
    const nextTab = TABS[next];
    if (nextTab) {
      selectTab(nextTab.id);
      const btn = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
        `#hub-tab-${nextTab.id}`
      );
      btn?.focus();
    }
  }

  // ─── Prop ───
  const currentProp = $derived.by<PropType | null>(() => {
    if (!isAllMode) {
      return performer?.effectiveProp ?? viewer.defaultSettings.prop;
    }

    const first = allPerformers[0]?.effectiveProp;
    if (!first) return viewer.defaultSettings.prop;

    return allPerformers.every((item) => item.effectiveProp === first)
      ? first
      : null;
  });

  function applyToScope(fn: (p: typeof performer) => void) {
    if (isAllMode) {
      for (const p of allPerformers) fn(p);
    } else {
      fn(performer);
    }
  }

  /**
   * Routes one parameter change to the host when it owns performer state, and
   * to the manager otherwise. Returns false when the host rejected the edit,
   * so the caller skips reporting a change that did not happen.
   */
  function writeParameter(
    edit: Omit<PerformerHubEdit, "performerIndex">,
    applyDirect: (p: typeof performer) => void
  ): boolean {
    if (onPerformerEdit) {
      return onPerformerEdit({
        ...edit,
        performerIndex: selectedIndex,
      } as PerformerHubEdit);
    }
    applyToScope(applyDirect);
    return true;
  }

  function handlePropSelect(propType: PropType): void {
    const previous = currentProp;
    if (!writeParameter({ field: "prop", value: propType }, (p) => p?.setProp(propType)))
      return;
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "prop_type",
      previous,
      propType
    );
  }

  // ─── Effort ───
  const currentEffort = $derived.by<EffortId | null>(() => {
    if (!isAllMode) {
      return performer?.effectiveEffortId ?? viewer.defaultSettings.effortId;
    }

    const first = allPerformers[0]?.effectiveEffortId;
    if (!first) return viewer.defaultSettings.effortId;

    // All Performers writes an override to every performer. The palette must
    // read those effective values too; reading the viewer default left Linear
    // highlighted while every performer visibly used another effort.
    return allPerformers.every((item) => item.effectiveEffortId === first)
      ? first
      : null;
  });

  function handleEffortSelect(effortId: EffortId) {
    const previous = currentEffort;
    if (
      !writeParameter({ field: "effort", value: effortId }, (p) =>
        p?.setEffort(effortId)
      )
    )
      return;
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "effort",
      previous,
      effortId
    );
  }

  function handlePropSizeChange(cm: number) {
    writeParameter({ field: "staffLengthCm", value: cm }, (p) =>
      p?.setStaffLengthCm(cm)
    );
  }

  function removePerformer(): void {
    const previous = allPerformers.length;
    viewer.removePerformerFromUI();
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "performer_count",
      previous,
      viewer.performerManager.performers.length
    );
  }

  let removeConfirmOpen = $state(false);

  function chooseSequence(sequenceData: SequenceData): void {
    const previous = sequenceWord ?? null;
    viewer.loadSequenceScoped(sequenceData);
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "sequence_loaded",
      previous,
      sequenceData.word ?? sequenceData.name
    );
  }

  function clearSequence(): void {
    performer?.clearSequence();
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "sequence_loaded",
      true,
      false
    );
  }
</script>

<div
  class="hub-detail"
  style:--performer-color={performerColor}
  style:--pop-accent={performerColor}
>
  <div class="accent-strip" aria-hidden="true"></div>

  <PerformerIdentityHeader
    {performer}
    performerCount={allPerformers.length}
    {performerColor}
    {sequenceWord}
    {sequenceSteps}
    {canRemove}
    onRemove={() => (removeConfirmOpen = true)}
    {onSettingChange}
  />

  <div class="header-divider" aria-hidden="true"></div>

  <!-- ─── Tab panes ─── -->
  <div class="tab-content">
    {#if activeTab === "avatar"}
      <div
        id="hub-panel-avatar"
        class="tab-pane active"
        role="tabpanel"
        aria-labelledby="hub-tab-avatar"
      >
        <div class="avatar-section">
          <AvatarSelectWorkspace
            {currentAvatarId}
            {pendingAvatarId}
            {performerColor}
            scopeKey={avatarScopeKey}
            onIntent={queueAvatarSelectionIntent}
            onCancelIntent={cancelAvatarSelectionIntent}
            onCommit={(id) => void pickAvatar(id)}
          />
        </div>
      </div>
    {/if}

    {#if !isAllMode && activeTab === "sequence"}
      <div
        id="hub-panel-sequence"
        class="tab-pane active"
        role="tabpanel"
        aria-labelledby="hub-tab-sequence"
      >
        <PerformerSequencePanel
          {performerName}
          {sequenceWord}
          {sequenceSteps}
          hasSequence={sequence !== null}
          onSelect={chooseSequence}
          onClear={clearSequence}
        />
      </div>
    {/if}

    {#if activeTab === "prop"}
      <div
        id="hub-panel-prop"
        class="tab-pane active"
        role="tabpanel"
        aria-labelledby="hub-tab-prop"
      >
        <div class="prop-section">
          <ScenePropPicker
            {currentProp}
            accentColor={performerColor}
            onSelect={handlePropSelect}
          />

          <!-- The slider reads its displayed size from one performer; in
               All-Performers mode that is the first. Writing always goes
               through handlePropSizeChange so the scope and the host sink
               apply in both modes. -->
          {#if performer ?? allPerformers[0]}
            <PerformerPropSizeSlider
              performer={performer ?? allPerformers[0]!}
              onSizeChange={handlePropSizeChange}
              {onSettingChange}
            />
          {/if}
        </div>
      </div>
    {/if}

    {#if activeTab === "planes"}
      <div
        id="hub-panel-planes"
        class="tab-pane active"
        role="tabpanel"
        aria-labelledby="hub-tab-planes"
      >
        <div class="planes-section">
          <PlanesPopover {onSettingChange} />
        </div>
      </div>
    {/if}

    {#if activeTab === "effort"}
      <div
        id="hub-panel-effort"
        class="tab-pane active"
        role="tabpanel"
        aria-labelledby="hub-tab-effort"
      >
        <div class="effort-section">
          <EffortPalette
            selectedEffort={currentEffort}
            onSelect={handleEffortSelect}
          />
        </div>
      </div>
    {/if}

    {#if activeTab === "effects"}
      <div
        id="hub-panel-effects"
        class="tab-pane active"
        role="tabpanel"
        aria-labelledby="hub-tab-effects"
      >
        <div class="effects-section">
          <EffectsSettingsPanel
            performer={isAllMode ? null : performer}
            performers={isAllMode ? allPerformers : null}
            presentation="performer-hub"
            onEffectEdit={onPerformerEdit
              ? (effect) =>
                  writeParameter({ field: "effect", value: effect }, () => {})
              : undefined}
            {onSettingChange}
          />
        </div>
      </div>
    {/if}
  </div>

  {#if showTabBar}
    <div class="tab-divider" aria-hidden="true"></div>

    <!-- ─── Tab bar (bottom-anchored) ─── -->
    <div
      class="tab-bar"
      role="tablist"
      tabindex="-1"
      aria-label="Performer controls"
      style:--active-index={tabIndex}
      style:--tab-count={TABS.length}
      onkeydown={handleTabKeydown}
    >
      <div class="tab-indicator" aria-hidden="true"></div>
      {#each TABS as tab}
        <button
          id="hub-tab-{tab.id}"
          class="tab-btn"
          class:active={activeTab === tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          tabindex={activeTab === tab.id ? 0 : -1}
          aria-controls="hub-panel-{tab.id}"
          onclick={() => selectTab(tab.id)}
        >
          <i class="fas {tab.icon}" aria-hidden="true"></i>
          <span class="tab-label">{tab.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<ConfirmDialog
  bind:isOpen={removeConfirmOpen}
  title={`Remove ${performerName}?`}
  message="This removes the performer from the scene. You can undo the change from the viewer."
  confirmText="Remove performer"
  cancelText="Keep performer"
  variant="danger"
  onConfirm={removePerformer}
  onCancel={() => (removeConfirmOpen = false)}
/>

<style>
  .hub-detail {
    width: 100%;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    container-type: inline-size;
    max-height: 100%;
    min-height: 0;
  }

  /* ─── Accent strip ─── */
  .accent-strip {
    height: 2px;
    background: linear-gradient(
      90deg,
      var(--performer-color),
      color-mix(in srgb, var(--performer-color) 20%, transparent)
    );
  }

  /* ─── Dividers ─── */
  .header-divider {
    height: 1px;
    margin: 0 14px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--performer-color) 22%, transparent),
      color-mix(in srgb, var(--theme-text) 4%, transparent)
    );
  }

  .tab-divider {
    height: 1px;
    margin: 0 14px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--theme-text) 6%, transparent),
      color-mix(in srgb, var(--theme-text) 2%, transparent)
    );
  }

  /* ─── Tab bar (6 columns) ─── */
  .tab-bar {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--tab-count, 6), 1fr);
    margin: 0 10px 8px;
    padding: 3px;
    background: var(--surface-inset-deep);
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--theme-text) 4%, transparent);
  }

  .tab-indicator {
    position: absolute;
    top: 3px;
    bottom: 3px;
    width: calc((100% - 6px) / var(--tab-count, 6));
    left: calc(3px + var(--active-index) * (100% - 6px) / var(--tab-count, 6));
    border-radius: 7px;
    background: color-mix(
      in srgb,
      var(--performer-color) 20%,
      var(--theme-card-bg)
    );
    box-shadow:
      0 1px 4px var(--surface-inset-deep),
      0 0 16px color-mix(in srgb, var(--performer-color) 12%, transparent);
    transition: left 280ms cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    z-index: 0;
  }

  .tab-btn {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 44px;
    padding: 8px 2px;
    border-radius: 7px;
    border: none;
    background: transparent;
    color: var(--theme-text-dim);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 200ms ease,
      transform 140ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .tab-btn:hover:not(.active) {
    color: var(--theme-text);
  }

  .tab-btn.active {
    color: var(--performer-color);
  }

  .tab-btn i {
    font-size: 14px;
  }

  .tab-label {
    letter-spacing: 0.02em;
  }

  /* ─── Tab content ─── */
  .tab-content {
    padding: 12px 14px 14px;
    overflow-y: auto;
    min-height: 0;
    overscroll-behavior: contain;
  }

  .tab-pane {
    animation: pane-in 160ms cubic-bezier(0, 0, 0.2, 1);
  }

  @keyframes pane-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ─── Section label ─── */
  .section-label {
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: color-mix(in srgb, var(--theme-text-dim) 72%, transparent);
    margin-bottom: 8px;
  }

  /* ─── Avatar tab ─── */
  .avatar-section {
    container-type: inline-size;
  }

  /* ─── Prop tab ─── */
  .prop-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    container-type: inline-size;
  }

  /* ─── Planes tab ─── */
  .planes-section :global(.cascade-badge) {
    display: none;
  }

  /* ─── Effort tab ─── */
  .effort-section {
    --min-touch-target: 44px;
  }

  .effort-section :global(.effort-palette) {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .effort-section :global(.palette-btn) {
    min-width: 0;
  }

  /* ─── Effects tab ─── */
  .effects-section {
    --theme-card-bg: transparent;
    --min-touch-target: 44px;
    container-type: inline-size;
  }

  .effects-section :global(.effects-settings) {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;
    background: transparent;
    border: none;
  }

  .effects-section :global(h3) {
    display: none;
  }

  .effects-section :global(.effect-chips) {
    order: initial;
  }

  .effects-section :global(.sub-control),
  .effects-section :global(.intensity-control),
  .effects-section :global(.active-count) {
    margin-top: 0;
  }

  /* ─── Focus-visible ─── */
  button:focus-visible {
    outline: 2px solid var(--performer-color, var(--theme-accent));
    outline-offset: 2px;
  }

  /* ─── Reduced motion ─── */
  @media (prefers-reduced-motion: reduce) {
    .tab-indicator {
      transition: none;
    }
    .tab-pane {
      animation: none;
    }
  }

  @container (max-width: 460px) {
    .tab-label {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .tab-btn i {
      font-size: 17px;
    }
  }
</style>
