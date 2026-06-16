<script lang="ts">
  import { AVATAR_DEFINITIONS, type AvatarId } from "@austencloud/scene-3d";
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { getPerformerColor } from "../../constants/performer-colors";

  import { R2_CDN } from "../../constants/r2-cdn";
  function avatarThumbUrl(id: string): string {
    return `${R2_CDN}/models/avatars/thumbnails/${id}.webp`;
  }
  // Track which thumbnails genuinely finished loading. The avatar icon is the
  // always-rendered base layer; the thumbnail only paints once onload fires, so
  // a missing/404 thumbnail can never flash a broken-image glyph. Upload
  // thumbnails to the CDN later and they light up automatically.
  let loadedThumbs = $state(new Set<string>());
  import PerformerPropSizeSlider from "./PerformerPropSizeSlider.svelte";
  import EffortPalette from "$lib/shared/phrase-effort-lab/components/EffortPalette.svelte";
  import EffectsSettingsPanel from "./EffectsSettingsPanel.svelte";
  import PlanesPopover from "../PlanesPopover.svelte";
  import {
    getBasePropType,
    getAllVariations,
    getPropTypeDisplayInfo,
    isPropActive,
    getBasePropsByCategory,
    PROP_CATEGORIES,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { EffortId } from "$lib/shared/effort/domain/effort-types";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const isAllMode = $derived(selectedIndex === null);
  const allPerformers = $derived(viewer.performerManager.performers);
  const performer = $derived(
    selectedIndex !== null
      ? (allPerformers[selectedIndex] ?? null)
      : null,
  );

  const performerColor = $derived(
    selectedIndex !== null ? getPerformerColor(selectedIndex) : "#4a9eff",
  );
  const canRemove = $derived(allPerformers.length > 1);

  const avatarDef = $derived(
    AVATAR_DEFINITIONS.find((a) => a.id === performer?.avatarModelId) ??
      AVATAR_DEFINITIONS[0],
  );
  // Resolved performer name: user-assigned override falls back to the avatar
  // model's name. This is what the editable header field shows.
  const performerName = $derived(
    performer?.displayName ?? avatarDef?.name ?? "—",
  );
  const avatarInitials = $derived(
    performerName !== "—" ? performerName.slice(0, 2).toUpperCase() : "?",
  );

  const sequence = $derived(performer?.loadedSequence ?? null);
  const sequenceWord = $derived(sequence?.word ?? sequence?.name ?? null);
  const sequenceBeats = $derived(sequence?.steps?.length ?? null);

  function pickAvatar(id: AvatarId) {
    performer?.setAvatarModel(id);
  }

  // ─── Inline name editing (input-swap pattern, mirrors TrackHeader) ───
  let isEditingName = $state(false);
  let nameDraft = $state("");
  let nameInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (isEditingName && nameInput) {
      nameInput.focus();
      nameInput.select();
    }
  });

  function startEditName() {
    if (!performer) return;
    nameDraft = performerName === "—" ? "" : performerName;
    isEditingName = true;
  }
  function commitName() {
    if (!isEditingName) return;
    performer?.setDisplayName(nameDraft);
    isEditingName = false;
  }
  function cancelEditName() {
    isEditingName = false;
  }
  function handleNameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditName();
    }
  }

  // ─── Tabs ───
  type HubTab = "prop" | "planes" | "effort" | "effects" | "avatar" | "sequence";
  let activeTab = $state<HubTab>("prop");

  const ALL_TABS: { id: HubTab; label: string; icon: string }[] = [
    { id: "avatar", label: "Avatar", icon: "fa-user" },
    { id: "sequence", label: "Seq", icon: "fa-film" },
    { id: "prop", label: "Prop", icon: "fa-shapes" },
    { id: "planes", label: "Planes", icon: "fa-layer-group" },
    { id: "effort", label: "Effort", icon: "fa-gauge-high" },
    { id: "effects", label: "FX", icon: "fa-wand-sparkles" },
  ];

  const GLOBAL_TABS: { id: HubTab; label: string; icon: string }[] = [
    { id: "prop", label: "Prop", icon: "fa-shapes" },
    { id: "planes", label: "Planes", icon: "fa-layer-group" },
    { id: "effort", label: "Effort", icon: "fa-gauge-high" },
    { id: "effects", label: "FX", icon: "fa-wand-sparkles" },
  ];

  const TABS = $derived(isAllMode ? GLOBAL_TABS : ALL_TABS);
  const tabIndex = $derived(TABS.findIndex((t) => t.id === activeTab));

  $effect(() => {
    if (isAllMode && (activeTab === "avatar" || activeTab === "sequence")) {
      activeTab = "prop";
    }
  });

  function handleTabKeydown(e: KeyboardEvent) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (tabIndex + dir + TABS.length) % TABS.length;
    const nextTab = TABS[next];
    if (nextTab) {
      activeTab = nextTab.id;
      const btn = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`#hub-tab-${nextTab.id}`);
      btn?.focus();
    }
  }

  // ─── Prop ───
  const currentProp = $derived(
    performer?.effectiveProp ?? viewer.defaultSettings.prop,
  );
  const propCategories = $derived(getBasePropsByCategory());
  const selectedBase = $derived(getBasePropType(currentProp));
  let expandedFamily = $state<PropType | null>(null);
  const familyVariants = $derived(
    expandedFamily
      ? getAllVariations(expandedFamily).filter(isPropActive)
      : [],
  );

  function applyToScope(fn: (p: typeof performer) => void) {
    if (isAllMode) {
      for (const p of allPerformers) fn(p);
    } else {
      fn(performer);
    }
  }

  function handleFamilyClick(base: PropType) {
    const activeVariants = getAllVariations(base).filter(isPropActive);
    if (activeVariants.length <= 1) {
      applyToScope((p) => p?.setProp(base));
      expandedFamily = null;
    } else {
      expandedFamily = base;
    }
  }

  function handleVariantClick(variant: PropType) {
    applyToScope((p) => p?.setProp(variant));
  }

  // ─── Effort ───
  const currentEffort = $derived(
    performer?.effectiveEffortId ?? viewer.defaultSettings.effortId,
  );

  function handleEffortSelect(effortId: EffortId) {
    applyToScope((p) => p?.setEffort(effortId));
  }

  function handlePropSizeChange(cm: number) {
    applyToScope((p) => p?.setStaffLengthCm(cm));
  }
