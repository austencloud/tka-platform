<!--
  TrainChallengeManager.svelte - Admin Train Challenge Management

  Admin interface for creating and managing train challenges.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { getTrainChallengeManager } from "$lib/features/train/get-train-challenge-manager";
  import type { TrainChallengeManager as TrainChallengeManagerService } from "$lib/features/train/services/train-challenge-manager";
  import type { TrainChallenge, TrainChallengeRequirementType } from "$lib/features/train/domain/models/train-challenge-models";
  import type { ChallengeDifficulty } from "$lib/shared/gamification/domain/models/achievement-models";
  import { PracticeMode } from "$lib/features/train/domain/enums/train-enums";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import { collection, addDoc, serverTimestamp } from "firebase/firestore";
  import { getTrainChallengesPath } from "$lib/shared/gamification/data/firestore-collections";
  import { SEED_CHALLENGES } from "$lib/features/train/data/seed-challenges";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import AdminModal from "$lib/shared/admin/components/AdminModal.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  // Services (resolved lazily to avoid module initialization errors)
  let challengeService: TrainChallengeManagerService | null = null;

  // State
  let challenges = $state<TrainChallenge[]>([]);
  let loading = $state(true);
  let showCreateForm = $state(false);
  let creating = $state(false);
  let seeding = $state(false);
  let showSeedModal = $state(false);

  // Form state
  let formData = $state({
    title: "",
    description: "",
    difficulty: "easy" as ChallengeDifficulty,
    xpReward: 100,
    bonusXP: 0,
    bonusCondition: "",
    requirementType: "complete_sequence" as TrainChallengeRequirementType,
    target: 1,
    mode: null as PracticeMode | null,
    isActive: true,
    order: 0,
  });

  onMount(async () => {
    challengeService = getTrainChallengeManager();
    await loadChallenges();
  });

  async function loadChallenges() {
    if (!challengeService) return;

    loading = true;
    try {
      challenges = await challengeService.getActiveChallenges();
    } catch (error) {
      console.error("Failed to load challenges:", error);
    } finally {
      loading = false;
    }
  }

  async function handleCreate() {
    if (!formData.title || !formData.description) {
      toast.error(t("admin_fill_required_fields"));
      return;
    }

    creating = true;

    try {
      const firestore = await getFirestoreInstance();
      const challengesPath = getTrainChallengesPath();
      const challengeData: Partial<TrainChallenge> = {
        title: formData.title,
        description: formData.description,
        difficulty: formData.difficulty,
        xpReward: formData.xpReward,
        bonusXP: formData.bonusXP || undefined,
        bonusCondition: formData.bonusCondition || undefined,
        requirement: {
          type: formData.requirementType,
          target: formData.target,
          metadata: formData.mode ? { mode: formData.mode } : undefined,
        },
        isActive: formData.isActive,
        order: formData.order,
        createdAt: new Date(),
      };

      await addDoc(collection(firestore, challengesPath), {
        ...challengeData,
        createdAt: serverTimestamp(),
      });

      toast.success(t("admin_challenge_scheduled"));
      resetForm();
      showCreateForm = false;
      await loadChallenges();
    } catch (error) {
      console.error("❌ Failed to create challenge:", error);
      toast.error(t("admin_create_challenge_failed"));
    } finally {
      creating = false;
    }
  }

  function resetForm() {
    formData = {
      title: "",
      description: "",
      difficulty: "easy" as ChallengeDifficulty,
      xpReward: 100,
      bonusXP: 0,
      bonusCondition: "",
      requirementType: "complete_sequence" as TrainChallengeRequirementType,
      target: 1,
      mode: null,
      isActive: true,
      order: challenges.length,
    };
  }

  function handleShowCreate() {
    resetForm();
    formData.order = challenges.length;
    showCreateForm = true;
  }

  function handleSeedChallenges() {
    showSeedModal = true;
  }

  async function confirmSeed() {
    showSeedModal = false;
    seeding = true;

    try {
      const firestore = await getFirestoreInstance();
      const challengesPath = getTrainChallengesPath();
      const challengesRef = collection(firestore, challengesPath);

      let count = 0;
      for (const challenge of SEED_CHALLENGES) {
        await addDoc(challengesRef, {
          ...challenge,
          createdAt: serverTimestamp(),
          createdBy: "seed-script",
        });
        count++;
      }

      toast.success(t("admin_challenges_seeded", { count: count.toString() }));
      await loadChallenges();
    } catch (error) {
      console.error("❌ Failed to seed challenges:", error);
      toast.error(t("admin_seed_failed"));
    } finally {
      seeding = false;
    }
  }

  function cancelSeed() {
    showSeedModal = false;
  }
