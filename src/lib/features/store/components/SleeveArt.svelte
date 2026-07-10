<!-- src/lib/features/store/components/SleeveArt.svelte -->
<!--
  CSS stand-in for the waterproof sleeved card holder + lanyard, following the
  BookCoverArt placeholder pattern. Replace with a real product photo once the
  physical holder exists. Decorative: hosts label the product in text.
-->
<script lang="ts">
  let { width = "clamp(150px, 11vw, 210px)" }: { width?: string } = $props();
</script>

<div class="sleeve" style:width aria-hidden="true">
  <div class="lanyard"></div>
  <div class="clip"></div>
  <div class="pouch">
    <div class="card">
      <span class="card-word">MNX-</span>
      <span class="card-grid"></span>
    </div>
    <div class="shine"></div>
  </div>
  <span class="sleeve-sub">waterproof holder</span>
</div>

<style>
  .sleeve {
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: rotate(2deg);
  }

  /* Black cord arcing up out of frame. */
  .lanyard {
    width: 62%;
    height: 46px;
    border: 5px solid #1c1c22;
    border-bottom: none;
    border-radius: 50% 50% 0 0 / 100% 100% 0 0;
  }

  .clip {
    width: 16px;
    height: 12px;
    border-radius: 3px;
    background: linear-gradient(180deg, #9aa2b1, #5c6372);
    margin-top: -2px;
  }

  /* Clear pouch: translucent panel with a card inside and a plastic shine. */
  .pouch {
    position: relative;
    width: 100%;
    aspect-ratio: 2.5 / 3.5;
    margin-top: 2px;
    border-radius: 12px;
    border: 2px solid rgba(255, 255, 255, 0.45);
    background: rgba(255, 255, 255, 0.07);
    box-shadow: 14px 18px 36px rgba(0, 0, 0, 0.45);
    display: grid;
    place-items: center;
    padding: 7%;
    overflow: hidden;
  }

  .card {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    background: #f4f2ec;
    border: 4px solid #8d8d92;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 10%;
    gap: 10%;
  }
  .card-word {
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #22242c;
    font-size: clamp(0.8rem, 1vw, 1.05rem);
  }
  /* Abstract pictograph-ish grid mark. */
  .card-grid {
    width: 52%;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid rgba(34, 36, 44, 0.5);
    position: relative;
  }
  .card-grid::before,
  .card-grid::after {
    content: "";
    position: absolute;
    background: rgba(34, 36, 44, 0.4);
  }
  .card-grid::before {
    inset: 50% 6% auto 6%;
    height: 2px;
    margin-top: -1px;
  }
  .card-grid::after {
    inset: 6% auto 6% 50%;
    width: 2px;
    margin-left: -1px;
  }

  .shine {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      115deg,
      transparent 30%,
      rgba(255, 255, 255, 0.22) 42%,
      rgba(255, 255, 255, 0.05) 55%,
      transparent 62%
    );
    pointer-events: none;
  }

  .sleeve-sub {
    margin-top: 12px;
    font-size: var(--font-size-compact, 12px);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
  }
</style>
