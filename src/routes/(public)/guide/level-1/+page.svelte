<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import EditorMode from './_lib/editor/EditorMode.svelte';
  import { pages } from './_lib/page-manifest';

  // Admin-only editor tool. The route is always the editor; there is no
  // separate read view. Page state lives in ?page=N so bookmarks / reloads
  // land where you were.
  onMount(() => {
    const splash = document.getElementById('app-loading');
    if (splash) splash.style.display = 'none';
    (window as unknown as { __tkaLoadProgress?: () => void }).__tkaLoadProgress = () => {};
  });

  const urlPage = $derived.by(() => {
    const raw = page.url.searchParams.get('page');
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 1 && n <= pages.length ? n : 5;
  });

  function onEditorNavigate(n: number) {
    const url = new URL(page.url);
    url.searchParams.set('page', String(n));
    void goto(url, { replaceState: true, keepFocus: true, noScroll: true });
  }
</script>

<svelte:head>
  <title>Guide Editor — Level 1</title>
</svelte:head>

<EditorMode initialPage={urlPage} onNavigate={onEditorNavigate} />

<style>
  :global(body) {
    margin: 0;
    background: #0d1117;
  }
</style>
