<script lang="ts">
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import {
    getEffectsConfigContext,
    setEffectsConfigContext,
  } from "$lib/shared/effects/state/effects-config-context";
  import {
    AnimationVisibilityStateManager,
    getAnimationVisibilityManager,
  } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { setAnimationVisibilityContext } from "$lib/shared/animation-engine/state/animation-visibility-context";
  import {
    animationSettings,
    createAnimationSettingsState,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { openSequenceOverlay } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";
  import { persistViewerMode } from "$lib/shared/sequence-viewer/services/viewer-state-persistence";
  import { createPersistenceHelper } from "$lib/shared/state/utils/persistent-state";
  import { createTunnelCreatorState } from "./state/tunnel-creator-state.svelte";
  import { setTunnelCreatorContext } from "./context/tunnel-creator-context";
  import TunnelLayout from "./components/TunnelLayout.svelte";
  import { consumeTunnelCreatorHandoff } from "./services/tunnel-creator-handoff";
  import { parseTunnelCreatorDraft } from "./domain/tunnel-creator-draft";
  import { createTunnelPresentationState } from "./state/tunnel-presentation-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { stageTunnelSnapshotForViewer } from "$lib/shared/sequence-viewer/tunnel/stage-tunnel-snapshot-for-viewer";

  const draftPersistence = createPersistenceHelper<unknown>({
    key: "tka-create-tunnel-draft-v1",
    defaultValue: null,
  });

  const handoff = consumeTunnelCreatorHandoff();
  const restoredDraft = handoff
    ? null
    : parseTunnelCreatorDraft(draftPersistence.load());
  // Carries the poster as well as the name: after the tab switch these are the
  // creator's only way to say which saved tunnel it is holding.
  const editingTunnel = handoff
    ? {
        id: handoff.tunnelId,
        name: handoff.tunnelName,
        ...(handoff.poster ? { poster: handoff.poster } : {}),
      }
    : (restoredDraft?.editingTunnel ?? undefined);

  // Seed new tunnels from the user's current look, then keep every edit inside
  // this creator subtree. Existing tunnels replace these seeds with their exact
  // saved snapshot below.
  const inheritedEffects = getEffectsConfigContext();
  const effects = createEffectsConfigState(inheritedEffects?.config, {
    persist: false,
  });
  setEffectsConfigContext(effects);

  const visibility = new AnimationVisibilityStateManager({ ephemeral: true });
  visibility.updateSettings(getAnimationVisibilityManager().getSettings());
  setAnimationVisibilityContext(visibility);

  const localAnimationSettings = createAnimationSettingsState({
    ephemeral: true,
  });
  localAnimationSettings.updateSettings({
    ...animationSettings.settings,
    trail: JSON.parse(JSON.stringify(animationSettings.trail)),
  });

  const presentation = createTunnelPresentationState({
    initialSnapshot: handoff?.snapshot ?? restoredDraft?.presentation ?? null,
    initialFormation:
      handoff?.snapshot?.tunnel.config ??
      handoff?.formation ??
      restoredDraft?.composition?.formation,
    effects,
    visibility,
    animationSettings: localAnimationSettings,
    initialBluePropType: settingsService.settings.bluePropType ?? "staff",
    initialRedPropType: settingsService.settings.redPropType ?? "staff",
    initialBlueBuugengFlipped:
      settingsService.settings.blueBuugengFlipped ?? false,
    initialRedBuugengFlipped:
      settingsService.settings.redBuugengFlipped ?? false,
  });

  const state = createTunnelCreatorState({
    initialComposition: handoff?.composition,
    initialDraft: restoredDraft,
    initialFormation: handoff?.formation,
    editingTunnel,
    presentation,
    openComposition(composition, snapshot) {
      const lead = composition.performers.find(
        (performer) => performer.source.kind === "independent"
      );
      if (!lead || lead.source.kind !== "independent") return;
      stageTunnelSnapshotForViewer(snapshot);
      persistViewerMode("tunnel");
      openSequenceOverlay(lead.source.sequence, {
        returnLabel: "Back to Tunnel Creator",
        initialViewerMode: "tunnel",
        initialViewMode: "animation",
        initialBpm: snapshot.playback.bpm,
        initialPlaybackMode: snapshot.playback.playbackMode,
        tunnelComposition: composition,
        tunnelSaveTarget: editingTunnel,
      });
    },
  });
  setTunnelCreatorContext(state);

  $effect(() => {
    draftPersistence.setupAutoSave(state.draftSnapshot());
  });
</script>

<TunnelLayout />
