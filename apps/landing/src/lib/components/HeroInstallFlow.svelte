<!--
  HeroInstallFlow.svelte (Landing - standalone)

  Simplified install flow: primary CTA link to tkascribe.com,
  secondary "See how it works" smooth scroll.
  In-app browser detection still triggers redirect modal.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { detectPlatformAndBrowser, type Platform, type InAppBrowser } from "$lib/platform-detect";
  import InAppBrowserModal from "./InAppBrowserModal.svelte";

  const APP_DOMAIN = "https://tkascribe.com";

  let isInAppBrowser = $state(false);
  let platform = $state<Platform>("desktop");
  let inAppBrowser = $state<InAppBrowser>("none");
  let showInAppBrowserModal = $state(false);
  let detected = $state(false);

  const inAppBrowserNames: Record<InAppBrowser, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    tiktok: "TikTok",
    snapchat: "Snapchat",
    messenger: "Messenger",
    threads: "Threads",
    none: "",
  };

  const inAppBrowserName = $derived(
    inAppBrowserNames[inAppBrowser] || "this app"
  );
  const targetBrowser = $derived(platform === "ios" ? "Safari" : "Chrome");

  onMount(() => {
    const info = detectPlatformAndBrowser();
    platform = info.platform;
    inAppBrowser = info.inAppBrowser;
    isInAppBrowser = info.inAppBrowser !== "none";
    detected = true;
  });

  function handlePrimaryClick(e: MouseEvent) {
    if (isInAppBrowser) {
      e.preventDefault();
      showInAppBrowserModal = true;
    }
  }

  function scrollToWhat(e: MouseEvent) {
    e.preventDefault();
    const target = document.getElementById("what");
    target?.scrollIntoView({ behavior: "smooth" });
  }
</script>

<div class="install-flow" class:visible={detected}>
  <a href={APP_DOMAIN} class="btn btn-primary" onclick={handlePrimaryClick}>
    <span>Open TKA Scribe</span>
    <span class="arrow">&rarr;</span>
  </a>
  <button class="btn btn-secondary" onclick={scrollToWhat}>
    See how it works
  </button>
</div>

<InAppBrowserModal
  bind:isOpen={showInAppBrowserModal}
  {platform}
  inAppBrowserName={inAppBrowser !== "none" ? inAppBrowserName : ""}
  onClose={() => (showInAppBrowserModal = false)}
/>

<style>
  .install-flow {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .install-flow.visible {
    opacity: 1;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 28px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    text-decoration: none;
    transition: all 0.2s ease;
    cursor: pointer;
    border: none;
  }

  .btn-primary {
    background: #6366f1;
    color: white;
  }

  .btn-primary:hover {
    background: #818cf8;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    border: 1.5px solid rgba(255, 255, 255, 0.25);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: #6366f1;
  }

  .arrow {
    transition: transform 0.2s ease;
  }

  .btn:hover .arrow {
    transform: translateX(4px);
  }

  @media (max-width: 768px) {
    .install-flow {
      flex-direction: column;
      align-items: center;
      width: 100%;
    }

    .btn {
      width: 100%;
      max-width: 300px;
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .install-flow {
      transition: none;
      opacity: 1;
    }

    .btn,
    .arrow {
      transition: none;
    }
  }
</style>
