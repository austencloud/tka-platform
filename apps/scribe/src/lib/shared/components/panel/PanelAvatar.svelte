<script lang="ts">
  /**
   * PanelAvatar - User avatar with fallback
   *
   * Thin wrapper around RobustAvatar for panel contexts.
   * Provides robust avatar rendering with automatic retry and fallback.
   */

  import RobustAvatar from "../avatar/RobustAvatar.svelte";

  type AvatarSize = "sm" | "md" | "lg";

  interface Props {
    /** Image source URL */
    src?: string | null;
    /** Alt text for the image */
    alt: string;
    /** Avatar size */
    size?: AvatarSize;
    /** User's display name for fallback initials */
    name?: string | null;
    /** Google user ID for fallback URL construction */
    googleId?: string | null;
  }

  let { src, alt, size = "md", name, googleId }: Props = $props();

  const sizeMap: Record<AvatarSize, number> = {
    sm: 40,
    md: 80,
    lg: 120,
  };

  const dimension = $derived(sizeMap[size]);
</script>

<div
  class="panel-avatar"
  style:width="{dimension}px"
  style:height="{dimension}px"
>
  <RobustAvatar {src} {alt} {name} {googleId} customSize={dimension} />
</div>

<style>
  .panel-avatar {
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }
</style>
