<!-- FeedbackForm - Streamlined feedback form orchestrator -->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import type { IVoiceTranscriptCoordinator } from "../../services/contracts/IVoiceTranscriptCoordinator";
  import type { IFormDraftPersister } from "../../services/contracts/IFormDraftPersister";
  import type { IFeedbackTypeResolver } from "../../services/contracts/IFeedbackTypeResolver";
  import type { FeedbackSubmitState } from "../../state/feedback-submit-state.svelte";
  import { TYPE_CONFIG } from "../../domain/models/feedback-models";
  import type { FeedbackType } from "../../domain/models/feedback-models";
  import SuccessState from "./SuccessState.svelte";
  import TypeSelector from "./TypeSelector.svelte";
  import EncouragementHint from "./EncouragementHint.svelte";
  import FeedbackTextarea from "./FeedbackTextarea.svelte";
  import SubmitButton from "./SubmitButton.svelte";
  import Toast from "./Toast.svelte";
  import MobileInputToolbar from "./MobileInputToolbar.svelte";

  // Props
  const { formState, hideSuccessState = false, isInputMode = false, isTouchDevice: isTouchDeviceProp, onInputFocusChange, onKeyboardHeightChange } = $props<{
    formState: FeedbackSubmitState;
    hideSuccessState?: boolean;
    /** When true, form enters distraction-free input mode (mobile bottom sheet) */
    isInputMode?: boolean;
    /** When true, device uses touch input (hides keyboard hints like Shift+Enter) */
    isTouchDevice?: boolean;
    /** Called when textarea focus changes - used by parent to disable backdrop dismissal */
    onInputFocusChange?: (focused: boolean) => void;
    /** Called when keyboard height changes - used by parent to adjust panel padding */
    onKeyboardHeightChange?: (height: number) => void;
  }>();

  // Services
  const hapticService = container.items.hapticFeedback;
  const deviceDetector = container.items.deviceDetector;
  const voiceCoordinator = container.items.voiceTranscriptCoordinator;
  const draftPersister = container.items.formDraftPersister;
  const typeResolver = container.items.feedbackTypeResolver;

  // Component state - use prop if provided, otherwise detect
  let isTouchDeviceLocal = $state(false);
  const isTouchDevice = $derived(isTouchDeviceProp ?? isTouchDeviceLocal);
  let isMobileDevice = $state(false);
  let voiceTimeoutMessage = $state(false);
  let isTextareaFocused = $state(false);
  let textareaRef = $state<{ dismissKeyboard: () => void } | null>(null);

  onMount(() => {
    isMobileDevice = deviceDetector.isMobile();
    isTouchDeviceLocal = deviceDetector.isTouchDevice();

    // Restore draft if form is empty and a draft exists
    if (
      !formState.formData.description.trim() &&
      !formState.formData.title.trim()
    ) {
      const draft = draftPersister.loadDraft();
      if (draft) {
        formState.updateField("description", draft.formData.description);
        formState.updateField("title", draft.formData.title);
        formState.setType(draft.formData.type);
      }
    }
  });

  // Auto-save draft when form data changes
  $effect(() => {
    const description = formState.formData.description;
    const type = formState.formData.type;
    const title = formState.formData.title;

    if (draftPersister) {
      draftPersister.scheduleSave(formState.formData);
    }

    return () => {
      draftPersister?.cancelPendingSave();
    };
  });

  // Clear draft after successful submission
  $effect(() => {
    if (formState.submitStatus === "success" && draftPersister) {
      draftPersister.clearDraft();
    }
    return undefined;
  });

  // Derived: combine committed + interim for display
  const displayText = $derived(
    voiceCoordinator
      ? voiceCoordinator.getInterimText()
        ? `${formState.formData.description} ${voiceCoordinator.getInterimText()}`.trim()
        : formState.formData.description
      : formState.formData.description
  );

  function handleVoiceTranscript(transcript: string, isFinal: boolean) {
    if (!voiceCoordinator) return;

    if (isFinal) {
      const updatedText = voiceCoordinator.processFinalTranscript(
        transcript,
        formState.formData.description
      );
      formState.updateField("description", updatedText);
      hapticService?.trigger("selection");
    }
  }

  function handleInterimTranscript(transcript: string) {
    voiceCoordinator?.updateInterimText(transcript);
  }

  function handleRecordingEnd() {
    voiceCoordinator?.reset();
  }

  function handleVoiceTimeout() {
    voiceTimeoutMessage = true;
    hapticService?.trigger("warning");
    setTimeout(() => {
      voiceTimeoutMessage = false;
    }, 5000);
  }

  // When user manually types, clear interim and reset voice tracking
  function handleManualInput(value: string) {
    formState.updateField("description", value);
    voiceCoordinator?.reset();
  }

  function handleTypeChange(type: FeedbackType) {
    hapticService?.trigger("selection");
    formState.setType(type);
  }

  // Derived: current type configuration for dynamic theming
  const feedbackType = $derived(formState.formData.type);
  const currentTypeConfig = $derived(
    feedbackType && feedbackType in TYPE_CONFIG
      ? TYPE_CONFIG[feedbackType as keyof typeof TYPE_CONFIG]
      : undefined
  );

  const currentEncouragement = $derived(
    typeResolver && feedbackType
      ? typeResolver.getEncouragementMessage(feedbackType)
      : ""
  );

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    hapticService?.trigger("selection");
    await formState.submit();
  }

  function handleReset() {
    hapticService?.trigger("selection");
    formState.reset();
    voiceCoordinator?.reset();
  }

  function handleClearText() {
    hapticService?.trigger("selection");
    formState.updateField("description", "");
    formState.updateField("title", "");
    voiceCoordinator?.reset();
  }

  function handleKeydown(event: KeyboardEvent) {
    // Submit on Shift+Enter
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      if (formState.isFormValid && !formState.isSubmitting) {
        formState.submit();
        hapticService?.trigger("selection");
      }
    }
  }

  function handleTextareaFocusChange(focused: boolean) {
    isTextareaFocused = focused;
    onInputFocusChange?.(focused);
  }

  function handleMobileToolbarDone() {
    textareaRef?.dismissKeyboard();
    hapticService?.trigger("selection");
  }
