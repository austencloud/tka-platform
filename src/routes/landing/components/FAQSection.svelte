<script lang="ts">
  const faqs = [
    {
      question: "What is The Kinetic Alphabet?",
      answer:
        "The Kinetic Alphabet (TKA) is a notation system for flow arts. It uses pictographs to document choreography visually, allowing flow artists to share and learn sequences without relying solely on video or verbal descriptions.",
    },
    {
      question: "How is this different from other notation systems?",
      answer:
        "TKA builds on ideas from Vulcan Tech Gospel (VTG) and extends them into a comprehensive pictograph-based system. The visual approach means you can read a sequence immediately without memorizing terminology first.",
    },
    {
      question: "Do I need to memorize the letter system?",
      answer:
        "No. The pictographs are immediately readable without memorization. The letter system is optional and provides a way to verbalize and reference sequences by name once you want to go deeper.",
    },
    {
      question: "Can I use this for teaching?",
      answer:
        "Yes. Educators use TKA to create visual curriculum, assign sequences for students to learn, and provide feedback. The pictographs communicate more precisely than verbal descriptions alone.",
    },
  ];
</script>

<section class="faq" id="faq">
  <div class="container">
    <h2>Questions</h2>
    <div class="faq-list">
      {#each faqs as faq}
        <details class="faq-item">
          <summary>{faq.question}</summary>
          <p>{faq.answer}</p>
        </details>
      {/each}
    </div>
  </div>
</section>

<style>
  .faq {
    padding: 120px 24px;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
  }

  h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    margin-bottom: 2rem;
    text-align: center;
    font-weight: 600;
    line-height: 1.2;
  }

  .faq-list {
    max-width: 700px;
    margin: 0 auto;
  }

  .faq-item {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    margin-bottom: 12px;
    overflow: hidden;
  }

  .faq-item summary {
    padding: 20px 24px;
    cursor: pointer;
    font-weight: 500;
    font-size: 1rem;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.2s ease;
  }

  .faq-item summary:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
  }

  .faq-item summary::-webkit-details-marker {
    display: none;
  }

  .faq-item summary::after {
    content: "+";
    font-size: 1.5rem;
    color: var(--theme-accent-strong, #818cf8);
    font-weight: 300;
    transition: transform 0.2s ease;
  }

  .faq-item[open] summary::after {
    content: "-";
  }

  .faq-item p {
    padding: 0 24px 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.6;
  }

  @media (max-width: 600px) {
    .faq {
      padding: 80px 24px;
    }

    .faq-item summary {
      padding: 16px 20px;
    }

    .faq-item p {
      padding: 0 20px 16px;
    }
  }
</style>
