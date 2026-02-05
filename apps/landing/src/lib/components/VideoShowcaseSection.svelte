<!--
  VideoShowcaseSection.svelte (Landing - standalone)

  Displays featured performer videos in an endless loop.
  Uses own Firebase init (read-only Firestore queries).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import EndlessVideoPlayer from "./EndlessVideoPlayer.svelte";
  import { getFirestoreInstance } from "$lib/firebase";

  interface Props {
    compact?: boolean;
  }

  let { compact = false }: Props = $props();

  let videos = $state<Array<{ src: string; title?: string; description?: string }>>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i] as T;
      shuffled[i] = shuffled[j] as T;
      shuffled[j] = temp;
    }
    return shuffled;
  }

  async function loadFeaturedVideos() {
    const { collection, getDocs, query, where, orderBy, limit } = await import(
      "firebase/firestore"
    );
    const db = getFirestoreInstance();

    const q = query(
      collection(db, "showcaseVideos"),
      where("featured", "==", true),
      where("approved", "==", true),
      orderBy("instagramDate", "desc"),
      limit(20)
    );

    const snapshot = await getDocs(q);
    const loadedVideos = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          videoUrl: data.videoUrl as string,
          title: (data.title as string | null) || null,
          performers: (data.performers as Array<{ displayName: string }>) || [],
          linkedSequences: (data.linkedSequences as Array<{ word: string }>) || [],
          excluded: (data.excluded as boolean) || false,
        };
      })
      .filter((v) => !v.excluded && v.videoUrl);

    return shuffleArray(loadedVideos);
  }

  onMount(async () => {
    try {
      const showcaseVideos = await loadFeaturedVideos();

      videos = showcaseVideos.map((v) => ({
        src: v.videoUrl,
        title: v.title || v.performers?.[0]?.displayName || undefined,
        description: v.linkedSequences?.[0]?.word || undefined,
      }));

      if (videos.length === 0) {
        error = "No featured videos available";
      }
    } catch (e) {
      console.error("[VideoShowcaseSection] Failed to load videos:", e);
      error = "Failed to load videos";
    } finally {
      loading = false;
    }
  });
</script>

<section class="video-showcase" class:compact id="videos">
  <div class="container">
    {#if !compact}
      <h2>Real Performances</h2>
      <p class="section-intro">
        Sequences performed with staves, poi, and fans.
      </p>
    {/if}

    <div class="player-wrapper">
      {#if loading}
        <div class="loading-state">
          <div class="spinner"></div>
          <span>Loading videos...</span>
        </div>
      {:else if error}
        <div class="error-state">
          <span>{error}</span>
        </div>
      {:else if videos.length > 0}
        <EndlessVideoPlayer {videos} crossfadeDuration={1000} showInfo={!compact} />
      {/if}
    </div>
  </div>
</section>

<style>
  .video-showcase {
    padding: 80px 24px;
  }

  .video-showcase.compact {
    padding: 0;
  }

  .container {
    max-width: 500px;
    margin: 0 auto;
  }

  .compact .container {
    max-width: 100%;
  }

  .compact .player-wrapper {
    max-width: 100%;
  }

  h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 600;
    line-height: 1.2;
  }

  .section-intro {
    text-align: center;
    font-size: 1.125rem;
    color: rgba(255, 255, 255, 0.7);
    max-width: 600px;
    margin: 0 auto 40px;
  }

  .player-wrapper {
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 80px 24px;
    color: rgba(255, 255, 255, 0.6);
    background: rgba(0, 0, 0, 0.2);
    border-radius: 16px;
    aspect-ratio: 9 / 16;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 600px) {
    .video-showcase {
      padding: 60px 16px;
    }

    .player-wrapper {
      max-width: 100%;
    }
  }
</style>
