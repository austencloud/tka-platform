<!--
  AnnouncementManagement - Admin Interface for System Announcements

  Allows admins to create, edit, and manage system-wide announcements.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { IAnnouncementManager } from "../services/contracts/IAnnouncementManager";
  import type { Announcement } from "../domain/models/announcement-models";
  import AnnouncementForm from "./announcements/AnnouncementForm.svelte";
  import AnnouncementList from "./announcements/AnnouncementList.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Services
  let announcementService: IAnnouncementManager | null = null;

  // State
  let announcements = $state<Announcement[]>([]);
  let selectedAnnouncement = $state<Announcement | null>(null);
  let isLoading = $state(true);
  let showForm = $state(false);

  onMount(async () => {
    try {
      announcementService = resolve<IAnnouncementManager>(
        TYPES.IAnnouncementManager
      );
      await loadAnnouncements();
    } catch (error) {
      console.error("Failed to initialize announcement service:", error);
    } finally {
      isLoading = false;
    }
  });

  async function loadAnnouncements() {
    if (!announcementService) return;
    try {
      isLoading = true;
      announcements = await announcementService.getAllAnnouncements();
    } catch (error) {
      console.error("Failed to load announcements:", error);
    } finally {
      isLoading = false;
    }
  }

  function handleCreateNew() {
    selectedAnnouncement = null;
    showForm = true;
  }

  function handleEdit(announcement: Announcement) {
    selectedAnnouncement = announcement;
    showForm = true;
  }

  async function handleDelete(announcementId: string) {
    if (!announcementService) return;
    if (!confirm(t("admin_confirm_delete_announcement"))) return;

    try {
      await announcementService.deleteAnnouncement(announcementId);
      await loadAnnouncements();
    } catch (error) {
      console.error("Failed to delete announcement:", error);
    }
  }

  async function handleSave() {
    showForm = false;
    selectedAnnouncement = null;
    await loadAnnouncements();
  }

  function handleCancel() {
    showForm = false;
    selectedAnnouncement = null;
  }
</script>

<div class="announcement-management">
  {#if isLoading}
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <p>{t("admin_loading_announcements")}</p>
    </div>
  {:else if showForm}
    <AnnouncementForm
      announcement={selectedAnnouncement}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  {:else}
    <div class="management-header">
      <h2>{t("admin_system_announcements")}</h2>
      <button class="create-button" onclick={handleCreateNew}>
        <i class="fas fa-plus" aria-hidden="true"></i>
        {t("admin_create_announcement_btn")}
      </button>
    </div>

    <AnnouncementList
      {announcements}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  {/if}
</div>

<style>
  .announcement-management {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    overflow-y: auto;
  }

  /* ============================================================================
     LOADING STATE
     ============================================================================ */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 48px;
    color: var(--theme-text-dim);
  }

  .loading-state i {
    font-size: var(--font-size-3xl);
  }

  /* ============================================================================
     HEADER
     ============================================================================ */
  .management-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .management-header h2 {
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin: 0;
  }

  .create-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, var(--theme-accent)) 120%, white)
        0%,
      var(--theme-accent, var(--theme-accent)) 100%
    );
    border: none;
    border-radius: 10px;
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .create-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 40%,
        transparent
      );
  }

  .create-button:active {
    transform: translateY(0);
  }

  /* ============================================================================
     SCROLLBAR
     ============================================================================ */
  .announcement-management::-webkit-scrollbar {
    width: 8px;
  }

  .announcement-management::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 4px;
  }

  .announcement-management::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  .announcement-management::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  /* ============================================================================
     RESPONSIVE
     ============================================================================ */
  @media (max-width: 640px) {
    .announcement-management {
      padding: 16px;
    }

    .management-header {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .management-header h2 {
      font-size: var(--font-size-xl);
    }
  }
</style>
