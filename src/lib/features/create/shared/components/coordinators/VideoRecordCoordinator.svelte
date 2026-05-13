<script lang="ts">

import { getVideoUploader } from "$lib/shared/share/getVideoUploader";
  /**
   * Video Record Coordinator Component
   *
   * Manages video record panel state and camera recording.
   * Extracts video record panel logic from CreateModule.svelte for better separation of concerns.
   *
   * Domain: Create module - Video Record Panel Coordination
   */

  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import VideoRecordDrawer from "$lib/shared/video-record/components/VideoRecordDrawer.svelte";
  import SavePromptDialog from "../dialogs/SavePromptDialog.svelte";
  import SaveToLibraryDialog, {
    type SaveMetadata,
  } from "../SaveToLibraryDialog.svelte";
  import { getCreateModuleContext } from "../../context/create-module-context";
  import type { RecordingResult } from "$lib/shared/video-record/services/contracts/types";
  import type { R2VideoUploader } from "$lib/shared/share/services/implementations/R2VideoUploader";
  import { saveRecording } from "$lib/shared/video-record/services/recording-persister";
  import {
    createRecordingMetadata,
    detectDeviceType,
  } from "$lib/shared/video-record/domain/RecordingMetadata";


  const logger = createComponentLogger("VideoRecordCoordinator");

  // Get context
  const ctx = getCreateModuleContext();
  const { CreateModuleState, panelState } = ctx;

  // Services
  const uploadService = getVideoUploader() as R2VideoUploader;

  // UI State
  let showSavePrompt = $state(false);
  let showSaveDialog = $state(false);
  let pendingRecording: RecordingResult | null = $state(null);

  // Event handlers
  function handleClose() {
    panelState.closeVideoRecordPanel();
  }

  async function handleSave(recording: RecordingResult) {
    const currentSequence = CreateModuleState.sequenceState.currentSequence;

    if (!recording.success || !recording.videoBlob || !currentSequence) {
      logger.error("Invalid recording or no current sequence");
      return;
    }

    // Check if session is saved
    const session = ctx.sessionManager?.getCurrentSession();
    if (!session?.isSaved) {
      // Show save prompt first
      pendingRecording = recording;
      showSavePrompt = true;
      return;
    }

    // Proceed with upload
    await uploadRecording(recording, currentSequence.id);
  }

  async function handleSavePromptConfirm() {
    showSavePrompt = false;
    showSaveDialog = true;
  }

  function handleSavePromptCancel() {
    showSavePrompt = false;
    pendingRecording = null;
  }

  async function handleLibrarySave(metadata: SaveMetadata) {
    logger.info("handleLibrarySave called with metadata:", metadata);
    const currentSequence = CreateModuleState.sequenceState.currentSequence;

    if (!currentSequence) {
      logger.error("No current sequence found");
      return;
    }
    if (!ctx.libraryRepository) {
      logger.error("libraryRepository not available");
      return;
    }
    if (!ctx.sessionManager) {
      logger.error("sessionManager not available");
      return;
    }

    try {
      logger.info("Saving sequence to library...", {
        stepCount: currentSequence.steps.length,
        sequenceName: metadata.name,
      });

      // Save sequence to library
      const saved = await ctx.libraryRepository!.saveSequenceWithMetadata(
        currentSequence,
        {
          name: metadata.name,
          visibility: metadata.visibility ?? "private",
          tags: metadata.tags ?? [],
          notes: metadata.notes ?? "",
        }
      );
      const sequenceId = saved.id;

      logger.success("Sequence saved to library with ID:", sequenceId);

      // Mark session as saved
      await ctx.sessionManager.markAsSaved(sequenceId);
      logger.info("Session marked as saved");

      // Refresh library state if available
      try {
        const { libraryState } =
          await import("$lib/features/library/state/library-state.svelte");
        if (libraryState) {
          logger.info("Refreshing library sequences...");
          await libraryState.loadSequences();
          logger.success("Library refreshed");
        }
      } catch (err) {
        logger.warn("Could not refresh library state:", err);
      }

      showSaveDialog = false;

      // Now upload the pending recording
      if (pendingRecording) {
        logger.info("Uploading pending recording...");
        await uploadRecording(pendingRecording, sequenceId);
        pendingRecording = null;
        logger.success("Recording uploaded successfully");
      }
    } catch (error) {
      logger.error("Failed to save sequence:", error);
    }
  }

  function handleLibraryCancel() {
    showSaveDialog = false;
    pendingRecording = null;
  }

  async function uploadRecording(
    recording: RecordingResult,
    sequenceId: string
  ) {
    try {
      logger.log("📤 Uploading recording to Firebase...");

      // Upload video to Firebase Storage
      const uploadResult = await uploadService.uploadPerformanceVideo(
        sequenceId,
        recording.videoBlob!,
        { onProgress: (progress) => logger.log(`Upload progress: ${progress}%`) }
      );

      // Create metadata using upload result
      const metadata = createRecordingMetadata({
        userId: "", // Will be populated by service
        sequenceId,
        videoUrl: uploadResult.url,
        storagePath: uploadResult.key,
        duration: recording.duration ?? 0,
        fileSize: recording.videoBlob!.size,
        mimeType: recording.videoBlob!.type,
        deviceType: detectDeviceType(),
        metadata: {
          sequenceName:
            CreateModuleState.sequenceState.currentSequence?.name || "",
          stepCount:
            CreateModuleState.sequenceState.currentSequence?.steps.length || 0,
        },
      });

      // Save metadata to Firestore
      await saveRecording(metadata);

      logger.log("✅ Recording saved successfully:", metadata.id);
      panelState.closeVideoRecordPanel();
    } catch (error) {
      logger.error("❌ Failed to save recording:", error);
      // TODO: Show error toast to user
    }
  }
</script>

<VideoRecordDrawer
  bind:show={panelState.isVideoRecordPanelOpen}
  sequence={CreateModuleState.sequenceState.currentSequence}
  onClose={handleClose}
  onSave={handleSave}
/>

<SavePromptDialog
  bind:show={showSavePrompt}
  onSave={handleSavePromptConfirm}
  onCancel={handleSavePromptCancel}
/>

<SaveToLibraryDialog
  isOpen={showSaveDialog}
  sequence={CreateModuleState.sequenceState.currentSequence}
  onSave={handleLibrarySave}
  onCancel={handleLibraryCancel}
/>
