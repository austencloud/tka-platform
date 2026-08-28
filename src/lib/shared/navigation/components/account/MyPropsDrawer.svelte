<!-- Two-step editor for prop skills and the optional featured profile skill. -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import {
    getLegacyProfileProps,
    getProfilePropFamily,
    getProfilePropFamilyByRepresentative,
    getProfilePropLabel,
    normalizeProfileSelection,
    normalizeProfileSkill,
    normalizeProfileSkills,
    removeProfileProp,
    toggleProfileSkill,
  } from "$lib/shared/community/domain/profile-prop-catalog";
  import type { PropPreferenceState } from "$lib/shared/community/state/prop-preference-state.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import { tryGetAccountSetupContext } from "$lib/shared/onboarding/context/account-setup-context";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import ProfilePropPicker from "./ProfilePropPicker.svelte";
  import PropFamilyGrid from "./PropFamilyGrid.svelte";
  import SelectionFooterBar from "./SelectionFooterBar.svelte";

  interface Props {
    isOpen: boolean;
    propState: PropPreferenceState;
    onclose: () => void;
  }

  let { isOpen = $bindable(), propState, onclose }: Props = $props();
  let step = $state<"props" | "profile-prop">("props");
  let draftProps = $state<PropType[]>([]);
  let draftProfileProp = $state<PropType | null>(null);
  let activeFamily = $state<PropType | null>(null);
  let submitting = $state(false);
  let saveFailed = $state(false);
  let editorContentElement = $state<HTMLElement | null>(null);
  let wasOpen = false;
  const accountSetupState = tryGetAccountSetupContext();

  const legacyProps = $derived(getLegacyProfileProps(draftProps));
  const profilePropChoices = $derived(normalizeProfileSkills(draftProps));
  const primaryLabel = $derived(
    step === "profile-prop"
      ? "Save"
      : profilePropChoices.length > 1
        ? "Continue"
        : "Done"
  );

  function resetDraft(): void {
    draftProps = normalizeProfileSelection(propState.propsISpinWith);
    const normalizedFavorite = propState.favoriteProp
      ? normalizeProfileSkill(propState.favoriteProp)
      : null;
    draftProfileProp =
      normalizedFavorite && draftProps.includes(normalizedFavorite)
        ? normalizedFavorite
        : null;
    const initialFamily = getProfilePropFamily(
      draftProfileProp ?? draftProps[0]
    );
    activeFamily =
      initialFamily && initialFamily.choices.length > 1
        ? initialFamily.representative
        : null;
    step = "props";
    saveFailed = false;
    propState.clearError();
    scrollEditorToTop();
  }

  function scrollEditorToTop(): void {
    requestAnimationFrame(() => {
      editorContentElement?.parentElement?.scrollTo({ top: 0 });
    });
  }

  function showStep(nextStep: "props" | "profile-prop"): void {
    step = nextStep;
    scrollEditorToTop();
  }

  $effect(() => {
    if (isOpen && !wasOpen) resetDraft();
    wasOpen = isOpen;
  });

  function triggerHaptic(type: "selection" | "success" = "selection") {
    try {
      const haptic = getHapticFeedback() as HapticFeedback;
      haptic?.trigger(type);
    } catch {
      // Haptics are an enhancement and may not exist on this device.
    }
  }

  function noteDraftChange(): void {
    saveFailed = false;
    propState.clearError();
    triggerHaptic("selection");
  }

  function handleFamilySelect(representative: PropType): void {
    const family = getProfilePropFamilyByRepresentative(representative);
    if (!family) return;

    if (family.choices.length > 1) {
      activeFamily = representative;
      triggerHaptic("selection");
      return;
    }

    const skill = family.choices[0]?.prop;
    if (!skill) return;
    const removing = draftProps.includes(skill);
    draftProps = toggleProfileSkill(draftProps, skill);
    if (removing && draftProfileProp === skill) draftProfileProp = null;
    activeFamily = null;
    noteDraftChange();
  }

  function handleSkillToggle(prop: PropType): void {
    const removing = draftProps.includes(prop);
    draftProps = toggleProfileSkill(draftProps, prop);
    if (removing && draftProfileProp === prop) draftProfileProp = null;
    activeFamily = getProfilePropFamily(prop)?.representative ?? activeFamily;
    noteDraftChange();
  }

  function handleLegacyRemove(prop: PropType): void {
    draftProps = removeProfileProp(draftProps, prop);
    if (draftProfileProp === prop) draftProfileProp = null;
    noteDraftChange();
  }

  function handlePropsPrimary(): void {
    if (profilePropChoices.length === 0 || submitting) return;
    if (profilePropChoices.length === 1) {
      void persistDraft(null);
      return;
    }

    if (draftProfileProp && !draftProps.includes(draftProfileProp)) {
      draftProfileProp = null;
    }
    showStep("profile-prop");
    triggerHaptic("selection");
  }

  function handleProfilePropChoice(propType: PropType | null) {
    draftProfileProp = propType;
    noteDraftChange();
  }

  async function persistDraft(profileProp: PropType | null): Promise<void> {
    if (submitting || profilePropChoices.length === 0) return;
    submitting = true;
    saveFailed = false;
    let saved = false;
    try {
      await propState.saveProfileSelection(draftProps, profileProp);
      accountSetupState?.markPropsPresent(true);
      triggerHaptic("success");
      saved = true;
    } catch (error) {
      saveFailed = true;
      scrollEditorToTop();
      console.error("[MyPropsDrawer] Prop preferences save failed", error);
    } finally {
      submitting = false;
    }
    if (saved) closeModal();
  }

  async function reloadPreferences(): Promise<void> {
    await propState.reload();
    if (!propState.error) resetDraft();
  }

  function closeModal() {
    if (submitting) return;
    step = "props";
    isOpen = false;
    onclose();
  }
