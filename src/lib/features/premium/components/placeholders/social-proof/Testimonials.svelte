<!-- Testimonials - User quotes with photos/names -->
<script lang="ts">
  interface Testimonial {
    id: string;
    quote: string;
    author: string;
    location: string;
    photoUrl?: string;
    userId?: string; // If TKA user, link to profile
  }

  interface Props {
    testimonials?: Testimonial[];
    maxVisible?: number;
  }

  let { testimonials = [], maxVisible = 3 }: Props = $props();
</script>

<div class="testimonials">
  <h3>What Flow Artists Say</h3>
  <div class="testimonial-grid">
    {#each testimonials.slice(0, maxVisible) as testimonial (testimonial.id)}
      <div class="testimonial-card">
        <div class="quote">"{testimonial.quote}"</div>
        <div class="author">
          {#if testimonial.photoUrl}
            <img src={testimonial.photoUrl} alt={testimonial.author} />
          {:else}
            <div class="placeholder-avatar">
              <i class="fas fa-user" aria-hidden="true"></i>
            </div>
          {/if}
          <div class="author-info">
            <div class="name">{testimonial.author}</div>
            <div class="location">{testimonial.location}</div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .testimonials {
    margin: var(--spacing-lg, 24px) 0;
  }

  h3 {
    font-size: clamp(20px, 3vw, 28px);
    font-weight: 600;
    text-align: center;
    margin: 0 0 var(--spacing-md, 16px);
    color: var(--theme-text);
  }

  .testimonial-grid {
    display: grid;
    gap: var(--spacing-md, 16px);
    grid-template-columns: 1fr;
  }

  @media (min-width: 768px) {
    .testimonial-grid {
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    }
  }

  .testimonial-card {
    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
  }

  .quote {
    font-size: var(--font-size-min);
    color: var(--theme-text);
    margin-bottom: var(--spacing-md, 16px);
    font-style: italic;
  }

  .author {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .author img,
  .placeholder-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  .placeholder-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(
      --gradient-primary,
      linear-gradient(
        135deg,
        var(--theme-accent) 0%,
        var(--theme-accent-strong) 100%
      )
    );
    color: white;
  }

  .name {
    font-size: var(--font-size-min);
    font-weight: 600;
    color: var(--theme-text);
  }

  .location {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }
</style>
