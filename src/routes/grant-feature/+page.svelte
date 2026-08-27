<script lang="ts">
  import { onMount } from "svelte";

  let canvasWidth = $state(0);
  let canvasHeight = $state(0);

  async function renderToCanvas() {
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => drawCanvas(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = '/images/austen-fire.webp';

      function drawCanvas(artistImg: HTMLImageElement) {
        // Scale down to fit under 5MB limit
        const maxHeight = 1600;
        const aspectRatio = artistImg.naturalWidth / artistImg.naturalHeight;
        const height = Math.min(artistImg.naturalHeight, maxHeight);
        const width = Math.round(height * aspectRatio);
        canvasWidth = width;
        canvasHeight = height;
        const scale = height / 1080;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // === FULL-BLEED PHOTO (no shift) ===
        ctx.drawImage(artistImg, 0, 0, width, height);

        const topGradient = ctx.createLinearGradient(0, 0, 0, height * 0.25);
        topGradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        topGradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.5)');
        topGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = topGradient;
        ctx.fillRect(0, 0, width, height * 0.25);

        // Bottom gradient for chips
        const bottomGradient = ctx.createLinearGradient(0, height * 0.75, 0, height);
        bottomGradient.addColorStop(0, 'transparent');
        bottomGradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        ctx.fillStyle = bottomGradient;
        ctx.fillRect(0, height * 0.75, width, height * 0.25);

        const centerX = width / 2;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 20 * scale;

        // Main title
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${72 * scale}px "Palatino Linotype", Georgia, serif`;
        ctx.fillText('The Kinetic Alphabet', centerX, 100 * scale);

        // Tagline (letter spacing handled manually)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `${32 * scale}px system-ui, sans-serif`;

        // Manual letter spacing for tagline
        const tagline = 'A FLOW ARTS CHOREOGRAPHY TOOLBOX';
        const taglineLetterSpacing = 5 * scale;
        const taglineMetrics = ctx.measureText(tagline);
        const taglineTotalWidth = taglineMetrics.width + (tagline.length - 1) * taglineLetterSpacing;
        let taglineX = centerX - taglineTotalWidth / 2;

        for (let i = 0; i < tagline.length; i++) {
          const char = tagline.charAt(i);
          ctx.fillText(char, taglineX, 160 * scale);
          taglineX += ctx.measureText(char).width + taglineLetterSpacing;
        }
        ctx.restore();

        // === FEATURE CHIPS - BOTTOM ROW WITH EVEN PADDING ===
        const chips = ['Create choreography', 'Visualize patterns', 'Browse creators', 'Share sequences'];
        const edgePadding = 80 * scale; // Padding from edges
        const chipGap = 24 * scale; // Fixed gap between chips
        const chipY = height - edgePadding - 30 * scale;
        const chipWidth = 195 * scale;
        const chipHeight = 58 * scale;
        const totalWidth = (chips.length * chipWidth) + ((chips.length - 1) * chipGap);
        const startX = (width - totalWidth) / 2; // Center the whole row

        ctx.save();
        ctx.font = `600 ${20 * scale}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 12 * scale;

        chips.forEach((chip, i) => {
          const x = startX + (chipWidth / 2) + (i * (chipWidth + chipGap));

          // Chip background - warm fire gradient
          const chipGradient = ctx.createLinearGradient(
            x - chipWidth / 2, chipY,
            x + chipWidth / 2, chipY
          );
          chipGradient.addColorStop(0, 'rgba(180, 80, 30, 0.7)');
          chipGradient.addColorStop(0.5, 'rgba(200, 100, 40, 0.8)');
          chipGradient.addColorStop(1, 'rgba(180, 80, 30, 0.7)');

          ctx.fillStyle = chipGradient;
          ctx.strokeStyle = 'rgba(255, 180, 100, 0.6)';
          ctx.lineWidth = 2 * scale;
          ctx.beginPath();
          ctx.roundRect(x - chipWidth / 2, chipY - chipHeight / 2, chipWidth, chipHeight, 26 * scale);
          ctx.fill();
          ctx.stroke();

          // Chip text
          ctx.fillStyle = '#ffffff';
          ctx.fillText(chip, x, chipY + 7 * scale);
        });
        ctx.restore();

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      }
    });
  }

  let previewDataUrl = $state<string>("");
  let isRendering = $state(true);

  async function exportImage() {
    if (!previewDataUrl) return;
    const link = document.createElement('a');
    link.download = `tka-grant-feature-${canvasWidth}x${canvasHeight}.jpg`;
    link.href = previewDataUrl;
    link.click();
  }

  onMount(async () => {
    try {
      isRendering = true;
      previewDataUrl = await renderToCanvas();
      isRendering = false;
    } catch (error) {
      console.error("Failed to generate preview:", error);
      isRendering = false;
    }
  });
</script>

<svelte:head>
  <title>The Kinetic Alphabet - Grant Feature Image</title>
</svelte:head>

<div class="page">
  {#if isRendering}
    <div class="status">
      <h1>Generating preview...</h1>
    </div>
  {:else}
    <div class="preview-container">
      <img src={previewDataUrl} alt="Grant feature preview" class="preview-image" />
    </div>

    <div class="export-controls">
      <p class="resolution">{canvasWidth} x {canvasHeight} pixels</p>
      <button class="export-btn" onclick={exportImage}>
        Export PNG
      </button>
    </div>
  {/if}
</div>

<style>
  .page {
    min-height: 100vh;
    background: #0a0a0a;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    gap: 30px;
  }

  .status {
    text-align: center;
    color: #ffffff;
  }

  .status h1 {
    font-size: 32px;
    color: #c084fc;
  }

  .preview-container {
    width: 100%;
    max-width: 1600px;
    display: flex;
    justify-content: center;
    background: #000;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  }

  .preview-image {
    width: 100%;
    height: auto;
    display: block;
  }

  .export-controls {
    text-align: center;
  }

  .resolution {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    margin-bottom: 12px;
  }

  .export-btn {
    padding: 16px 32px;
    background: #6366f1;
    border: none;
    color: white;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: background var(--duration-normal);
  }

  .export-btn:hover {
    background: #4f46e5;
  }
</style>
