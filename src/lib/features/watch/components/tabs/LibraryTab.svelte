<!--
  LibraryTab.svelte

  Wraps the existing UserVideoLibraryView component for the Watch module.
  Shows user's personal video library with sub-tabs for:
  - All videos
  - My videos (created by user)
  - Collaborations (invited to)
  - Pending invites
-->
<script lang="ts">
  import UserVideoLibraryView from "$lib/shared/video-collaboration/components/UserVideoLibraryView.svelte";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/collaborative-video";

  interface Props {
    onVideoClick?: (video: CollaborativeVideo) => void;
  }

  const { onVideoClick }: Props = $props();
</script>

<div class="library-tab">
  <UserVideoLibraryView {onVideoClick} />
</div>

<style>
  .library-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
</style>