</script>

{#if formState.submitStatus === "success" && !hideSuccessState}
  <SuccessState onSubmitAnother={handleReset} />
{:else}
  <form
    class="feedback-form"
    class:input-mode={isInputMode}
    onsubmit={handleSubmit}
    style="--active-type-color: {currentTypeConfig?.color ??
      'var(--theme-accent)'}"
  >
    <TypeSelector
      selectedType={formState.formData.type}
      onTypeChange={handleTypeChange}
      {isInputMode}
    />

    <EncouragementHint message={currentEncouragement} {isInputMode} />

    <FeedbackTextarea
      bind:this={textareaRef}
      value={displayText}
      error={formState.formErrors.description}
      placeholder={currentTypeConfig?.placeholder ??
        "Describe the issue, suggestion, or idea..."}
      isStreaming={(voiceCoordinator?.getInterimText()?.length ?? 0) > 0}
      isMobile={isMobileDevice}
      {isTouchDevice}
      draftStatus={draftPersister?.saveStatus}
      bind:images={formState.images}
      disabled={formState.isSubmitting}
      {isInputMode}
      onInput={handleManualInput}
      onKeydown={handleKeydown}
      onVoiceTranscript={handleVoiceTranscript}
      onInterimTranscript={handleInterimTranscript}
      onRecordingEnd={handleRecordingEnd}
      onVoiceTimeout={handleVoiceTimeout}
      onClearText={handleClearText}
      onFocusChange={handleTextareaFocusChange}
    />

    <!-- Full submit button - hidden in input mode -->
    {#if !isInputMode}
      <SubmitButton
        isSubmitting={formState.isSubmitting}
        disabled={formState.isSubmitting || !formState.isFormValid}
      />
    {/if}

    <!-- Status announcements for screen readers -->
    <div role="status" aria-live="assertive" aria-atomic="true">
      {#if formState.submitStatus === "error"}
        <Toast
          type="error"
          title="Submission failed"
          message="Please check your connection and try again."
          icon="fa-exclamation"
        />
      {/if}

      {#if voiceTimeoutMessage}
        <Toast
          type="info"
          title="Recording stopped"
          message="30 second silence limit reached. Click the mic to continue."
          icon="fa-microphone-slash"
        />
      {/if}
    </div>
  </form>

  <!-- Touch device keyboard toolbar - rendered outside form to position above keyboard -->
  <!-- Shows on any touch device (phone, tablet, Z Fold) not just narrow "mobile" -->
  {#if isTouchDevice}
    <MobileInputToolbar
      visible={isTextareaFocused}
      disabled={formState.isSubmitting}
      isFormValid={formState.isFormValid}
      isSubmitting={formState.isSubmitting}
      onDone={handleMobileToolbarDone}
      onSubmit={() => formState.submit()}
      onVoiceTranscript={handleVoiceTranscript}
      onInterimTranscript={handleInterimTranscript}
      onRecordingEnd={handleRecordingEnd}
      onVoiceTimeout={handleVoiceTimeout}
      {onKeyboardHeightChange}
    />
  {/if}
{/if}

<style>
  .feedback-form {
    /* Establish as container */
    container-type: inline-size;
    container-name: feedback-form;

    /* Layout - Fluid */
    position: relative;
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2.5cqi, 16px);
    width: 100%;
    padding: clamp(12px, 3cqi, 24px);
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: clamp(10px, 2cqi, 14px);
    transition: border-color var(--duration-normal) ease;
  }

  .feedback-form:hover {
    border-color: var(--theme-stroke-strong);
  }

  /* Input mode - form expands to fill available space */
  .feedback-form.input-mode {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0; /* Allow flex shrinking */
    overflow: hidden;
    border: none;
    background: transparent;
    padding: clamp(8px, 2cqi, 12px);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
