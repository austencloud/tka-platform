<script lang="ts">
  import { getFestivalContext } from "../../context/festival-context";
  import { auth } from "$lib/shared/auth/firebase";
  import type {
    TeachingPortfolio,
    WorkshopTemplate,
    WorkshopLevel,
  } from "../../domain/models/teaching-portfolio";
  import { AUSTEN_PORTFOLIO_SEED } from "../../data/portfolio-seed";
  import WorkshopTemplateCard from "./WorkshopTemplateCard.svelte";
  import BioEditor from "./BioEditor.svelte";

  const { state: festivalState } = getFestivalContext();

  // ─── Workshop inline form ───────────────────────────────────────────────────
  let showWorkshopForm = $state(false);
  let editingWorkshopId = $state<string | null>(null);

  // Form fields
  let wTitle = $state("");
  let wLevel = $state<WorkshopLevel>("beginner");
  let wPropsRaw = $state("");
  let wDescription = $state("");
  let wSolo = $state(true);

  const LEVELS: WorkshopLevel[] = ["introductory", "beginner", "intermediate", "advanced", "mixed"];

  function openNewWorkshopForm() {
    editingWorkshopId = null;
    wTitle = "";
    wLevel = "beginner";
    wPropsRaw = "";
    wDescription = "";
    wSolo = true;
    showWorkshopForm = true;
  }

  function openEditWorkshopForm(workshop: WorkshopTemplate) {
    editingWorkshopId = workshop.id;
    wTitle = workshop.title;
    wLevel = workshop.level;
    wPropsRaw = workshop.props.join(", ");
    wDescription = workshop.description;
    wSolo = workshop.solo;
    showWorkshopForm = true;
  }

  function cancelWorkshopForm() {
    showWorkshopForm = false;
    editingWorkshopId = null;
  }

  function saveWorkshopForm() {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio) return;

    const props = wPropsRaw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (editingWorkshopId) {
      const updated: TeachingPortfolio = {
        ...portfolio,
        classes: portfolio.classes.map((c) =>
          c.id === editingWorkshopId
            ? { ...c, title: wTitle, level: wLevel, props, description: wDescription, solo: wSolo }
            : c
        ),
      };
      festivalState.savePortfolio(uid, updated);
    } else {
      const newWorkshop: WorkshopTemplate = {
        id: crypto.randomUUID(),
        title: wTitle,
        level: wLevel,
        props,
        description: wDescription,
        themes: [],
        solo: wSolo,
      };
      const updated: TeachingPortfolio = {
        ...portfolio,
        classes: [...portfolio.classes, newWorkshop],
      };
      festivalState.savePortfolio(uid, updated);
    }

    cancelWorkshopForm();
  }

  function deleteWorkshop(workshopId: string) {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio) return;
    const updated: TeachingPortfolio = {
      ...portfolio,
      classes: portfolio.classes.filter((c) => c.id !== workshopId),
    };
    festivalState.savePortfolio(uid, updated);
  }

  // ─── Performance credits ────────────────────────────────────────────────────
  let newCredit = $state("");

  function addCredit() {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio || !newCredit.trim()) return;
    const updated: TeachingPortfolio = {
      ...portfolio,
      performanceCredits: [...portfolio.performanceCredits, newCredit.trim()],
    };
    festivalState.savePortfolio(uid, updated);
    newCredit = "";
  }

  function removeCredit(index: number) {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio) return;
    const credits = portfolio.performanceCredits.filter((_, i) => i !== index);
    festivalState.savePortfolio(uid, { ...portfolio, performanceCredits: credits });
  }

  // ─── Performance videos ─────────────────────────────────────────────────────
  let newVideo = $state("");

  function addVideo() {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio || !newVideo.trim()) return;
    const updated: TeachingPortfolio = {
      ...portfolio,
      performanceVideos: [...portfolio.performanceVideos, newVideo.trim()],
    };
    festivalState.savePortfolio(uid, updated);
    newVideo = "";
  }

  function removeVideo(index: number) {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio) return;
    const videos = portfolio.performanceVideos.filter((_, i) => i !== index);
    festivalState.savePortfolio(uid, { ...portfolio, performanceVideos: videos });
  }

  // ─── Social links & About — debounced auto-save ─────────────────────────────
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function debounceSave(updater: () => TeachingPortfolio) {
    const uid = auth.currentUser?.uid;
    if (!uid || !festivalState.portfolio) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const portfolio = festivalState.portfolio;
      if (!uid || !portfolio) return;
      festivalState.savePortfolio(uid, updater());
    }, 600);
  }

  // Social link fields — mirrors current portfolio when it loads
  let slWebsite = $state("");
  let slInstagram = $state("");
  let slFacebook = $state("");
  let slYoutube = $state("");
  let slTiktok = $state("");

  // About fields
  let aHomeCity = $state("");
  let aHomeCountry = $state("");
  let aYearsTeaching = $state(0);
  let aYearsPerforming = $state(0);
  let aInsuranceProvider = $state("");

  // Sync local fields whenever portfolio loads or changes
  $effect(() => {
    const p = festivalState.portfolio;
    if (!p) return;
    slWebsite = p.socialLinks.website ?? "";
    slInstagram = p.socialLinks.instagram ?? "";
    slFacebook = p.socialLinks.facebook ?? "";
    slYoutube = p.socialLinks.youtube ?? "";
    slTiktok = p.socialLinks.tiktok ?? "";
    aHomeCity = p.homeCity ?? "";
    aHomeCountry = p.homeCountry ?? "";
    aYearsTeaching = p.yearsTeaching ?? 0;
    aYearsPerforming = p.yearsPerforming ?? 0;
    aInsuranceProvider = p.insuranceInfo?.provider ?? "";
  });

  function handleSocialChange() {
    debounceSave(() => ({
      ...festivalState.portfolio!,
      socialLinks: {
        website: slWebsite || undefined,
        instagram: slInstagram || undefined,
        facebook: slFacebook || undefined,
        youtube: slYoutube || undefined,
        tiktok: slTiktok || undefined,
      },
    }));
  }

  function handleAboutChange() {
    debounceSave(() => ({
      ...festivalState.portfolio!,
      homeCity: aHomeCity,
      homeCountry: aHomeCountry,
      yearsTeaching: Number(aYearsTeaching) || 0,
      yearsPerforming: Number(aYearsPerforming) || 0,
      insuranceInfo: aInsuranceProvider
        ? { provider: aInsuranceProvider }
        : undefined,
    }));
  }

  // ─── Empty state / seed import ───────────────────────────────────────────────
  function importSeed() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const now = { toDate: () => new Date() } as unknown as import("firebase/firestore").Timestamp;
    const portfolio: TeachingPortfolio = {
      ...AUSTEN_PORTFOLIO_SEED,
      userId: uid,
      createdAt: now,
      updatedAt: now,
    };
    festivalState.savePortfolio(uid, portfolio);
  }
