<!--
  Bottom-sheet drawer showing a code's full lifetime scan history.
  Opens when a ScanActivityCard is clicked.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import type { CodeEntry, ScanEventRow } from "$lib/features/choreo-card/state/scan-activity-state.svelte";
  import {
    collection,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    type Unsubscribe,
  } from "firebase/firestore";

  let {
    isOpen = $bindable(false),
    entry,
  }: { isOpen?: boolean; entry: CodeEntry | null } = $props();

  let events = $state<ScanEventRow[]>([]);
  let loading = $state(false);
  let unsub: Unsubscribe | null = null;

  $effect(() => {
    if (!isOpen || !entry) {
      unsub?.();
      unsub = null;
      events = [];
      return;
    }
    loading = true;
    const fs = getFirestore();
    const q = query(
      collection(fs, "shortcodes", entry.code, "scanEvents"),
      orderBy("timestamp", "desc")
    );
    unsub = onSnapshot(q, (snap) => {
      events = snap.docs.map((d) => {
        const data = d.data();
        return {
          code: entry!.code,
          timestamp: data.timestamp ?? "",
          city: data.city ?? null,
          country: data.country ?? null,
          deviceId: data.deviceId ?? null,
          userId: data.userId ?? null,
        };
      });
      loading = false;
    });
    return () => unsub?.();
  });
</script>

<Drawer bind:isOpen placement="bottom" snapPoints={[0.5, 0.9]} ariaLabel="Scan history">
  {#snippet children()}
    {#if entry}
      <header class="hdr">
        <div>
          <h3>{entry.word}</h3>
          <p class="sub">{entry.code} · {entry.scanCount} total scans</p>
        </div>
      </header>

      <section class="timeline" aria-label="Scan timeline">
        {#if loading}
          <p class="muted">Loading history…</p>
        {:else if events.length === 0}
          <p class="muted">No scan events recorded.</p>
        {:else}
          {#each events as e}
            <div class="event">
              <span class="when">{new Date(e.timestamp).toLocaleString()}</span>
              <span class="where">{e.city ?? "—"}, {e.country ?? "—"}</span>
              <span class="who">
                {#if e.userId}signed-in{:else}anonymous{/if}
                {#if e.deviceId}· device {e.deviceId.slice(0, 6)}…{/if}
              </span>
            </div>
          {/each}
        {/if}
      </section>
    {/if}
  {/snippet}
</Drawer>

<style>
  .hdr { padding: 16px 20px; border-bottom: 1px solid #1a1f2e; }
  h3 { margin: 0; color: #fff; font-size: 18px; }
  .sub { margin: 4px 0 0; color: #8b93a7; font-size: var(--font-size-sm, 14px); }
  .timeline { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
  .event {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    padding: 12px;
    background: #0b0d17;
    border: 1px solid #1a1f2e;
    border-radius: 6px;
    font-size: var(--font-size-sm, 14px);
    min-height: 44px;
    align-items: center;
  }
  .when { color: #d0d5e0; }
  .where { color: #34d399; }
  .who { color: #8b93a7; }
  .muted { color: #6b7491; font-size: var(--font-size-sm, 14px); }
</style>
