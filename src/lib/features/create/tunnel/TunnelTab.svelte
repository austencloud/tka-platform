<script lang="ts">
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { openSequenceOverlay } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";
  import { persistViewerMode } from "$lib/shared/sequence-viewer/services/viewer-state-persistence";
  import { createPersistenceHelper } from "$lib/shared/state/utils/persistent-state";
  import { createTunnelCreatorState } from "./state/tunnel-creator-state.svelte";
  import { setTunnelCreatorContext } from "./context/tunnel-creator-context";
  import TunnelLayout from "./components/TunnelLayout.svelte";
  import { consumeTunnelCreatorHandoff } from "./services/tunnel-creator-handoff";
  import { parseTunnelCreatorDraft } from "./domain/tunnel-creator-draft";

  const draftPersistence = createPersistenceHelper<unknown>({
    key: "tka-create-tunnel-draft-v1",
    defaultValue: null,
  });

  setEffectsConfigContext(
    createEffectsConfigState(undefined, { persist: false })
  );

  const handoff = consumeTunnelCreatorHandoff();
  const restoredDraft = handoff
    ? null
    : parseTunnelCreatorDraft(draftPersistence.load());
  const editingTunnel = handoff
    ? { id: handoff.tunnelId, name: handoff.tunnelName }
    : (restoredDraft?.editingTunnel ?? undefined);
  const state = createTunnelCreatorState({
    initialComposition: handoff?.composition,
    initialDraft: restoredDraft,
    initialFormation: handoff?.formation,
    editingTunnel,
    openComposition(composition) {
      const lead = composition.performers.find(
        (performer) => performer.source.kind === "independent"
      );
      if (!lead || lead.source.kind !== "independent") return;
      persistViewerMode("tunnel");
      openSequenceOverlay(lead.source.sequence, {
        returnLabel: "Back to Tunnel Creator",
        initialViewerMode: "tunnel",
        initialViewMode: "animation",
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
