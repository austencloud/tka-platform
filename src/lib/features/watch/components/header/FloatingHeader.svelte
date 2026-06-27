<!--
  FloatingHeader

  Floating header that auto-hides on scroll down and shows on scroll up.
  Contains welcome message, InboxIcon, and AlertsIcon.
  Uses gradient background to blend with content.
-->
<script lang="ts">
  import InboxIcon from "./InboxIcon.svelte";
  import AlertsIcon from "./AlertsIcon.svelte";

  interface Props {
    welcomeMessage: string;
    isVisible?: boolean;
    onInboxClick?: () => void;
    onAlertsClick?: () => void;
  }

  const {
    welcomeMessage,
    isVisible = true,
    onInboxClick,
    onAlertsClick,
  }: Props = $props();
</script>

<header class="floating-header" class:hidden={!isVisible}>
  <div class="header-content">
    <div class="header-left"></div>
    <h1 class="welcome-message">{welcomeMessage}</h1>
    <div class="header-right">
      <InboxIcon onClick={onInboxClick} />
      <AlertsIcon onClick={onAlertsClick} />
    </div>
  </div>
</header>

<style>
  .floating-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding-top: max(12px, env(safe-area-inset-top));
    padding-bottom: 12px;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.8) 0%,
      rgba(0, 0, 0, 0.6) 60%,
      transparent 100%
    );
    transform: translateY(0);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;
  }

  .floating-header.hidden {
    transform: translateY(-100%);
    pointer-events: none;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    max-width: 600px;
    margin: 0 auto;
  }

  .header-left,
  .header-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .welcome-message {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: #fff;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    padding: 0 8px;
    /* Text shadow for readability over content */
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  @media (max-width: 480px) {
    .header-content {
      padding: 0 12px;
    }

    .welcome-message {
      font-size: var(--font-size-base, 16px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .floating-header {
      transition: none;
    }
  }
</style>
