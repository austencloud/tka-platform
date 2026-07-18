<script lang="ts">
  // WING 4 — Connect. A Featured-creators row built from the REAL CreatorCard
  // primitive (src/lib/features/browse/creators/components/CreatorCard.svelte),
  // which is pure-props: no auth, no Firestore, no context. On the live /composer
  // this row binds to getFeaturedCreators(); here it renders static placeholder
  // creators (clearly not real users) so the layout evaluates signed-out.
  // currentUserId=undefined hides the follow button, so there is no live path.
  import PanelGrid from "$lib/shared/components/panel/PanelGrid.svelte";
  import CreatorCard from "$lib/features/browse/creators/components/CreatorCard.svelte";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";

  const now = Date.now();
  const HOUR = 3_600_000;
  const DAY = 86_400_000;

  // Placeholder creators — fictional handles for a layout tease, not real people.
  const creators: EnhancedUserProfile[] = [
    { id: "demo-ember", username: "emberloop", displayName: "Ember Loop", sequenceCount: 64, collectionCount: 5, followerCount: 212, followingCount: 38, joinedDate: new Date(2024, 2, 4), lastActiveAt: new Date(now - 2 * HOUR), isFeatured: true, isFollowing: false },
    { id: "demo-koi", username: "koivortex", displayName: "Koi Vortex", sequenceCount: 128, collectionCount: 9, followerCount: 486, followingCount: 51, joinedDate: new Date(2023, 10, 18), lastActiveAt: new Date(now - 20 * HOUR), isFeatured: true, isFollowing: false },
    { id: "demo-sable", username: "sablewave", displayName: "Sable Wave", sequenceCount: 41, collectionCount: 3, followerCount: 97, followingCount: 22, joinedDate: new Date(2024, 5, 1), lastActiveAt: new Date(now - 5 * DAY), isFeatured: true, isFollowing: false },
    { id: "demo-cinder", username: "cinderquill", displayName: "Cinder Quill", sequenceCount: 203, collectionCount: 14, followerCount: 810, followingCount: 63, joinedDate: new Date(2023, 6, 27), lastActiveAt: new Date(now - 40 * HOUR), isFeatured: true, isFollowing: false },
    { id: "demo-jade", username: "jadehelix", displayName: "Jade Helix", sequenceCount: 77, collectionCount: 6, followerCount: 154, followingCount: 44, joinedDate: new Date(2024, 0, 12), lastActiveAt: new Date(now - 30 * HOUR), isFeatured: true, isFollowing: false },
  ];
</script>

<div class="creator-row">
  <PanelGrid columns={5} gap="20px">
    {#each creators as user (user.id)}
      <CreatorCard
        {user}
        currentUserId={undefined}
        onUserClick={() => {}}
        onFollowToggle={() => {}}
      />
    {/each}
  </PanelGrid>
</div>

<style>
  .creator-row {
    width: 100%;
  }
</style>
