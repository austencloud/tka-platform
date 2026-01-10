<script lang="ts">
  /**
   * SupportWidget - 2026 Bento Box Style
   * Donation-focused for now, easy to convert to Premium later
   */

  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { SOCIAL_LINKS } from "$lib/shared/info/domain/content";

  let hapticService: IHapticFeedback | null = $state(null);
  let copiedEmail = $state(false);

  const paymentOptions = [
    {
      name: "PayPal",
      icon: "fab fa-paypal",
      url: "https://paypal.me/austencloud",
      bg: "#0070ba",
      hoverBg: "#005ea6",
    },
    {
      name: "Venmo",
      icon: "venmo",
      url: "https://venmo.com/austencloud",
      bg: "#008CFF",
      hoverBg: "#0070cc",
    },
    {
      name: "Zelle",
      icon: "fas fa-bolt",
      url: "austencloud@gmail.com",
      bg: "#6d1ed4",
      hoverBg: "#5a18b0",
    },
  ];

  onMount(() => {
    try {
      hapticService = container.items.hapticFeedback;
    } catch {
      // Service may not be available
    }
  });

  async function handlePaymentClick(
    event: MouseEvent,
    name: string,
    url: string
  ) {
    hapticService?.trigger("selection");
    if (name === "Zelle") {
      event.preventDefault();
      try {
        await navigator.clipboard.writeText(url);
        copiedEmail = true;
        hapticService?.trigger("success");
        setTimeout(() => (copiedEmail = false), 2500);
      } catch {
        window.location.href = `mailto:${url}?subject=Zelle%20Donation`;
      }
    }
  }

  function handleLinkClick() {
    hapticService?.trigger("selection");
  }
</script>

<div class="support-widget">
  <!-- Header with heart -->
  <div class="widget-header">
    <div class="heart-icon">
      <i class="fas fa-heart" aria-hidden="true"></i>
    </div>
    <div class="header-text">
      <h3>Love TKA?</h3>
      <p>Your support keeps this project free for everyone</p>
    </div>
  </div>

  <!-- Branded Donation Buttons -->
  <div class="donation-buttons">
    {#each paymentOptions as option}
      <a
        class="donate-btn"
        class:success={option.name === "Zelle" && copiedEmail}
        href={option.name === "Zelle" ? "#" : option.url}
        target={option.name === "Zelle" ? undefined : "_blank"}
        rel={option.name === "Zelle" ? undefined : "noopener noreferrer"}
        style="--btn-bg: {option.bg}; --btn-hover: {option.hoverBg}"
        onclick={(e) => handlePaymentClick(e, option.name, option.url)}
      >
        {#if option.icon === "venmo"}
          <svg viewBox="0 0 24 24" fill="currentColor" class="venmo-svg">
            <path
              d="M19.5 3c.5.8.7 1.7.7 2.8 0 3.5-3 8-5.4 11.2H8.6L6 3.5h5.2l1.5 12c1.2-2 2.7-5.2 2.7-7.3 0-1-.2-1.7-.5-2.3l6.6-.2z"
            />
          </svg>
        {:else}
          <i class={option.icon} aria-hidden="true"></i>
        {/if}
        <span>
          {option.name === "Zelle" && copiedEmail
            ? "Email Copied!"
            : option.name}
        </span>
      </a>
    {/each}
  </div>

  <!-- Social Links -->
  <div class="social-section">
    <span class="social-label">Connect with us</span>
    <div class="social-row">
      {#each SOCIAL_LINKS.slice(0, 4) as social}
        <a
          class="social-btn"
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          onclick={handleLinkClick}
          aria-label={social.name}
          style="--brand: {social.color}"
        >
          <i class={social.icon} aria-hidden="true"></i>
        </a>
      {/each}
    </div>
  </div>
</div>

<style>
  .support-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    background: linear-gradient(
      145deg,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 12%,
          transparent
        )
        0%,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 8%,
          transparent
        )
        100%
    );
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 24px;
  }

  /* Header */
  .widget-header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 24px;
  }

  .heart-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: linear-gradient(
      135deg,
      var(--theme-accent, var(--theme-accent)) 0%,
      var(--theme-accent-strong, var(--theme-accent-strong)) 100%
    );
    border-radius: 14px;
    color: white;
    font-size: var(--font-size-xl);
    flex-shrink: 0;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  .header-text h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--theme-text);
  }

  .header-text p {
    margin: 6px 0 0;
    font-size: 0.875rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    line-height: 1.4;
  }

  /* Donation Buttons */
  .donation-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  }

  .donate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: var(--min-touch-target);
    padding: 14px 20px;
    background: var(--btn-bg);
    border: none;
    border-radius: 14px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .donate-btn:hover {
    background: var(--btn-hover);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px
      color-mix(in srgb, var(--theme-shadow) 25%, transparent);
  }

  .donate-btn:active {
    transform: translateY(0);
  }

  .donate-btn.success {
    background: var(--semantic-success, var(--semantic-success)) !important;
  }

  .donate-btn i {
    font-size: var(--font-size-lg);
  }

  .venmo-svg {
    width: 20px;
    height: 20px;
  }

  /* Social Section */
  .social-section {
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid var(--theme-stroke);
  }

  .social-label {
    display: block;
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    text-align: center;
    margin-bottom: 12px;
  }

  .social-row {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .social-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-base);
    text-decoration: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .social-btn:hover {
    background: color-mix(in srgb, var(--brand) 20%, transparent);
    border-color: var(--brand);
    color: var(--brand);
    transform: translateY(-2px);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .support-widget {
      padding: 20px;
      border-radius: 20px;
    }

    .widget-header {
      margin-bottom: 20px;
    }

    .heart-icon {
      width: 44px;
      height: 44px;
      font-size: var(--font-size-lg);
    }

    .header-text h3 {
      font-size: 1.125rem;
    }

    .header-text p {
      font-size: 0.8125rem;
    }

    .donate-btn {
      min-height: var(--min-touch-target);
      padding: 12px 16px;
      font-size: 0.9375rem;
    }

    .social-btn {
      width: 38px;
      height: 38px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .heart-icon {
      animation: none;
    }

    .donate-btn,
    .social-btn {
      transition: none;
    }

    .donate-btn:hover,
    .social-btn:hover {
      transform: none;
    }
  }
</style>
