<!--
  ProfileScreen.svelte — Drawer for editing identity (avatar, name, pronouns, favorite prop).

  Renders at the app shell level. Triggered from the module switcher or desktop sidebar
  via profileScreenState.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import ProfilePhotoPicker from "$lib/shared/settings/components/ProfilePhotoPicker.svelte";
  import { authState, refreshUser } from "$lib/shared/auth/state/authState.svelte";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IPropPreferencePersister } from "$lib/shared/community/services/contracts/IPropPreferencePersister";
  import { createPropPreferenceState } from "$lib/shared/community/state/prop-preference-state.svelte";
  import type { PropPreferenceState } from "$lib/shared/community/state/prop-preference-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { updateProfile } from "firebase/auth";
  import type { User } from "firebase/auth";
  import { doc, setDoc, getDoc } from "firebase/firestore";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import type { PhotoSelection } from "$lib/shared/settings/domain/photo-picker-types";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import type { ModuleId } from "$lib/shared/navigation/domain/types";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
  }

  let { isOpen = $bindable(), onClose }: Props = $props();

  const user = $derived(authState.user);

  // ============ INLINE EDITING ============

  let editingName = $state(false);
  let editingPronouns = $state(false);
  let nameInput = $state("");
  let pronounsInput = $state("");
  let savingName = $state(false);
  let savingPronouns = $state(false);

  // Pronouns live in Firestore (not on the Firebase Auth user object)
  let userPronouns = $state("");

  // ============ PHOTO PICKER ============

  let showPhotoPicker = $state(false);

  // ============ SERVICES ============

  let hapticService = $state<IHapticFeedback | null>(null);

  // ============ PROP PREFERENCE ============

  let propState = $state<PropPreferenceState | null>(null);

  // Re-create state when the logged-in user changes
  $effect(() => {
    const uid = authState.user?.uid;
    if (uid) {
      const persister = container.items
        .propPreferencePersister as IPropPreferencePersister;
      propState = createPropPreferenceState(persister, uid);
    } else {
      propState = null;
    }
  });

  onMount(async () => {
    hapticService = container.items.hapticFeedback as IHapticFeedback;

    // Load pronouns from the user's Firestore document
    const u = authState.user;
    if (u) {
      try {
        const firestore = await getFirestoreInstance();
        const userDocRef = doc(firestore, "users", u.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          userPronouns = userDoc.data()?.pronouns || "";
        }
      } catch (err) {
        console.error("Failed to load pronouns:", err);
      }
    }
  });

  // ============ DISPLAY NAME ============

  const MAX_NAME_LENGTH = 50;

  function startEditingName() {
    nameInput = user?.displayName || "";
    editingName = true;
  }

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed.length > MAX_NAME_LENGTH) return;
    if (trimmed === user?.displayName) {
      editingName = false;
      return;
    }

    savingName = true;
    const previousName = user?.displayName || "";
    try {
      await updateProfile(user!, { displayName: trimmed });
      await refreshUser();
      editingName = false;
    } catch (error) {
      console.error("Failed to update display name:", error);
      nameInput = previousName;
      hapticService?.trigger("error");
    } finally {
      savingName = false;
    }
  }

  function handleNameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") saveName();
    if (e.key === "Escape") editingName = false;
  }

  // ============ PRONOUNS ============

  function startEditingPronouns() {
    pronounsInput = userPronouns;
    editingPronouns = true;
  }

  async function savePronouns() {
    const trimmed = pronounsInput.trim();
    if (trimmed === userPronouns) {
      editingPronouns = false;
      return;
    }

    savingPronouns = true;
    const previousPronouns = userPronouns;
    try {
      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, "users", user!.uid);
      await setDoc(userDocRef, { pronouns: trimmed }, { merge: true });
      userPronouns = trimmed;
      editingPronouns = false;
    } catch (error) {
      console.error("Failed to update pronouns:", error);
      pronounsInput = previousPronouns;
      hapticService?.trigger("error");
    } finally {
      savingPronouns = false;
    }
  }

  function handlePronounsKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") savePronouns();
    if (e.key === "Escape") editingPronouns = false;
  }

  // ============ PHOTO ============

  async function uploadProfilePhoto(u: User, file: File): Promise<string> {
    const { getStorageInstance } = await import("$lib/shared/auth/firebase");
    const { ref, uploadBytes, getDownloadURL } = await import(
      "firebase/storage"
    );
    const storage = await getStorageInstance();

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${Date.now()}.${ext}`;
    const storagePath = `avatars/${u.uid}/${filename}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file, {
      contentType: file.type || "image/jpeg",
      customMetadata: {
        userId: u.uid,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    return await getDownloadURL(storageRef);
  }

  async function handlePhotoSelected(selection: PhotoSelection) {
    const u = authState.user;
    if (!u) return;

    hapticService?.trigger("selection");

    const profilePictureManager = container.items.profilePictureManager;
    const userDocumentManager = container.items.userDocumentManager;

    try {
      let newPhotoURL: string | null = null;

      switch (selection.type) {
        case "upload":
          if (selection.file) {
            newPhotoURL = await uploadProfilePhoto(u, selection.file);
            await updateProfile(u, { photoURL: newPhotoURL });
          }
          break;
        case "google":
        case "facebook":
          if (selection.url) {
            newPhotoURL = selection.url;
            await updateProfile(u, { photoURL: newPhotoURL });
          }
          break;
        case "generated":
          if (selection.generatedData) {
            newPhotoURL =
              await profilePictureManager.generateAndUploadAvatar(
                u,
                selection.generatedData,
              );
          }
          break;
      }

      if (newPhotoURL) {
        await userDocumentManager.updatePhotoURL(u.uid, newPhotoURL);
        await refreshUser();
        hapticService?.trigger("success");
      }
    } catch (error) {
      console.error("Failed to update profile photo:", error);
      hapticService?.trigger("error");
    }
  }

  // ============ NAVIGATION ============

  function handleNavigateToAccount() {
    hapticService?.trigger("selection");
    onClose();
    handleModuleChange("settings" as ModuleId, "account");
  }

  // ============ PROP PICKER ============

  const PROP_OPTIONS = [
    { type: PropType.STAFF, label: "Staff", icon: "fa-wand-magic-sparkles" },
    { type: PropType.FAN, label: "Fan", icon: "fa-wind" },
    { type: PropType.CLUB, label: "Club", icon: "fa-baseball-bat-ball" },
    { type: PropType.BUUGENG, label: "Buugeng", icon: "fa-infinity" },
  ] as const;
</script>

<Drawer
  bind:isOpen
  ariaLabel="Edit profile"
  class="profile-screen-drawer"
  placement="bottom"
  showHandle={true}
  closeOnBackdrop={true}
>
  <div class="profile-screen">
    <!-- Avatar -->
    <div class="profile-avatar-section">
      <button
        class="avatar-wrapper"
        onclick={() => (showPhotoPicker = true)}
        aria-label="Change profile photo"
      >
        <RobustAvatar
          src={user?.photoURL}
          name={user?.displayName}
          alt="Your avatar"
          size="xl"
        />
        <span class="avatar-edit-badge" aria-hidden="true">
          <i class="fas fa-camera"></i>
        </span>
      </button>
    </div>

    <!-- Identity fields -->
    <div class="profile-identity">
      <!-- Display name -->
      <div class="identity-field">
        <span class="identity-label">Display name</span>
        {#if editingName}
          <div class="identity-edit-row">
            <input
              type="text"
              class="identity-input"
              bind:value={nameInput}
              onblur={saveName}
              onkeydown={handleNameKeydown}
              maxlength={MAX_NAME_LENGTH}
              disabled={savingName}
              aria-label="Display name"
            />
            {#if savingName}
              <span class="save-spinner" aria-label="Saving">
                <i class="fas fa-spinner fa-spin"></i>
              </span>
            {/if}
          </div>
        {:else}
          <button class="identity-value" onclick={startEditingName}>
            <span class="identity-text">
              {user?.displayName || "Set your name"}
            </span>
            <i class="fas fa-pencil identity-edit-icon" aria-hidden="true"></i>
          </button>
        {/if}
      </div>

      <!-- Pronouns -->
      <div class="identity-field">
        <span class="identity-label">Pronouns</span>
        {#if editingPronouns}
          <div class="identity-edit-row">
            <input
              type="text"
              class="identity-input"
              bind:value={pronounsInput}
              onblur={savePronouns}
              onkeydown={handlePronounsKeydown}
              placeholder="e.g. they/them"
              disabled={savingPronouns}
              aria-label="Pronouns"
            />
            {#if savingPronouns}
              <span class="save-spinner" aria-label="Saving">
                <i class="fas fa-spinner fa-spin"></i>
              </span>
            {/if}
          </div>
        {:else}
          <button class="identity-value" onclick={startEditingPronouns}>
            <span
              class="identity-text"
              class:placeholder={!userPronouns}
            >
              {userPronouns || "Add pronouns"}
            </span>
            <i class="fas fa-pencil identity-edit-icon" aria-hidden="true"></i>
          </button>
        {/if}
      </div>
    </div>

    <!-- Favorite prop -->
    {#if propState && !propState.loading}
      <div class="profile-prop-section">
        <h3 class="prop-section-title">Favorite prop</h3>
        <div class="prop-picker-row">
          {#each PROP_OPTIONS as opt}
            <button
              class="prop-option"
              class:selected={propState.favoriteProp === opt.type}
              onclick={() => propState?.setFavorite(opt.type)}
              aria-label={opt.label}
              aria-pressed={propState.favoriteProp === opt.type}
            >
              <i class="fas {opt.icon} prop-icon" aria-hidden="true"></i>
              <span class="prop-label">{opt.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Footer -->
    <div class="profile-footer">
      <button class="account-link" onclick={handleNavigateToAccount}>
        <i class="fas fa-cog" aria-hidden="true"></i>
        <span>Account settings</span>
        <i class="fas fa-chevron-right account-link-chevron" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</Drawer>

<!-- Photo picker renders its own drawer/modal -->
<ProfilePhotoPicker
  bind:isOpen={showPhotoPicker}
  onClose={() => (showPhotoPicker = false)}
  onPhotoSelected={handlePhotoSelected}
/>

<style>
  /* Override the drawer's default glassmorphism — profile screen is an opaque panel */
  :global(.profile-screen-drawer) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    --sheet-filter: none;
  }

  .profile-screen {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem 1.25rem 2rem;
  }

  /* ============ AVATAR ============ */

  .profile-avatar-section {
    display: flex;
    justify-content: center;
    padding-top: 0.5rem;
  }

  .avatar-wrapper {
    position: relative;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 50%;
    min-width: var(--min-touch-target, 50px);
    min-height: var(--min-touch-target, 50px);
  }

  .avatar-edit-badge {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--theme-accent, #6c63ff);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    pointer-events: none;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }

  /* ============ IDENTITY ============ */

  .profile-identity {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .identity-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .identity-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .identity-value {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 0.625rem 0.75rem;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    min-height: var(--min-touch-target, 50px);
    width: 100%;
    text-align: left;
    transition: border-color 0.15s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .identity-value {
      transition: none;
    }
  }

  .identity-value:hover,
  .identity-value:focus-visible {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .identity-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .identity-text.placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-style: italic;
  }

  .identity-edit-icon {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
  }

  .identity-edit-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .identity-input {
    flex: 1;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-accent, #6c63ff);
    border-radius: 8px;
    padding: 0.625rem 0.75rem;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    min-height: var(--min-touch-target, 50px);
    outline: none;
  }

  .identity-input:focus {
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.25);
  }

  .identity-input:disabled {
    opacity: 0.6;
  }

  .save-spinner {
    color: var(--theme-accent, #6c63ff);
    font-size: 14px;
    flex-shrink: 0;
  }

  /* ============ PROP PICKER ============ */

  .profile-prop-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .prop-section-title {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-weight: 500;
    margin: 0;
  }

  .prop-picker-row {
    display: flex;
    gap: 0.5rem;
  }

  .prop-option {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 0.75rem 0.5rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    min-height: var(--min-touch-target, 50px);
    transition:
      border-color 0.15s ease,
      color 0.15s ease,
      background 0.15s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-option {
      transition: none;
    }
  }

  .prop-option:hover,
  .prop-option:focus-visible {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
  }

  .prop-option.selected {
    border-color: var(--theme-accent, #6c63ff);
    color: var(--theme-accent, #6c63ff);
    background: rgba(108, 99, 255, 0.08);
  }

  .prop-icon {
    font-size: 1.25rem;
  }

  .prop-label {
    font-size: var(--font-size-compact, 12px);
  }

  /* ============ FOOTER ============ */

  .profile-footer {
    padding-top: 0.5rem;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .account-link {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    background: none;
    border: none;
    padding: 0.75rem 0.25rem;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    min-height: var(--min-touch-target, 50px);
    border-radius: 8px;
    transition: background 0.15s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .account-link {
      transition: none;
    }
  }

  .account-link:hover,
  .account-link:focus-visible {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .account-link span {
    flex: 1;
    text-align: left;
  }

  .account-link-chevron {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
</style>
