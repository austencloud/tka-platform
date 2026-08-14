<script lang="ts">
  interface Props {
    compact?: boolean;
  }

  let { compact = false }: Props = $props();
</script>

<section
  class="contact-boundary"
  class:compact
  aria-labelledby="contact-boundary-title"
  data-testid="contact-viewer-required"
>
  <div class="contact-mark" aria-hidden="true">
    <span class="palm"></span>
    <span class="ball ball-one"></span>
    <span class="ball ball-two"></span>
  </div>

  <div class="copy">
    <p class="eyebrow">Different motion discipline</p>
    <h2 id="contact-boundary-title">Contact juggling needs its own viewer</h2>
    <p>
      These balls roll across palms and fingers. The full-body spinner stage
      cannot show that honestly, so this prop remains available in 2D while
      Contact Lab is built around the hands.
    </p>
    <div class="status-line">
      <i class="fas fa-hand" aria-hidden="true"></i>
      <span>Hand-level motion proof in progress</span>
    </div>
  </div>
</section>

<style>
  .contact-boundary {
    --contact-blue: var(--dm-motion-blue, #4b8cff);
    --contact-red: var(--dm-motion-red, #ff5263);
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: minmax(8rem, 0.62fr) minmax(17rem, 1.38fr);
    align-items: center;
    gap: clamp(1.5rem, 5cqw, 5rem);
    padding: clamp(1.5rem, 7cqw, 7rem);
    color: var(--theme-text, #f7f8ff);
    background:
      radial-gradient(
        circle at 22% 42%,
        rgba(75, 140, 255, 0.17),
        transparent 29%
      ),
      radial-gradient(
        circle at 78% 64%,
        rgba(255, 82, 99, 0.12),
        transparent 32%
      ),
      linear-gradient(145deg, #0b1020 0%, #11182c 52%, #090d18 100%);
    overflow: hidden;
    container-type: size;
  }

  .contact-boundary::after {
    content: "";
    position: absolute;
    inset: 8%;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: clamp(1.25rem, 3cqw, 3rem);
    pointer-events: none;
  }

  .contact-mark {
    position: relative;
    width: min(30cqw, 22rem);
    aspect-ratio: 1;
    justify-self: end;
    filter: drop-shadow(0 1.5rem 2.5rem rgba(0, 0, 0, 0.45));
  }

  .palm {
    position: absolute;
    left: 17%;
    right: 17%;
    bottom: 12%;
    height: 46%;
    border-radius: 48% 48% 36% 36%;
    border: clamp(0.35rem, 0.8cqw, 0.75rem) solid rgba(229, 217, 205, 0.72);
    border-top-color: transparent;
    transform: perspective(18rem) rotateX(34deg);
  }

  .palm::before,
  .palm::after {
    content: "";
    position: absolute;
    top: -62%;
    width: 27%;
    height: 90%;
    border: clamp(0.3rem, 0.7cqw, 0.66rem) solid rgba(229, 217, 205, 0.72);
    border-bottom: 0;
    border-radius: 999px 999px 0 0;
  }

  .palm::before {
    left: 11%;
    transform: rotate(-8deg);
  }

  .palm::after {
    right: 11%;
    transform: rotate(8deg);
  }

  .ball {
    position: absolute;
    top: 23%;
    width: 31%;
    aspect-ratio: 1;
    border-radius: 50%;
    box-shadow:
      inset -0.65rem -0.9rem 1.4rem rgba(0, 0, 0, 0.38),
      inset 0.45rem 0.4rem 0.8rem rgba(255, 255, 255, 0.36),
      0 1rem 2rem rgba(0, 0, 0, 0.36);
  }

  .ball-one {
    left: 20%;
    background: var(--contact-blue);
  }

  .ball-two {
    right: 20%;
    background: var(--contact-red);
  }

  .copy {
    position: relative;
    z-index: 1;
    max-width: 48rem;
  }

  .eyebrow {
    margin: 0 0 0.75rem;
    color: #8bb4ff;
    font-size: clamp(0.75rem, 1.4cqw, 1rem);
    font-weight: 760;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    max-width: 16ch;
    font-size: clamp(1.85rem, 4.5cqw, 4.5rem);
    line-height: 0.98;
    letter-spacing: -0.045em;
  }

  .copy > p:not(.eyebrow) {
    margin: 1.2rem 0 0;
    max-width: 58ch;
    color: var(--theme-text-secondary, rgba(237, 241, 255, 0.72));
    font-size: clamp(0.9rem, 1.55cqw, 1.18rem);
    line-height: 1.58;
  }

  .status-line {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    min-height: 2.75rem;
    margin-top: 1.35rem;
    padding: 0 1rem;
    border: 1px solid rgba(139, 180, 255, 0.28);
    border-radius: 999px;
    background: rgba(75, 140, 255, 0.1);
    color: #bfd5ff;
    font-size: max(var(--font-size-min, 14px), 0.85rem);
    font-weight: 650;
  }

  @container (max-width: 40rem) {
    .contact-boundary {
      grid-template-columns: 1fr;
      place-content: center;
      text-align: center;
    }

    .contact-mark {
      width: min(42cqw, 14rem);
      justify-self: center;
    }

    h2,
    .copy,
    .copy > p:not(.eyebrow) {
      margin-inline: auto;
    }
  }

  @container (max-height: 31rem) {
    .contact-boundary {
      grid-template-columns: minmax(7rem, 0.45fr) minmax(18rem, 1.55fr);
      gap: 1.5rem;
      padding: 1.1rem 2rem;
      text-align: left;
    }

    .contact-mark {
      width: min(24cqh, 10rem);
      justify-self: end;
    }

    h2 {
      font-size: clamp(1.55rem, 6cqh, 2.5rem);
    }

    .copy > p:not(.eyebrow) {
      margin-top: 0.7rem;
      font-size: max(var(--font-size-min, 14px), 0.82rem);
      line-height: 1.4;
    }

    .status-line {
      margin-top: 0.8rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .contact-boundary,
    .contact-mark {
      scroll-behavior: auto;
    }
  }
</style>
