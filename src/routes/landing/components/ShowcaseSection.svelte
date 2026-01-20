<script lang="ts">
  const VIDEO_URL =
    "https://storage.googleapis.com/the-kinetic-alphabet.firebasestorage.app/users/PBp3GSBO6igCKPwJyLZNmVEmamI3/recordings/X-BΦ-θ-/1768875548469.mp4";
  const SEQUENCE_WORD = "X-BΦ-Θ-";
</script>

<section class="showcase" id="showcase">
  <div class="container">
    <h2>See It In Action</h2>
    <p class="section-intro">
      A real sequence performed with double staves. The pictographs become movement.
    </p>

    <div class="video-container">
      <video
        controls
        playsinline
        preload="metadata"
        poster=""
        aria-label="Performance video of sequence {SEQUENCE_WORD}"
      >
        <source src={VIDEO_URL} type="video/mp4" />
        Your browser does not support video playback.
      </video>

      <div class="video-caption">
        <span class="word-label">Word:</span>
        <span class="word-value">{SEQUENCE_WORD}</span>
      </div>
    </div>

    <div class="context">
      <p>
        Taught at FireDrums, FLAME, and Kinetic Fire. Supported by Fund the Flow Arts.
      </p>
    </div>
  </div>
</section>

<style>
  .showcase {
    padding: 80px 24px 120px;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
  }

  h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 600;
    line-height: 1.2;
  }

  .section-intro {
    text-align: center;
    font-size: 1.125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    max-width: 600px;
    margin: 0 auto 40px;
  }

  .video-container {
    position: relative;
    max-width: 600px;
    margin: 0 auto 32px;
  }

  video {
    width: 100%;
    border-radius: 16px;
    background: rgba(0, 0, 0, 0.3);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  }

  .video-caption {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 16px;
    font-size: 1rem;
  }

  .word-label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .word-value {
    font-family: Georgia, serif;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-accent, #6366f1);
  }

  .context {
    text-align: center;
    margin-top: 40px;
  }

  .context p {
    font-size: 0.9375rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  @media (max-width: 600px) {
    .showcase {
      padding: 60px 16px 80px;
    }

    .video-container {
      max-width: 100%;
    }
  }
</style>
