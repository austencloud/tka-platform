<script lang="ts">
  import { Timestamp } from "firebase/firestore";
  import { container } from "$lib/shared/di";
  import { auth } from "$lib/shared/auth/firebase";
  import { getFestivalContext } from "../../context/festival-context";

  // Destructure as festivalState to avoid conflict with Svelte 5 $state rune
  const { state: festivalState } = getFestivalContext();

  interface Props {
    onclose: () => void;
  }

  const { onclose }: Props = $props();

  // Services
  const submissionReviewer = container.items.festivalSubmissionReviewer;
  const geocodingService = container.items.geocodingService;

  // Form fields
  let name = $state("");
  let city = $state("");
  let country = $state("");
  let venue = $state("");
  let startDate = $state("");
  let endDate = $state("");
  let websiteUrl = $state("");
  let applicationUrl = $state("");
  let description = $state("");
  let tagsInput = $state("");
  let seekingInstructors = $state(false);
  let seekingPerformers = $state(false);

  // Form state
  let isSubmitting = $state(false);
  let submitError = $state("");
  let submitSuccess = $state(false);
  let validationErrors = $state<Record<string, string>>({});

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = "Festival name is required.";
    if (!city.trim()) errors.city = "City is required.";
    if (!country.trim()) errors.country = "Country is required.";
    if (!startDate) errors.startDate = "Start date is required.";
    if (!endDate) errors.endDate = "End date is required.";
    else if (endDate < startDate) errors.endDate = "End date must be after start date.";
    if (!websiteUrl.trim()) {
      errors.websiteUrl = "Website URL is required.";
    } else {
      try {
        new URL(websiteUrl.trim());
      } catch {
        errors.websiteUrl = "Enter a valid URL (include https://).";
      }
    }
    if (applicationUrl.trim()) {
      try {
        new URL(applicationUrl.trim());
      } catch {
        errors.applicationUrl = "Enter a valid URL (include https://).";
      }
    }

    validationErrors = errors;
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    submitError = "";
    if (!validate()) return;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      submitError = "You need to be signed in to submit a festival.";
      return;
    }

    isSubmitting = true;

    try {
      // Geocode the city + country into coordinates. Falls back to (0, 0) if
      // the Maps API key isn't configured — the moderator can correct it later.
      const coords = await geocodingService.forwardGeocode(city.trim(), country.trim())
        ?? { lat: 0, lng: 0 };

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await submissionReviewer.submit({
        name: name.trim(),
        city: city.trim(),
        country: country.trim(),
        venue: venue.trim() || undefined,
        dates: {
          start: Timestamp.fromDate(new Date(startDate)),
          end: Timestamp.fromDate(new Date(endDate)),
        },
        websiteUrl: websiteUrl.trim(),
        applicationUrl: applicationUrl.trim() || undefined,
        description: description.trim() || undefined,
        seekingInstructors,
        seekingPerformers,
        tags,
        submittedBy: uid,
        // Coordinates aren't part of FestivalSubmission but the form collects
        // them so the reviewer's approve() can use them in the future.
        // For now they're attached as extra metadata on the submission doc.
        ...({ coordinates: coords } as object),
      });

      submitSuccess = true;
    } catch (err) {
      submitError = err instanceof Error ? err.message : "Something went wrong. Try again.";
    } finally {
      isSubmitting = false;
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) onclose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") onclose();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="modal-backdrop"
  role="dialog"
  aria-modal="true"
  aria-labelledby="submit-festival-title"
  tabindex="-1"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
