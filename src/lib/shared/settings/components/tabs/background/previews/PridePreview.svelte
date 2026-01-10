<!--
  RainbowPreview.svelte

  Animated rainbow pride background preview with flowing color bands.
-->
<div class="background-preview rainbow"></div>

<style>
  .background-preview {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 0;
    overflow: hidden;
    will-change: transform;
  }

  .background-preview::before,
  .background-preview::after {
    will-change: transform, opacity;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    transform: translateZ(0);
  }

  .rainbow {
    background: linear-gradient(180deg, #0a0a15 0%, #12121f 50%, #0d0d18 100%);
  }

  .rainbow::before {
    content: "";
    position: absolute;
    top: -20%;
    left: -20%;
    width: 140%;
    height: 140%;
    background:
      /* Red band */
      linear-gradient(
        45deg,
        transparent 0%,
        rgba(140, 28, 28, 0.5) 10%,
        transparent 20%
      ),
      /* Orange band */
      linear-gradient(
        45deg,
        transparent 15%,
        rgba(140, 69, 19, 0.5) 25%,
        transparent 35%
      ),
      /* Yellow band */
      linear-gradient(
        45deg,
        transparent 30%,
        rgba(107, 107, 0, 0.5) 40%,
        transparent 50%
      ),
      /* Green band */
      linear-gradient(
        45deg,
        transparent 45%,
        rgba(0, 77, 26, 0.5) 55%,
        transparent 65%
      ),
      /* Blue band */
      linear-gradient(
        45deg,
        transparent 60%,
        rgba(26, 45, 92, 0.5) 70%,
        transparent 80%
      ),
      /* Purple band */
      linear-gradient(
        45deg,
        transparent 75%,
        rgba(74, 26, 92, 0.5) 85%,
        transparent 95%
      );
    animation: rainbow-flow 12s ease-in-out infinite;
    filter: blur(clamp(20px, 6cqi, 35px)) brightness(1.1);
  }

  .rainbow::after {
    content: "";
    position: absolute;
    top: -10%;
    left: -10%;
    width: 120%;
    height: 120%;
    background:
      radial-gradient(
        ellipse 30% 20% at 25% 40%,
        rgba(255, 100, 100, 0.3) 0%,
        transparent 50%
      ),
      radial-gradient(
        ellipse 25% 20% at 50% 50%,
        rgba(100, 255, 100, 0.25) 0%,
        transparent 50%
      ),
      radial-gradient(
        ellipse 28% 22% at 75% 60%,
        rgba(100, 100, 255, 0.3) 0%,
        transparent 50%
      );
    animation: rainbow-shimmer 8s ease-in-out infinite reverse;
    filter: blur(clamp(15px, 4cqi, 25px));
  }

  @keyframes rainbow-flow {
    0%,
    100% {
      transform: translateX(0) translateY(0);
      opacity: 0.7;
    }
    25% {
      transform: translateX(5%) translateY(3%);
      opacity: 0.9;
    }
    50% {
      transform: translateX(-3%) translateY(5%);
      opacity: 0.6;
    }
    75% {
      transform: translateX(-5%) translateY(2%);
      opacity: 0.8;
    }
  }

  @keyframes rainbow-shimmer {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.7;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rainbow::before,
    .rainbow::after {
      animation: none !important;
    }
  }
</style>