</script>

<BaseModal
  bind:open={isOpen}
  onclose={closeModal}
  size="fit"
  animation="pop"
  class="my-props-modal"
>
  {#snippet header()}
    <div class="modal-header">
      <span class="step-label">
        {step === "props" ? "Required · Step 1 of 2" : "Optional · Step 2 of 2"}
      </span>
      <h2 class="modal-title">
        {step === "props"
          ? "Which props do you spin?"
          : "Which skill should lead your profile?"}
      </h2>
      <p class="modal-description">
        {step === "props"
          ? "Choose the prop skills you practice. These appear on your public creator profile and support prop-based discovery."
          : "This only chooses the skill shown beside your name on creator cards. It does not change your full list or app features."}
      </p>
      <button
        type="button"
        class="close-button"
        onclick={closeModal}
        aria-label="Close prop editor"
        disabled={submitting}
      >
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
  {/snippet}

  <div class="prop-editor-content" bind:this={editorContentElement}>
    {#if propState.error}
      <div class="prop-error" role="alert">
        <span>{propState.error}</span>
        <button
          type="button"
          onclick={saveFailed
            ? () =>
                void persistDraft(
                  profilePropChoices.length === 1 ? null : draftProfileProp
                )
            : () => void reloadPreferences()}
          disabled={submitting || propState.loading}
        >
          {submitting || propState.loading
            ? "Working…"
            : saveFailed
              ? "Retry save"
              : "Reload"}
        </button>
      </div>
    {/if}

    {#if step === "props"}
      <PropFamilyGrid
        selectedProps={draftProps}
        {activeFamily}
        disabled={submitting || propState.loading}
        onselectfamily={handleFamilySelect}
        ontoggleskill={handleSkillToggle}
      />

      {#if legacyProps.length > 0}
        <section class="legacy-props" aria-labelledby="legacy-props-title">
          <span class="legacy-heading">
            <strong id="legacy-props-title">Previously saved</strong>
            <small>Kept for compatibility, but not offered during setup.</small>
          </span>
          <div class="legacy-list">
            {#each legacyProps as prop (prop)}
              <button
                type="button"
                class="legacy-chip"
                onclick={() => handleLegacyRemove(prop)}
                disabled={submitting}
                aria-label={`Remove previously saved ${getProfilePropLabel(prop)}`}
              >
                <span class="legacy-preview" aria-hidden="true">
                  <PropCompositionPreview
                    propType={prop}
                    size={32}
                    useSavedOverrides={false}
                  />
                </span>
                <span>{getProfilePropLabel(prop)}</span>
                <i class="fas fa-xmark" aria-hidden="true"></i>
              </button>
            {/each}
          </div>
        </section>
      {/if}
    {:else}
      <ProfilePropPicker
        selectedProps={profilePropChoices}
        value={draftProfileProp}
        disabled={submitting}
        onselect={handleProfilePropChoice}
      />
    {/if}
  </div>

  {#snippet footer()}
    <SelectionFooterBar
      selectedProps={profilePropChoices}
      saving={submitting}
      {primaryLabel}
      primaryDisabled={step === "props" && profilePropChoices.length === 0}
      onprimary={step === "props"
        ? handlePropsPrimary
        : () => void persistDraft(draftProfileProp)}
      onback={step === "profile-prop" ? () => showStep("props") : undefined}
    />
  {/snippet}
</BaseModal>

<style>
  :global(.my-props-modal) {
    width: min(94vw, 68rem) !important;
  }

  .modal-header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3rem;
    padding: 1rem 4.25rem 0.6rem 1rem;
  }

  .step-label {
    color: color-mix(in srgb, var(--theme-accent, #6366f1) 58%, white);
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .modal-title,
  .modal-description {
    margin: 0;
  }

  .modal-title {
    color: var(--theme-text, white);
    font-size: max(1.125rem, var(--font-size-lg, 1.125rem));
    font-weight: 700;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .modal-description {
    max-width: 54rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
    line-height: 1.45;
  }

  .prop-editor-content {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    padding-bottom: 0.75rem;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2))
      transparent;
  }

  .close-button {
    position: absolute;
    top: 0.85rem;
    right: 0.85rem;
    display: grid;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    place-items: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 0.65rem;
    cursor: pointer;
  }

  .close-button:hover:not(:disabled) {
    color: var(--theme-text, white);
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  .close-button:disabled {
    cursor: wait;
    opacity: 0.58;
  }

  .close-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .prop-error,
  .legacy-props {
    margin-inline: 0.5rem;
  }

  .prop-error {
    display: flex;
    min-height: var(--min-touch-target, 44px);
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.65rem 0.75rem;
    color: color-mix(in srgb, var(--semantic-error, #ef4444) 70%, white);
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 10%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    border-radius: 0.75rem;
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
  }

  .prop-error button {
    min-height: var(--min-touch-target, 44px);
    flex: 0 0 auto;
    padding: 0.55rem 0.85rem;
    color: var(--theme-text, white);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 0.55rem;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
  }

  .legacy-props {
    padding: 0.75rem;
    background: color-mix(in srgb, var(--theme-text) 3%, transparent);
    border: 1px dashed var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 0.85rem;
  }

  .legacy-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .legacy-heading strong {
    color: var(--theme-text, white);
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
  }

  .legacy-heading small {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
  }

  .legacy-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.6rem;
  }

  .legacy-chip {
    display: inline-flex;
    min-height: var(--min-touch-target, 44px);
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.65rem;
    color: var(--theme-text, white);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
    font-weight: 650;
  }

  .legacy-preview {
    display: grid;
    width: 1.75rem;
    height: 1.75rem;
    place-items: center;
  }

  .legacy-preview :global(.prop-composition-preview) {
    width: 100%;
    height: 100%;
  }

  @media (max-width: 520px) {
    .legacy-heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.2rem;
    }
  }

  @media (min-width: 1680px) {
    :global(.my-props-modal) {
      width: min(86vw, 96rem) !important;
    }
  }

  @media (min-width: 2300px) and (min-height: 45rem) {
    :global(.my-props-modal) {
      width: 78vw !important;
    }

    .modal-header {
      gap: 0.5rem;
      padding: 2rem 6rem 1rem 2rem;
    }

    .step-label {
      font-size: 1.125rem;
    }

    .modal-title {
      font-size: 2.25rem;
    }

    .modal-description,
    .prop-error,
    .legacy-heading strong {
      font-size: 1.375rem;
    }

    .legacy-heading small,
    .legacy-chip {
      font-size: 1.125rem;
    }

    .close-button {
      top: 1.75rem;
      right: 2rem;
      width: 4rem;
      height: 4rem;
      font-size: 1.5rem;
    }
  }
</style>
