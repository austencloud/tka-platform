<script lang="ts">
  /**
   * VideoShowcaseSection
   *
   * Displays featured performer videos in an endless loop on the landing page.
   * Loads approved/featured videos from Firestore and plays them with smooth crossfades.
   */
  import { onMount } from "svelte";
  import EndlessVideoPlayer from "$lib/features/landing-preview/components/EndlessVideoPlayer.svelte";
  import type { ShowcaseVideo } from "$lib/features/landing-preview/types";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  interface Props {
    /** When true, hides the header and shows just the video player (for hero integration) */
    compact?: boolean;
  }

  let { compact = false }: Props = $props();

  let videos = $state<Array<{ src: string; title?: string; description?: string }>>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  /**
   * Fisher-Yates shuffle - randomizes array in place
   */
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

  async function loadFeaturedVideos(): Promise<ShowcaseVideo[]> {
    const { collection, getDocs, query, where, orderBy, limit } = await import(
      "firebase/firestore"
    );
    const db = await getFirestoreInstance();

    // Get featured, approved videos that aren't excluded
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
          shortcode: doc.id,
          videoUrl: data.videoUrl,
          instagramDate: data.instagramDate?.toDate() || null,
          fileSize: data.fileSize || 0,
          category: data.category || null,
          tags: data.tags || [],
          featured: data.featured || false,
          approved: data.approved || false,
          linkedSequences: data.linkedSequences || [],
          title: data.title || null,
          description: data.description || null,
          performers: data.performers || [],
          excluded: data.excluded || false,
        } as ShowcaseVideo;
      })
      .filter((v) => !v.excluded && v.videoUrl);

    // Randomize order so each page visit starts on a different video
    return shuffleArray(loadedVideos);
  }

  onMount(async () => {
    try {
      const showcaseVideos = await loadFeaturedVideos();

      // Transform to EndlessVideoPlayer format
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
        Sequences performed with staves, fans, and clubs.
      </p>
    {/if}

    <div class="player-wrapper">
      {#if loading}
        <div class="loading-state">
          <ProgressRing percent={-1} size={32} strokeWidth={3} />
          <span>Loading videos...</span>
        </div>
      {:else if error}
        <div class="error-state">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
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
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
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
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    background: rgba(0, 0, 0, 0.2);
    border-radius: 16px;
    aspect-ratio: 9 / 16;
  }

  .error-state i {
    font-size: 32px;
    color: var(--semantic-error, #ef4444);
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
