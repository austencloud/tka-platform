<!--
  CherryBlossomPreview.svelte

  Animated cherry blossom drift background with falling petals.
-->
<div class="background-preview cherry-blossom"></div>

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

  .cherry-blossom {
    /* Twilight gradient - deep purple sky fading to warm pink/peach horizon */
    background: linear-gradient(
      180deg,
      #1a1028 0%,
      #2d1f3d 25%,
      #4a2850 50%,
      #6b3a5c 70%,
      #8b4a60 85%,
      #a85a65 100%
    );
  }

  .cherry-blossom::before {
    content: "";
    position: absolute;
    top: -100%;
    left: -10%;
    width: 120%;
    height: 200%;
    /* Larger, more saturated pink petals with soft edges */
    background-image:
      radial-gradient(
        ellipse 18px 12px,
        rgba(255, 140, 170, 0.95) 0%,
        rgba(255, 180, 200, 0.6) 40%,
        transparent 70%
      ),
      radial-gradient(
        ellipse 14px 10px,
        rgba(255, 130, 165, 0.9) 0%,
        rgba(255, 170, 195, 0.5) 40%,
        transparent 70%
      ),
      radial-gradient(
        ellipse 20px 14px,
        rgba(255, 150, 180, 0.85) 0%,
        rgba(255, 190, 210, 0.5) 40%,
        transparent 70%
      ),
      radial-gradient(
        ellipse 16px 11px,
        rgba(255, 135, 168, 0.9) 0%,
        rgba(255, 175, 198, 0.55) 40%,
        transparent 70%
      ),
      radial-gradient(
        ellipse 12px 9px,
        rgba(255, 145, 175, 0.85) 0%,
        rgba(255, 185, 205, 0.5) 40%,
        transparent 70%
      );
    background-size:
      80px 90px,
      110px 100px,
      95px 85px,
      70px 105px,
      120px 95px;
    background-position:
      8% 12%,
      38% 35%,
      68% 22%,
      22% 65%,
      82% 48%;
    animation: cherry-fall 12s linear infinite;
    animation-delay: -6s;
    filter: blur(0.5px);
  }

  .cherry-blossom::after {
    content: "";
    position: absolute;
    top: -100%;
    left: -10%;
    width: 120%;
    height: 200%;
    /* Background layer - slightly smaller, more transparent */
    background-image:
      radial-gradient(
        ellipse 14px 10px,
        rgba(255, 160, 185, 0.7) 0%,
        rgba(255, 190, 210, 0.4) 40%,
        transparent 70%
      ),
      radial-gradient(
        ellipse 16px 11px,
        rgba(255, 150, 178, 0.65) 0%,
        rgba(255, 185, 205, 0.35) 40%,
        transparent 70%
      ),
      radial-gradient(
        ellipse 12px 9px,
        rgba(255, 155, 182, 0.6) 0%,
        rgba(255, 188, 208, 0.35) 40%,
        transparent 70%
      ),
      radial-gradient(
        ellipse 15px 10px,
        rgba(255, 145, 175, 0.65) 0%,
        rgba(255, 182, 202, 0.4) 40%,
        transparent 70%
      );
    background-size:
      95px 88px,
      130px 105px,
      75px 95px,
      105px 78px;
    background-position:
      18% 28%,
      52% 55%,
      78% 38%,
      35% 72%;
    animation: cherry-fall-slow 16s linear infinite;
    animation-delay: -10s;
    filter: blur(1px);
    opacity: 0.7;
  }

  @keyframes cherry-fall {
    0% {
      transform: translateY(0) translateX(0) rotate(0deg);
    }
    25% {
      transform: translateY(25%) translateX(6%) rotate(8deg);
    }
    50% {
      transform: translateY(50%) translateX(-4%) rotate(-5deg);
    }
    75% {
      transform: translateY(75%) translateX(5%) rotate(6deg);
    }
    100% {
      transform: translateY(100%) translateX(0) rotate(0deg);
    }
  }

  @keyframes cherry-fall-slow {
    0% {
      transform: translateY(0) translateX(0) rotate(0deg);
    }
    20% {
      transform: translateY(20%) translateX(-5%) rotate(-8deg);
    }
    40% {
      transform: translateY(40%) translateX(4%) rotate(6deg);
    }
    60% {
      transform: translateY(60%) translateX(-6%) rotate(-10deg);
    }
    80% {
      transform: translateY(80%) translateX(3%) rotate(4deg);
    }
    100% {
      transform: translateY(100%) translateX(0) rotate(0deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cherry-blossom::before,
    .cherry-blossom::after {
      animation: none !important;
    }
  }
</style>
