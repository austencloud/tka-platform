<!--
  Embed: Spinner

  Minimal, frameless page for embedding the animation demo in an iframe.
  Used by tkaflowarts.com's NotationShowcaseSection.

  No header, no footer, no navigation. Just the animation.
  Sends postMessage to parent with "ready" when loaded.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import LandingAnimationDemo from "../../landing/components/LandingAnimationDemo.svelte";

  onMount(() => {
    // Signal to parent iframe that embed is ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: "tka-embed-ready" }, "*");
    }
  });
</script>

<svelte:head>
  <title>TKA Animation Demo</title>
  <meta name="robots" content="noindex, nofollow" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background: transparent;
      overflow: hidden;
    }
  </style>
</svelte:head>

<div class="embed-container">
  <LandingAnimationDemo />
</div>

<style>
  .embed-container {
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #030308;
    padding: 16px;
    box-sizing: border-box;
  }
</style>