</script>

<div class="portfolio-editor">
  {#if !festivalState.portfolio}
    <!-- Empty state -->
    <div class="empty-state">
      <i class="fas fa-chalkboard-teacher empty-icon" aria-hidden="true"></i>
      <h3 class="empty-title">Set up your teaching portfolio</h3>
      <p class="empty-body">
        Add your workshops, bios, and performance history so festival organizers can find you.
      </p>
      <div class="empty-actions">
        <button
          class="primary-btn"
          onclick={() => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            const now = { toDate: () => new Date() } as unknown as import("firebase/firestore").Timestamp;
            festivalState.savePortfolio(uid, {
              userId: uid,
              classes: [],
              bios: [],
              performanceCredits: [],
              performanceVideos: [],
              socialLinks: {},
              homeCity: "",
              homeCountry: "",
              yearsTeaching: 0,
              yearsPerforming: 0,
              createdAt: now,
              updatedAt: now,
            });
          }}
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
          Start from scratch
        </button>
        <button class="secondary-btn" onclick={importSeed}>
          <i class="fas fa-file-import" aria-hidden="true"></i>
          Import sample portfolio
        </button>
      </div>
    </div>
  {:else}
    <div class="portfolio-grid">
    <!-- ── Workshops section ─────────────────────────────────────────────────── -->
    <section class="section-card workshops-card">
      <div class="section-header">
        <h3 class="section-title">Workshops</h3>
        <button
          class="add-btn"
          onclick={openNewWorkshopForm}
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
          Add Workshop
        </button>
      </div>

      {#if festivalState.portfolio.classes.length > 0}
        <div class="workshop-list">
          {#each festivalState.portfolio.classes as workshop (workshop.id)}
            <WorkshopTemplateCard
              {workshop}
              onclick={() => openEditWorkshopForm(workshop)}
            />
          {/each}
        </div>
      {:else if !showWorkshopForm}
        <p class="empty-section">No workshops yet.</p>
      {/if}
    </section>

    <!-- ── Bios section ──────────────────────────────────────────────────────── -->
    <section class="section-card">
      <div class="section-header">
        <h3 class="section-title">Bios</h3>
      </div>
      <BioEditor />
    </section>

    <!-- ── Performance credits ───────────────────────────────────────────────── -->
    <section class="section-card">
      <div class="section-header">
        <h3 class="section-title">Performance Credits</h3>
      </div>

      {#if festivalState.portfolio.performanceCredits.length > 0}
        <ul class="string-list" role="list">
          {#each festivalState.portfolio.performanceCredits as credit, i (i)}
            <li class="string-item">
              <span class="string-value">{credit}</span>
              <button
                class="remove-btn"
                onclick={() => removeCredit(i)}
                aria-label="Remove {credit}"
              >
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      <div class="add-row">
        <input
          class="add-input"
          type="text"
          bind:value={newCredit}
          placeholder="Add performance credit..."
          onkeydown={(e) => e.key === "Enter" && addCredit()}
        />
        <button class="add-inline-btn" onclick={addCredit} disabled={!newCredit.trim()}>
          Add
        </button>
      </div>
    </section>

    <!-- ── Performance videos ────────────────────────────────────────────────── -->
    <section class="section-card">
      <div class="section-header">
        <h3 class="section-title">Performance Videos</h3>
      </div>

      {#if festivalState.portfolio.performanceVideos.length > 0}
        <ul class="string-list" role="list">
          {#each festivalState.portfolio.performanceVideos as video, i (i)}
            <li class="string-item">
              <span class="string-value url">{video}</span>
              <button
                class="remove-btn"
                onclick={() => removeVideo(i)}
                aria-label="Remove video"
              >
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      <div class="add-row">
        <input
          class="add-input"
          type="url"
          bind:value={newVideo}
          placeholder="YouTube URL..."
          onkeydown={(e) => e.key === "Enter" && addVideo()}
        />
        <button class="add-inline-btn" onclick={addVideo} disabled={!newVideo.trim()}>
          Add
        </button>
      </div>
    </section>

    <!-- ── Social links ──────────────────────────────────────────────────────── -->
    <section class="section-card">
      <div class="section-header">
        <h3 class="section-title">Social Links</h3>
      </div>

      <div class="form-grid">
        <label class="field-label">
          Website
          <input
            class="field-input"
            type="text"
            bind:value={slWebsite}
            oninput={handleSocialChange}
            placeholder="yourwebsite.com"
          />
        </label>
        <label class="field-label">
          Instagram
          <input
            class="field-input"
            type="text"
            bind:value={slInstagram}
            oninput={handleSocialChange}
            placeholder="@handle"
          />
        </label>
        <label class="field-label">
          Facebook
          <input
            class="field-input"
            type="text"
            bind:value={slFacebook}
            oninput={handleSocialChange}
            placeholder="facebook.com/page"
          />
        </label>
        <label class="field-label">
          YouTube
          <input
            class="field-input"
            type="text"
            bind:value={slYoutube}
            oninput={handleSocialChange}
            placeholder="youtube.com/@channel"
          />
        </label>
        <label class="field-label">
          TikTok
          <input
            class="field-input"
            type="text"
            bind:value={slTiktok}
            oninput={handleSocialChange}
            placeholder="@handle"
          />
        </label>
      </div>
    </section>

    <!-- ── About ─────────────────────────────────────────────────────────────── -->
    <section class="section-card">
      <div class="section-header">
        <h3 class="section-title">About</h3>
      </div>

      <div class="form-grid">
        <label class="field-label">
          Home City
          <input
            class="field-input"
            type="text"
            bind:value={aHomeCity}
            oninput={handleAboutChange}
            placeholder="Chicago"
          />
        </label>
        <label class="field-label">
          Home Country
          <input
            class="field-input"
            type="text"
            bind:value={aHomeCountry}
            oninput={handleAboutChange}
            placeholder="USA"
          />
        </label>
        <label class="field-label">
          Years Teaching
          <input
            class="field-input"
            type="number"
            bind:value={aYearsTeaching}
            oninput={handleAboutChange}
            min="0"
          />
        </label>
        <label class="field-label">
          Years Performing
          <input
            class="field-input"
            type="number"
            bind:value={aYearsPerforming}
            oninput={handleAboutChange}
            min="0"
          />
        </label>
        <label class="field-label">
          Insurance Provider
          <input
            class="field-input"
            type="text"
            bind:value={aInsuranceProvider}
            oninput={handleAboutChange}
            placeholder="e.g. Specialty Insurance Agency"
          />
        </label>
      </div>
    </section>
    </div>
  {/if}
</div>

{#if showWorkshopForm}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="workshop-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label={editingWorkshopId ? "Edit Workshop" : "New Workshop"}
    onclick={(e) => { if (e.target === e.currentTarget) cancelWorkshopForm(); }}
    onkeydown={(e) => { if (e.key === "Escape") cancelWorkshopForm(); }}
    tabindex="-1"
  >
    <div class="workshop-modal">
      <div class="workshop-modal-header">
        <h3 class="workshop-modal-title">
          {editingWorkshopId ? "Edit Workshop" : "New Workshop"}
        </h3>
        <button class="workshop-modal-close" onclick={cancelWorkshopForm} aria-label="Close">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <div class="workshop-modal-body">
        <label class="field-label">
          Title
          <input
            class="field-input"
            type="text"
            bind:value={wTitle}
            placeholder="Workshop title"
          />
        </label>

        <label class="field-label">
          Level
          <div class="level-toggle-row">
            {#each LEVELS as level (level)}
              <button
                class="level-btn"
                class:active={wLevel === level}
                onclick={() => (wLevel = level)}
                type="button"
              >
                {level}
              </button>
            {/each}
          </div>
        </label>

        <label class="field-label">
          Props (comma-separated)
          <input
            class="field-input"
            type="text"
            bind:value={wPropsRaw}
            placeholder="double-staves, clubs"
          />
        </label>

        <label class="field-label">
          Description
          <textarea
            class="field-textarea"
            bind:value={wDescription}
            rows={6}
            placeholder="What you teach in this workshop..."
          ></textarea>
        </label>

        <label class="field-label solo-label">
          <div class="toggle-row">
            <span>Solo workshop</span>
            <button
              class="toggle-indicator"
              class:on={wSolo}
              onclick={() => (wSolo = !wSolo)}
              type="button"
              role="switch"
              aria-checked={wSolo}
              aria-label="Solo workshop"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>
        </label>
      </div>

      <div class="workshop-modal-footer">
        {#if editingWorkshopId}
          <button
            class="modal-action-btn"
            onclick={() => navigator.clipboard.writeText(wDescription)}
            title="Copy description to clipboard"
            type="button"
          >
            <i class="fas fa-copy" aria-hidden="true"></i>
            Copy
          </button>
          <button
            class="modal-action-btn danger"
            onclick={() => { deleteWorkshop(editingWorkshopId!); cancelWorkshopForm(); }}
            title="Delete this workshop"
            type="button"
          >
            <i class="fas fa-trash" aria-hidden="true"></i>
            Delete
          </button>
        {/if}
        <div class="modal-footer-spacer"></div>
        <button class="cancel-btn" onclick={cancelWorkshopForm}>Cancel</button>
        <button class="save-btn" onclick={saveWorkshopForm} disabled={!wTitle.trim()}>
          {editingWorkshopId ? "Save Changes" : "Add Workshop"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .portfolio-editor {
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .portfolio-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
    gap: 1.25rem;
    padding: 1.25rem;
  }

  /* ─── Empty state ─────────────────────────────────────────────────────────── */

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 48px 24px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    color: var(--theme-accent, #6366f1);
    opacity: 0.5;
  }

  .empty-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .empty-body {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    max-width: 360px;
    line-height: 1.6;
  }

  .empty-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .primary-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 6px;
    color: #fff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
  }

  .primary-btn:hover {
    opacity: 0.85;
  }

  .secondary-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: 6px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
  }

  .secondary-btn:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  /* ─── Sections ────────────────────────────────────────────────────────────── */

  .section-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .workshops-card {
    grid-column: 1 / -1;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .section-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .empty-section {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.45));
    font-style: italic;
  }

  /* ─── Add button ──────────────────────────────────────────────────────────── */

  .add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
    border-radius: 8px;
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: background var(--transition-fast, 0.15s);
  }

  .add-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .add-btn:not(:disabled):hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  /* ─── Workshop modal ──────────────────────────────────────────────────────── */

  .workshop-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .workshop-modal {
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
  }

  .workshop-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .workshop-modal-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .workshop-modal-close {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: 14px;
    transition: background 0.15s, color 0.15s;
  }

  .workshop-modal-close:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .workshop-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .workshop-modal-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .modal-footer-spacer {
    flex: 1;
  }

  .modal-action-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: color var(--transition-fast, 0.15s), border-color var(--transition-fast, 0.15s);
  }

  .modal-action-btn:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  .modal-action-btn.danger:hover {
    color: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-weight: 500;
  }

  .field-input,
  .field-textarea {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    padding: 7px 10px;
    font-family: inherit;
  }

  .field-input:focus,
  .field-textarea:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
  }

  .field-textarea {
    resize: vertical;
    line-height: 1.5;
  }

  .level-toggle-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .level-btn {
    padding: 4px 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
    background: none;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    text-transform: capitalize;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .level-btn.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: #fff;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .solo-label {
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
  }

  .toggle-indicator {
    width: 36px;
    height: 20px;
    border-radius: 10px;
    border: none;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .toggle-indicator.on {
    background: var(--theme-accent, #6366f1);
  }

  .toggle-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.2s;
  }

  .toggle-indicator.on .toggle-knob {
    transform: translateX(16px);
  }

  .form-actions {
    display: flex;
    gap: 8px;
  }

  .save-btn {
    padding: 7px 18px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 5px;
    color: #fff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
  }

  .save-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .save-btn:not(:disabled):hover {
    opacity: 0.85;
  }

  .cancel-btn {
    padding: 7px 18px;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
  }

  .cancel-btn:hover {
    color: var(--theme-text, #ffffff);
  }

  /* ─── Workshop list ───────────────────────────────────────────────────────── */

  .workshop-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  /* ─── Editable string lists (credits, videos) ─────────────────────────────── */

  .string-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .string-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
  }

  .string-value {
    flex: 1;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.8));
    min-width: 0;
    word-break: break-all;
  }

  .string-value.url {
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-compact, 12px);
  }

  .remove-btn {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
    cursor: pointer;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .remove-btn:hover {
    color: var(--semantic-error, #ef4444);
  }

  .remove-btn i {
    font-size: 11px;
  }

  .add-row {
    display: flex;
    gap: 8px;
  }

  .add-input {
    flex: 1;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    padding: 7px 10px;
  }

  .add-input:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
  }

  .add-inline-btn {
    padding: 7px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
  }

  .add-inline-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .add-inline-btn:not(:disabled):hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  /* ─── Social links & About form ───────────────────────────────────────────── */

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }
</style>
