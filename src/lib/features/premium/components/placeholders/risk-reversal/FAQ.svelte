<!-- FAQ - Frequently Asked Questions to address objections -->
<script lang="ts">
  interface FAQItem {
    id: string;
    question: string;
    answer: string;
    category?: "billing" | "features" | "support" | "technical";
  }

  interface Props {
    items?: FAQItem[];
    defaultExpanded?: boolean;
  }

  let { items = [], defaultExpanded = false }: Props = $props();

  const defaultFAQs: FAQItem[] = [
    {
      id: "what-included",
      question: "What exactly do I get with premium?",
      answer:
        "Unlimited sequence generation, full access to Compose and Train modules, and priority support. All premium features are clearly marked throughout the app.",
      category: "features",
    },
    {
      id: "cancel",
      question: "Can I cancel anytime?",
      answer:
        "Yes, absolutely. Cancel your subscription anytime from your account settings. You'll keep access until the end of your billing period.",
      category: "billing",
    },
    {
      id: "secure",
      question: "Is my payment secure?",
      answer:
        "All payments are processed by Stripe, the industry standard for secure online payments. We never see or store your payment information.",
      category: "billing",
    },
    {
      id: "refund",
      question: "What if I'm not satisfied?",
      answer:
        "We offer a 30-day money-back guarantee. If premium isn't right for you, email support@tka.com within 30 days for a full refund.",
      category: "billing",
    },
  ];

  const displayItems = $derived(items.length > 0 ? items : defaultFAQs);

  let openItems = $state<Set<string>>(new Set());

  // Sync open items when defaultExpanded or items change
  $effect(() => {
    const currentItems = items.length > 0 ? items : defaultFAQs;
    openItems = defaultExpanded
      ? new Set(currentItems.map((i) => i.id))
      : new Set();
  });

  function toggle(id: string) {
    const newOpen = new Set(openItems);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    openItems = newOpen;
  }
</script>

<div class="faq">
  <h3>Frequently Asked Questions</h3>
  <div class="faq-list">
    {#each displayItems as item (item.id)}
      <div class="faq-item">
        <button class="faq-question" onclick={() => toggle(item.id)}>
          <span>{item.question}</span>
          <i
            class="fas fa-chevron-{openItems.has(item.id) ? 'up' : 'down'}"
            aria-hidden="true"
          ></i>
        </button>
        {#if openItems.has(item.id)}
          <div class="faq-answer">
            {item.answer}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .faq {
    margin: var(--spacing-lg, 24px) 0;
  }

  h3 {
    font-size: clamp(20px, 3vw, 28px);
    font-weight: 600;
    text-align: center;
    margin: 0 0 var(--spacing-md, 16px);
    color: var(--theme-text);
  }

  .faq-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .faq-item {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    overflow: hidden;
  }

  .faq-question {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md, 16px);
    background: transparent;
    border: none;
    color: var(--theme-text);
    font-size: var(--font-size-min);
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    transition: background var(--transition-fast, 150ms ease);
  }

  .faq-question:hover {
    background: var(--theme-card-hover-bg);
  }

  .faq-question i {
    flex-shrink: 0;
    color: var(--theme-accent, var(--theme-accent));
    transition: transform var(--transition-fast, 150ms ease);
  }

  .faq-answer {
    padding: 0 var(--spacing-md, 16px) var(--spacing-md, 16px);
    font-size: var(--font-size-min);
    color: var(--theme-text-dim);
    line-height: 1.6;
    animation: slideDown 200ms ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .faq-answer {
      animation: none;
    }
  }
</style>