>
  <div class="modal-content">
    {#if submitSuccess}
      <div class="success-state">
        <div class="success-icon">
          <i class="fas fa-check-circle" aria-hidden="true"></i>
        </div>
        <h2 id="submit-festival-title">Festival submitted</h2>
        <p>Thanks — we'll review it and add it to the directory soon.</p>
        <button type="button" class="btn-primary" onclick={onclose}>Done</button>
      </div>
    {:else}
      <header class="modal-header">
        <h2 id="submit-festival-title">Submit a festival</h2>
        <button
          type="button"
          class="close-btn"
          onclick={onclose}
          aria-label="Close form"
        >
          <i class="fas fa-xmark" aria-hidden="true"></i>
        </button>
      </header>

      <div class="modal-body">
        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

          <!-- Name -->
          <div class="field">
            <label for="sf-name">Festival name <span class="required">*</span></label>
            <input
              id="sf-name"
              type="text"
              bind:value={name}
              placeholder="e.g. Fire Groove Festival"
              class:error={!!validationErrors.name}
            />
            {#if validationErrors.name}
              <span class="field-error">{validationErrors.name}</span>
            {/if}
          </div>

          <!-- City + Country -->
          <div class="field-row">
            <div class="field">
              <label for="sf-city">City <span class="required">*</span></label>
              <input
                id="sf-city"
                type="text"
                bind:value={city}
                placeholder="Portland"
                class:error={!!validationErrors.city}
              />
              {#if validationErrors.city}
                <span class="field-error">{validationErrors.city}</span>
              {/if}
            </div>

            <div class="field">
              <label for="sf-country">Country <span class="required">*</span></label>
              <input
                id="sf-country"
                type="text"
                bind:value={country}
                placeholder="USA"
                class:error={!!validationErrors.country}
              />
              {#if validationErrors.country}
                <span class="field-error">{validationErrors.country}</span>
              {/if}
            </div>
          </div>

          <!-- Venue (optional) -->
          <div class="field">
            <label for="sf-venue">Venue <span class="optional">(optional)</span></label>
            <input
              id="sf-venue"
              type="text"
              bind:value={venue}
              placeholder="e.g. Oaks Park"
            />
          </div>

          <!-- Dates -->
          <div class="field-row">
            <div class="field">
              <label for="sf-start">Start date <span class="required">*</span></label>
              <input
                id="sf-start"
                type="date"
                bind:value={startDate}
                class:error={!!validationErrors.startDate}
              />
              {#if validationErrors.startDate}
                <span class="field-error">{validationErrors.startDate}</span>
              {/if}
            </div>

            <div class="field">
              <label for="sf-end">End date <span class="required">*</span></label>
              <input
                id="sf-end"
                type="date"
                bind:value={endDate}
                class:error={!!validationErrors.endDate}
              />
              {#if validationErrors.endDate}
                <span class="field-error">{validationErrors.endDate}</span>
              {/if}
            </div>
          </div>

          <!-- Website URL -->
          <div class="field">
            <label for="sf-website">Website <span class="required">*</span></label>
            <input
              id="sf-website"
              type="url"
              bind:value={websiteUrl}
              placeholder="https://myfestival.com"
              class:error={!!validationErrors.websiteUrl}
            />
            {#if validationErrors.websiteUrl}
              <span class="field-error">{validationErrors.websiteUrl}</span>
            {/if}
          </div>

          <!-- Application URL (optional) -->
          <div class="field">
            <label for="sf-apply">Application URL <span class="optional">(optional)</span></label>
            <input
              id="sf-apply"
              type="url"
              bind:value={applicationUrl}
              placeholder="https://myfestival.com/apply"
              class:error={!!validationErrors.applicationUrl}
            />
            {#if validationErrors.applicationUrl}
              <span class="field-error">{validationErrors.applicationUrl}</span>
            {/if}
          </div>

          <!-- Description (optional) -->
          <div class="field">
            <label for="sf-desc">Description <span class="optional">(optional)</span></label>
            <textarea
              id="sf-desc"
              bind:value={description}
              rows="3"
              placeholder="A few sentences about the event, vibe, what to expect..."
            ></textarea>
          </div>

          <!-- Tags (optional) -->
          <div class="field">
            <label for="sf-tags">Tags <span class="optional">(optional, comma-separated)</span></label>
            <input
              id="sf-tags"
              type="text"
              bind:value={tagsInput}
              placeholder="fire, flow arts, poi, staves"
            />
          </div>

          <!-- Seeking toggles -->
          <div class="toggles-row">
            <button
              type="button"
              class="toggle-btn"
              class:active={seekingInstructors}
              onclick={() => (seekingInstructors = !seekingInstructors)}
              aria-pressed={seekingInstructors}
            >
              <i class="fas fa-chalkboard-teacher" aria-hidden="true"></i>
              Seeking instructors
            </button>

            <button
              type="button"
              class="toggle-btn"
              class:active={seekingPerformers}
              onclick={() => (seekingPerformers = !seekingPerformers)}
              aria-pressed={seekingPerformers}
            >
              <i class="fas fa-fire" aria-hidden="true"></i>
              Seeking performers
            </button>
          </div>

          {#if submitError}
            <div class="submit-error" role="alert">
              <i class="fas fa-circle-exclamation" aria-hidden="true"></i>
              {submitError}
            </div>
          {/if}

          <div class="form-actions">
            <button
              type="button"
              class="btn-secondary"
              onclick={onclose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-primary"
              disabled={isSubmitting}
            >
              {#if isSubmitting}
                <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
                Submitting…
              {:else}
                <i class="fas fa-paper-plane" aria-hidden="true"></i>
                Submit festival
              {/if}
            </button>
          </div>
        </form>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
    animation: fade-in 0.15s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .modal-content {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    overflow-y: auto;
    animation: slide-up 0.2s ease;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  @keyframes slide-up {
    from { transform: translateY(16px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  /* ---- Header ---- */

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    position: sticky;
    top: 0;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    z-index: 1;
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm, 6px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .close-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #ffffff);
  }

  /* ---- Body / form ---- */

  .modal-body {
    padding: 20px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
  }

  .required {
    color: var(--semantic-error, #ef4444);
  }

  .optional {
    color: var(--theme-text-tertiary, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-compact, 12px);
  }

  input[type="text"],
  input[type="url"],
  input[type="date"],
  textarea {
    width: 100%;
    padding: 9px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
    font-family: inherit;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }

  input[type="date"] {
    color-scheme: dark;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--theme-text-tertiary, rgba(255, 255, 255, 0.35));
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--theme-accent, #3b82f6);
  }

  input.error {
    border-color: var(--semantic-error, #ef4444);
  }

  textarea {
    resize: vertical;
    min-height: 72px;
  }

  .field-error {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-error, #ef4444);
  }

  /* ---- Seeking toggles ---- */

  .toggles-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 8px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .toggle-btn.active {
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 15%, transparent);
    border-color: var(--theme-accent, #3b82f6);
    color: var(--theme-accent, #3b82f6);
  }

  /* ---- Submit error ---- */

  .submit-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--radius-md, 8px);
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-min, 14px);
  }

  /* ---- Footer buttons ---- */

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 4px;
  }

  .btn-secondary,
  .btn-primary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: var(--radius-md, 8px);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 40px;
  }

  .btn-secondary {
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .btn-primary {
    background: var(--theme-accent, #3b82f6);
    border: none;
    color: #ffffff;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--theme-accent-hover, #2563eb);
  }

  .btn-secondary:disabled,
  .btn-primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* ---- Success state ---- */

  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 40px 24px;
    text-align: center;
  }

  .success-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(34, 197, 94, 0.12);
    border-radius: 50%;
    color: var(--semantic-success, #22c55e);
    font-size: 30px;
  }

  .success-state h2 {
    margin: 0;
    font-size: var(--font-size-xl, 20px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .success-state p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    max-width: 320px;
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-backdrop,
    .modal-content {
      animation: none;
    }
    *,
    *::before,
    *::after {
      transition-duration: 0.01ms !important;
    }
  }
</style>