</script>

<div class="challenge-manager">
  <!-- Header -->
  <div class="manager-header">
    <div class="header-text">
      <h2>{t("admin_train_challenges")}</h2>
      <p>{t("admin_train_challenges_desc")}</p>
    </div>
    <div class="header-actions">
      <button
        class="seed-btn"
        onclick={handleSeedChallenges}
        disabled={seeding || loading}
      >
        {#if seeding}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Seeding...
        {:else}
          <i class="fas fa-seedling" aria-hidden="true"></i>
          Seed Challenges ({SEED_CHALLENGES.length})
        {/if}
      </button>
      <button class="create-btn" onclick={handleShowCreate}>
        <i class="fas fa-plus" aria-hidden="true"></i>
        Create Challenge
      </button>
    </div>
  </div>

  <!-- Create Form -->
  {#if showCreateForm}
    <div class="create-form">
      <div class="form-header">
        <h3>New Challenge</h3>
        <button
          class="close-btn"
          aria-label="Close create challenge form"
          onclick={() => (showCreateForm = false)}
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <div class="form-grid">
        <!-- Title -->
        <div class="form-group full-width">
          <label for="title">Title *</label>
          <input
            id="title"
            type="text"
            bind:value={formData.title}
            placeholder="e.g., Perfect Sequence Run"
          />
        </div>

        <!-- Description -->
        <div class="form-group full-width">
          <label for="description">Description *</label>
          <textarea
            id="description"
            bind:value={formData.description}
            placeholder="Describe the challenge..."
            rows="3"
          ></textarea>
        </div>

        <!-- Difficulty -->
        <div class="form-group">
          <label for="difficulty">Difficulty</label>
          <select id="difficulty" bind:value={formData.difficulty}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        <!-- XP Reward -->
        <div class="form-group">
          <label for="xpReward">XP Reward</label>
          <input
            id="xpReward"
            type="number"
            bind:value={formData.xpReward}
            min="0"
            step="50"
          />
        </div>

        <!-- Requirement Type -->
        <div class="form-group">
          <label for="requirementType">Requirement Type</label>
          <select id="requirementType" bind:value={formData.requirementType}>
            <option value="complete_sequence">Complete Sequence</option>
            <option value="achieve_accuracy">Achieve Accuracy</option>
            <option value="achieve_combo">Achieve Combo</option>
            <option value="complete_mode">Complete Mode</option>
            <option value="complete_bpm">Complete BPM</option>
            <option value="perfect_run">Perfect Run</option>
          </select>
        </div>

        <!-- Target -->
        <div class="form-group">
          <label for="target">Target</label>
          <input
            id="target"
            type="number"
            bind:value={formData.target}
            min="1"
          />
        </div>

        <!-- Mode (optional) -->
        <div class="form-group">
          <label for="mode">Practice Mode (optional)</label>
          <select id="mode" bind:value={formData.mode}>
            <option value={null}>Any Mode</option>
            <option value={PracticeMode.ADAPTIVE}>Adaptive</option>
            <option value={PracticeMode.STEP_BY_STEP}>Step-by-Step</option>
            <option value={PracticeMode.TIMED}>Timed</option>
          </select>
        </div>

        <!-- Bonus XP -->
        <div class="form-group">
          <label for="bonusXP">Bonus XP (optional)</label>
          <input
            id="bonusXP"
            type="number"
            bind:value={formData.bonusXP}
            min="0"
            step="25"
          />
        </div>

        <!-- Bonus Condition -->
        {#if formData.bonusXP > 0}
          <div class="form-group full-width">
            <label for="bonusCondition">Bonus Condition</label>
            <input
              id="bonusCondition"
              type="text"
              bind:value={formData.bonusCondition}
              placeholder="e.g., perfect_run"
            />
          </div>
        {/if}

        <!-- Order -->
        <div class="form-group">
          <label for="order">Display Order</label>
          <input id="order" type="number" bind:value={formData.order} min="0" />
        </div>

        <!-- Is Active -->
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={formData.isActive} />
            <span>Active</span>
          </label>
        </div>
      </div>

      <!-- Form Actions -->
      <div class="form-actions">
        <button
          class="cancel-btn"
          onclick={() => (showCreateForm = false)}
          disabled={creating}
        >
          {t("action_cancel")}
        </button>
        <button class="submit-btn" onclick={handleCreate} disabled={creating}>
          {#if creating}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Creating...
          {:else}
            Create Challenge
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- Challenges List -->
  <div class="challenges-section">
    <h3>Existing Challenges ({challenges.length})</h3>

    {#if loading}
      <div class="loading-state">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <p>{t("loading_challenges")}</p>
      </div>
    {:else if challenges.length === 0}
      <div class="empty-state">
        <i class="fas fa-dumbbell" aria-hidden="true"></i>
        <p>{t("empty_no_challenges")}</p>
      </div>
    {:else}
      <div class="challenges-list">
        {#each challenges as challenge (challenge.id)}
          <div class="challenge-item">
            <div class="challenge-info">
              <h4>{challenge.title}</h4>
              <p>{challenge.description}</p>
              <div class="challenge-meta">
                <span class="challenge-badge difficulty-{challenge.difficulty}">
                  {challenge.difficulty}
                </span>
                <span class="challenge-badge xp">
                  {challenge.xpReward} XP
                </span>
                {#if challenge.requirement.metadata?.mode}
                  <span class="challenge-badge mode">
                    {challenge.requirement.metadata.mode}
                  </span>
                {/if}
                <span class="challenge-badge">
                  Target: {challenge.requirement.target}
                </span>
              </div>
            </div>
            <div class="challenge-actions">
              <span class="order-badge">#{challenge.order}</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if showSeedModal}
  <AdminModal
    title={t("admin_seed_challenges")}
    message={t("admin_confirm_seed_challenges", { count: SEED_CHALLENGES.length.toString() })}
    variant="warning"
    confirmLabel={t("action_confirm")}
    cancelLabel={t("action_cancel")}
    onConfirm={confirmSeed}
    onCancel={cancelSeed}
  />
{/if}

<style>
  .challenge-manager {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .manager-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .header-text h2 {
    margin: 0 0 4px 0;
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }

  .header-text p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .seed-btn,
  .create-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .seed-btn {
    background: linear-gradient(135deg, var(--semantic-success), #16a34a);
  }

  .seed-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
  }

  .seed-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .create-btn {
    background: linear-gradient(135deg, var(--semantic-info), #2563eb);
  }

  .create-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  /* Create Form */
  .create-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 24px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .form-header h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target); /* WCAG AA touch target */
    height: var(--min-touch-target);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text);
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group.full-width {
    grid-column: 1 / -1;
  }

  .form-group label {
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-dim);
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    font-family: inherit;
  }

  .form-group textarea {
    resize: vertical;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cancel-btn,
  .submit-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .cancel-btn {
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .submit-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, var(--semantic-success), #16a34a);
    color: white;
  }

  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Challenges Section */
  .challenges-section h3 {
    margin: 0 0 16px 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    gap: 12px;
    color: var(--theme-text-dim);
  }

  .loading-state i {
    font-size: var(--font-size-3xl);
    color: #a78bfa;
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
    color: rgba(255, 255, 255, 0.4); /* Improved contrast for WCAG AAA */
  }

  .challenges-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .challenge-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    transition: all var(--duration-normal);
  }

  .challenge-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--theme-stroke-strong);
  }

  .challenge-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .challenge-info h4 {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .challenge-info p {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    line-height: 1.5;
  }

  .challenge-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .challenge-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  .challenge-badge.difficulty-easy {
    background: rgba(34, 197, 94, 0.2);
    color: var(--semantic-success);
  }

  .challenge-badge.difficulty-medium {
    background: rgba(59, 130, 246, 0.2);
    color: var(--semantic-info);
  }

  .challenge-badge.difficulty-hard {
    background: rgba(239, 68, 68, 0.2);
    color: var(--semantic-error);
  }

  .challenge-badge.difficulty-expert {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
  }

  .challenge-badge.xp {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
  }

  .challenge-badge.mode {
    background: rgba(59, 130, 246, 0.2);
    color: var(--semantic-info);
  }

  .order-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 36px;
    padding: 0 8px;
    background: var(--theme-card-bg);
    border-radius: 6px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
  }
</style>