</script>

  <div
    class="hub-detail"
    style:--performer-color={performerColor}
    style:--pop-accent={performerColor}
  >
    <div class="accent-strip" aria-hidden="true"></div>

    <!-- ─── Header (compact identity) ─── -->
    <div class="header">
      {#if isAllMode}
        <div class="identity">
          <div class="avatar-circle all-mode" aria-hidden="true">
            <i class="fas fa-users"></i>
          </div>
          <div class="identity-meta">
            <span class="performer-name">All Performers</span>
            <div class="sub-row">
              <span class="badge" style:background-color={performerColor}>{allPerformers.length}</span>
              <span class="all-hint">Changes apply to everyone</span>
            </div>
          </div>
        </div>
      {:else if performer !== null}
        <div class="identity">
          <div class="avatar-circle" aria-hidden="true">
            <span class="avatar-initials">{avatarInitials}</span>
          </div>
          <div class="identity-meta">
            {#if isEditingName}
              <input
                bind:this={nameInput}
                class="name-input"
                bind:value={nameDraft}
                onblur={commitName}
                onkeydown={handleNameKeydown}
                maxlength="24"
                placeholder={avatarDef?.name ?? "Name"}
                aria-label="Performer name"
              />
            {:else}
              <button
                class="performer-name-btn"
                onclick={startEditName}
                title="Click to rename"
              >
                <span class="performer-name">{performerName}</span>
                <i class="fas fa-pen edit-hint" aria-hidden="true"></i>
              </button>
            {/if}
            <div class="sub-row">
              {#if sequenceWord}
                <span class="seq-chip">{sequenceWord}</span>
                <span class="seq-dot" aria-hidden="true">·</span>
              {/if}
              {#if sequenceBeats !== null}
                <span class="seq-beats">{sequenceBeats} beats</span>
              {:else}
                <span class="seq-beats muted">No sequence</span>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="header-divider" aria-hidden="true"></div>

    <!-- ─── Tab panes ─── -->
    <div class="tab-content">
      {#if !isAllMode && activeTab === "avatar"}
        <div id="hub-panel-avatar" class="tab-pane active" role="tabpanel" aria-labelledby="hub-tab-avatar">
          <div class="avatar-section">
            <div class="section-label">Select Avatar</div>
            <div class="avatar-grid" role="radiogroup" aria-label="Select avatar">
              {#each AVATAR_DEFINITIONS as def (def.id)}
                <button
                  class="avatar-card"
                  class:selected={performer?.avatarModelId === def.id}
                  class:has-thumb={loadedThumbs.has(def.id)}
                  role="radio"
                  aria-checked={performer?.avatarModelId === def.id}
                  onclick={() => pickAvatar(def.id as AvatarId)}
                  title={def.description}
                >
                  <i
                    class="fas {def.icon ?? 'fa-user'} avatar-fallback-icon"
                    class:hidden={loadedThumbs.has(def.id)}
                    aria-hidden="true"
                  ></i>
                  <img
                    class="avatar-thumb"
                    class:loaded={loadedThumbs.has(def.id)}
                    src={avatarThumbUrl(def.id)}
                    alt=""
                    loading="lazy"
                    onload={() => loadedThumbs.add(def.id)}
                  />
                  <span class="avatar-card-name">{def.name}</span>
                </button>
              {/each}
            </div>
            {#if canRemove}
              <button
                class="remove-btn"
                onclick={() => viewer.removePerformerFromUI()}
              >
                <i class="fas fa-trash-alt" aria-hidden="true"></i>
                <span>Remove Performer</span>
              </button>
            {/if}
          </div>
        </div>
      {/if}

      {#if !isAllMode && activeTab === "sequence"}
        <div id="hub-panel-sequence" class="tab-pane active" role="tabpanel" aria-labelledby="hub-tab-sequence">
          <div class="sequence-section">
            {#if sequence}
              <div class="seq-display">
                <div class="seq-word-large">{sequenceWord ?? "Untitled sequence"}</div>
                {#if sequenceBeats !== null}
                  <div class="seq-beat-count">{sequenceBeats} beats</div>
                {/if}
              </div>
              <button
                class="seq-action-btn"
                onclick={() => performer?.clearSequence()}
              >
                <i class="fas fa-times" aria-hidden="true"></i>
                <span>Clear Sequence</span>
              </button>
            {:else}
              <div class="seq-empty">
                <i class="fas fa-film" aria-hidden="true"></i>
                <span>No sequence loaded</span>
                <span class="seq-hint">Load a sequence from the library to animate this performer</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if activeTab === "prop"}
        <div id="hub-panel-prop" class="tab-pane active" role="tabpanel" aria-labelledby="hub-tab-prop">
          <div class="prop-section">
            <div class="prop-grid">
              {#each PROP_CATEGORIES as cat}
                {@const bases = propCategories.get(cat.id) ?? []}
                {#each bases as base}
                  {@const info = getPropTypeDisplayInfo(base)}
                  {@const isSelected =
                    expandedFamily !== null
                      ? expandedFamily === base
                      : selectedBase === base}
                  <button
                    class="prop-tile"
                    class:selected={isSelected}
                    aria-pressed={isSelected}
                    aria-label={info.label}
                    title={info.label}
                    onclick={() => handleFamilyClick(base)}
                  >
                    <PropCompositionPreview
                      propType={base}
                      size={28}
                      darkBackground
                    />
                  </button>
                {/each}
              {/each}
            </div>

            {#if expandedFamily && familyVariants.length > 1}
              <div class="variant-strip">
                <span class="variant-header"
                  >{getPropTypeDisplayInfo(expandedFamily).label}</span
                >
                <div class="variant-row">
                  {#each familyVariants as variant}
                    {@const vInfo = getPropTypeDisplayInfo(variant)}
                    <button
                      class="variant-chip"
                      class:selected={currentProp === variant}
                      aria-pressed={currentProp === variant}
                      onclick={() => handleVariantClick(variant)}
                    >
                      <div class="variant-icon">
                        <PropCompositionPreview
                          propType={variant}
                          size={22}
                          darkBackground
                        />
                      </div>
                      <span>{vInfo.label}</span>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            {#if performer}
              <PerformerPropSizeSlider {performer} />
            {:else if allPerformers[0]}
              <PerformerPropSizeSlider performer={allPerformers[0]} onSizeChange={handlePropSizeChange} />
            {/if}
          </div>
        </div>
      {/if}

      {#if activeTab === "planes"}
        <div id="hub-panel-planes" class="tab-pane active" role="tabpanel" aria-labelledby="hub-tab-planes">
          <div class="planes-section">
            <PlanesPopover />
          </div>
        </div>
      {/if}

      {#if activeTab === "effort"}
        <div id="hub-panel-effort" class="tab-pane active" role="tabpanel" aria-labelledby="hub-tab-effort">
          <div class="effort-section">
            <EffortPalette
              selectedEffort={currentEffort}
              onSelect={handleEffortSelect}
            />
          </div>
        </div>
      {/if}

      {#if activeTab === "effects"}
        <div id="hub-panel-effects" class="tab-pane active" role="tabpanel" aria-labelledby="hub-tab-effects">
          <div class="effects-section">
            <EffectsSettingsPanel
              performer={isAllMode ? null : performer}
              performers={isAllMode ? allPerformers : null}
            />
          </div>
        </div>
      {/if}
    </div>

    <div class="tab-divider" aria-hidden="true"></div>

    <!-- ─── Tab bar (bottom-anchored) ─── -->
    <div class="tab-bar" role="tablist" tabindex={0} style:--active-index={tabIndex} style:--tab-count={TABS.length} onkeydown={handleTabKeydown}>
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
          onclick={() => (activeTab = tab.id)}
        >
          <i class="fas {tab.icon}" aria-hidden="true"></i>
          <span class="tab-label">{tab.label}</span>
        </button>
      {/each}
    </div>
  </div>

<style>
  .hub-detail {
    width: 440px;
    display: flex;
    flex-direction: column;
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

  /* ─── Header ─── */
  .header {
    display: flex;
    align-items: center;
    padding: 12px 14px 8px;
    gap: 12px;
  }

  .identity {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  .avatar-circle {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    border: 2px solid var(--performer-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--performer-color) 14%, transparent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--performer-color) 20%, transparent);
  }

  .avatar-circle.all-mode {
    border-color: var(--theme-accent, #4a9eff);
    background: color-mix(in srgb, var(--theme-accent, #4a9eff) 14%, transparent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--theme-accent, #4a9eff) 20%, transparent);
    color: color-mix(in srgb, var(--theme-accent, #4a9eff) 60%, #ffffff);
    font-size: 14px;
  }

  .avatar-initials {
    font-size: 13px;
    font-weight: 800;
    color: var(--performer-color);
    line-height: 1;
    letter-spacing: 0.03em;
  }

  .all-hint {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
  }

  .identity-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .performer-name-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 4px 1px 0;
    margin: 0 0 1px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: text;
    min-width: 0;
    max-width: 100%;
    transition: background 140ms ease;
  }

  .performer-name-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .performer-name {
    font-size: 18px;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.98);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.15;
    letter-spacing: -0.01em;
  }

  .edit-hint {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.3);
    opacity: 0;
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: opacity 140ms ease;
  }

  .performer-name-btn:hover .edit-hint {
    opacity: 1;
  }

  .name-input {
    font-size: 18px;
    font-weight: 800;
    color: #fff;
    background: rgba(0, 0, 0, 0.3);
    border: 1.5px solid var(--performer-color);
    border-radius: 6px;
    padding: 1px 6px;
    margin: 0 0 1px;
    max-width: 100%;
    line-height: 1.15;
    letter-spacing: -0.01em;
    outline: none;
  }

  .sub-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .badge {
    padding: 1px 6px;
    border-radius: 4px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    color: rgba(0, 0, 0, 0.85);
    line-height: 1.3;
  }

  .seq-chip {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .seq-dot {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.3);
  }

  .seq-beats {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: rgba(255, 255, 255, 0.55);
  }

  .seq-beats.muted {
    color: rgba(255, 255, 255, 0.3);
    font-style: italic;
  }

  /* ─── Dividers ─── */
  .header-divider {
    height: 1px;
    margin: 0 14px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--performer-color) 22%, transparent),
      rgba(255, 255, 255, 0.04)
    );
  }

  .tab-divider {
    height: 1px;
    margin: 0 14px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.06),
      rgba(255, 255, 255, 0.02)
    );
  }

  /* ─── Tab bar (6 columns) ─── */
  .tab-bar {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--tab-count, 6), 1fr);
    margin: 0 10px 8px;
    padding: 3px;
    background: rgba(0, 0, 0, 0.28);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.04);
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
      rgba(255, 255, 255, 0.09)
    );
    box-shadow:
      0 1px 4px rgba(0, 0, 0, 0.3),
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
    padding: 8px 0;
    border-radius: 7px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.68);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition:
      color 200ms ease,
      transform 140ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .tab-btn:hover:not(.active) {
    color: rgba(255, 255, 255, 0.92);
  }

  .tab-btn.active {
    color: var(--performer-color);
  }

  .tab-btn i {
    font-size: 11px;
  }

  .tab-label {
    letter-spacing: 0.02em;
  }

  /* ─── Tab content ─── */
  .tab-content {
    padding: 12px 14px 14px;
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
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 8px;
  }

  /* ─── Avatar tab ─── */
  .avatar-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .avatar-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .avatar-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 4px;
    min-height: 56px;
    background: rgba(255, 255, 255, 0.04);
    border: 1.5px solid transparent;
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    overflow: hidden;
    position: relative;
    transition:
      background 140ms ease,
      border-color 140ms ease,
      color 140ms ease,
      transform 160ms ease,
      box-shadow 200ms ease;
  }

  .avatar-card.has-thumb {
    padding: 0;
    min-height: 72px;
    justify-content: flex-end;
  }

  .avatar-fallback-icon.hidden {
    display: none;
  }

  .avatar-thumb {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    /* Hidden until a real onload fires, so a 404 never shows a broken glyph. */
    opacity: 0;
    transition: opacity 160ms ease;
  }

  .avatar-thumb.loaded {
    opacity: 0.75;
  }

  .avatar-card.has-thumb:hover .avatar-thumb,
  .avatar-card.has-thumb.selected .avatar-thumb {
    opacity: 1;
  }

  .avatar-card.has-thumb .avatar-card-name {
    position: relative;
    z-index: 1;
    padding: 2px 6px 4px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    width: 100%;
    text-align: center;
  }

  .avatar-card:hover {
    background: color-mix(in srgb, var(--performer-color) 10%, transparent);
    border-color: color-mix(in srgb, var(--performer-color) 25%, transparent);
    color: white;
    transform: scale(1.04);
  }

  .avatar-card.selected {
    background: color-mix(in srgb, var(--performer-color) 22%, transparent);
    border-color: color-mix(in srgb, var(--performer-color) 55%, transparent);
    color: var(--performer-color);
    box-shadow: 0 0 12px color-mix(in srgb, var(--performer-color) 20%, transparent);
  }

  .avatar-card.has-thumb.selected {
    border-color: var(--performer-color);
    box-shadow:
      0 0 12px color-mix(in srgb, var(--performer-color) 30%, transparent),
      inset 0 0 20px color-mix(in srgb, var(--performer-color) 15%, transparent);
  }

  .avatar-card i {
    font-size: 16px;
  }

  .avatar-card-name {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-align: center;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(220, 50, 50, 0.25);
    background: rgba(220, 50, 50, 0.06);
    color: rgba(220, 80, 80, 0.75);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 140ms ease,
      border-color 140ms ease,
      color 140ms ease;
  }

  .remove-btn:hover {
    background: rgba(220, 50, 50, 0.15);
    border-color: rgba(220, 50, 50, 0.5);
    color: rgba(240, 80, 80, 1);
  }

  .remove-btn i {
    font-size: 12px;
  }

  /* ─── Sequence tab ─── */
  .sequence-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .seq-display {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .seq-word-large {
    font-size: 22px;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.95);
    line-height: 1.2;
    word-break: break-word;
    letter-spacing: -0.01em;
  }

  .seq-beat-count {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.45);
  }

  .seq-action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.55);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    width: fit-content;
    transition:
      background 140ms ease,
      border-color 140ms ease,
      color 140ms ease;
  }

  .seq-action-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  .seq-action-btn i {
    font-size: 11px;
  }

  .seq-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 0;
    color: rgba(255, 255, 255, 0.3);
  }

  .seq-empty i {
    font-size: 24px;
    opacity: 0.4;
  }

  .seq-empty span {
    font-size: 13px;
    font-weight: 600;
  }

  .seq-hint {
    font-size: var(--font-size-compact, 12px) !important;
    font-weight: 400 !important;
    color: rgba(255, 255, 255, 0.2) !important;
    text-align: center;
    max-width: 280px;
    line-height: 1.4;
  }

  /* ─── Prop tab ─── */
  .prop-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .prop-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
    gap: 5px;
  }

  .prop-tile {
    aspect-ratio: 1;
    background: rgba(0, 0, 0, 0.25);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    min-height: 44px;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      transform 200ms cubic-bezier(0.2, 0, 0.13, 1.5),
      box-shadow 200ms ease;
  }

  .prop-tile:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.25);
    transform: scale(1.08);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .prop-tile.selected {
    border-color: var(--pop-accent);
    border-width: 2px;
    background: color-mix(in srgb, var(--pop-accent) 15%, rgba(0, 0, 0, 0.3));
    box-shadow: 0 0 14px color-mix(in srgb, var(--pop-accent) 25%, transparent);
  }

  .variant-strip {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .variant-header {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.4);
  }

  .variant-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .variant-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px 4px 4px;
    background: rgba(0, 0, 0, 0.25);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.65);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    transition:
      border-color 150ms,
      color 150ms,
      background 150ms,
      box-shadow 200ms;
  }

  .variant-chip:hover {
    border-color: rgba(255, 255, 255, 0.28);
    color: white;
  }

  .variant-chip.selected {
    border-color: var(--pop-accent);
    border-width: 2px;
    background: color-mix(in srgb, var(--pop-accent) 15%, rgba(0, 0, 0, 0.3));
    color: white;
    box-shadow: 0 0 10px color-mix(in srgb, var(--pop-accent) 18%, transparent);
  }

  .variant-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ─── Planes tab ─── */
  .planes-section :global(.cascade-badge) {
    display: none;
  }

  /* ─── Effort tab ─── */
  .effort-section {
    --theme-stroke: rgba(255, 255, 255, 0.1);
    --theme-card-bg: rgba(255, 255, 255, 0.04);
    --theme-text-dim: rgba(255, 255, 255, 0.55);
    --theme-text: white;
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
    --theme-panel-bg: rgba(255, 255, 255, 0.04);
    --theme-stroke: rgba(255, 255, 255, 0.1);
    --theme-stroke-strong: rgba(255, 255, 255, 0.2);
    --theme-text: white;
    --theme-text-dim: rgba(255, 255, 255, 0.55);
    --min-touch-target: 40px;
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
    order: 10;
  }

  .effects-section :global(.sub-control),
  .effects-section :global(.intensity-control),
  .effects-section :global(.active-count) {
    margin-top: 0;
  }

  /* ─── Focus-visible ─── */
  button:focus-visible {
    outline: 2px solid var(--performer-color, #4a9eff);
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
</style>
