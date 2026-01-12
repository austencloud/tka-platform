<script lang="ts">
  import { onMount } from "svelte";

  async function renderToCanvas() {
    return new Promise<string>((resolve, reject) => {
      const width = 1920;
      const height = 1080;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Track loaded images
      let loadedImages = 0;
      const totalImages = 10; // artist photo + 6 props + 3 sequence thumbnails

      const images: Record<string, HTMLImageElement> = {};
      const imageUrls = {
        artist: '/images/austen-fire.jpg',
        prop1: '/images/props/staff.svg',
        prop2: '/images/props/fan.svg',
        prop3: '/images/props/triad.svg',
        prop4: '/images/props/club.svg',
        prop5: '/images/props/buugeng.svg',
        prop6: '/images/props/doublestar.svg',
        seq1: '/thumbnails/staff/ABC_light.webp',
        seq2: '/thumbnails/staff/AABB_light.webp',
        seq3: '/thumbnails/staff/AKE_light.webp',
      };

      // Load all images
      console.log("Loading images:", Object.keys(imageUrls));
      Object.entries(imageUrls).forEach(([key, url]) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          console.log(`Loaded ${key}: ${url}`);
          images[key] = img;
          loadedImages++;
          console.log(`Progress: ${loadedImages}/${totalImages}`);
          if (loadedImages === totalImages) {
            console.log("All images loaded, drawing canvas...");
            drawCanvas();
          }
        };
        img.onerror = (e) => {
          console.error(`Failed to load image ${key}: ${url}`, e);
          loadedImages++;
          console.log(`Progress (with error): ${loadedImages}/${totalImages}`);
          if (loadedImages === totalImages) {
            console.log("All images processed (some failed), drawing canvas...");
            drawCanvas();
          }
        };
        img.src = url;
      });

      function drawCanvas() {
        // Background gradient - BLUE on right, RED on left
        const gradient = ctx.createRadialGradient(width * 0.75, height * 0.5, 0, width * 0.75, height * 0.5, width * 0.35);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.30)'); // Blue on right
        gradient.addColorStop(0.6, 'transparent');

        const gradient2 = ctx.createRadialGradient(width * 0.25, height * 0.5, 0, width * 0.25, height * 0.5, width * 0.35);
        gradient2.addColorStop(0, 'rgba(239, 68, 68, 0.30)'); // Red on left
        gradient2.addColorStop(0.6, 'transparent');

        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#0a0510');
        bgGradient.addColorStop(0.5, '#0f0a1e');
        bgGradient.addColorStop(1, '#051019');

        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, width, height);

        // Center divider line
        const dividerGradient = ctx.createLinearGradient(width / 2, height * 0.1, width / 2, height * 0.9);
        dividerGradient.addColorStop(0, 'transparent');
        dividerGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.4)');
        dividerGradient.addColorStop(1, 'transparent');
        ctx.strokeStyle = dividerGradient;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();

        // Left side - Artist photo
        if (images.artist) {
          ctx.save();
          ctx.drawImage(images.artist, 0, 0, width / 2, height);

          // Very light gradient overlay on artist photo (just enough to make text readable)
          const overlayGradient = ctx.createLinearGradient(0, 0, width / 2, 0);
          overlayGradient.addColorStop(0, 'rgba(10, 5, 16, 0.0)');
          overlayGradient.addColorStop(0.7, 'rgba(10, 5, 16, 0.15)');
          overlayGradient.addColorStop(1, 'rgba(10, 5, 16, 0.6)');
          ctx.fillStyle = overlayGradient;
          ctx.fillRect(0, 0, width / 2, height);
          ctx.restore();
        }

        // Artist attribution
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '16px system-ui, sans-serif';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 12;
        ctx.fillText('Created by', 40, height - 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 20px system-ui, sans-serif';
        ctx.fillText('Austen Cloud', 40, height - 35);
        ctx.restore();

        // Right side - Notation
        const rightStart = width / 2;
        const centerX = rightStart + (width / 2) / 2;

        // Draw prop decorations - 6 unique props, alternating red and blue
        const propConfig = [
          // Staff (red) - top left area
          { img: 'prop1', x: rightStart + 100, y: 80, size: 100, rotate: -15, color: 'red' },

          // Fan (blue) - top right area
          { img: 'prop2', x: width - 100, y: 80, size: 105, rotate: 20, color: 'blue' },

          // Triad (red) - bottom left area
          { img: 'prop3', x: rightStart + 110, y: height - 80, size: 115, rotate: 10, color: 'red' },

          // Club (blue) - bottom right area
          { img: 'prop4', x: width - 110, y: height - 80, size: 100, rotate: -12, color: 'blue' },

          // Buugeng (red) - middle left
          { img: 'prop5', x: rightStart + 85, y: height / 2, size: 95, rotate: -25, color: 'red' },

          // Doublestar (blue) - middle right
          { img: 'prop6', x: width - 85, y: height / 2, size: 95, rotate: 25, color: 'blue' },
        ];

        propConfig.forEach(prop => {
          if (images[prop.img]) {
            ctx.save();
            ctx.globalAlpha = 0.65;
            ctx.translate(prop.x, prop.y);
            ctx.rotate((prop.rotate * Math.PI) / 180);

            // Preserve aspect ratio - scale based on the longest dimension
            const img = images[prop.img];
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            let drawWidth, drawHeight;

            if (aspectRatio > 1) {
              // Wider than tall
              drawWidth = prop.size;
              drawHeight = prop.size / aspectRatio;
            } else {
              // Taller than wide
              drawHeight = prop.size;
              drawWidth = prop.size * aspectRatio;
            }

            // Draw the color first
            ctx.fillStyle = prop.color === 'red' ? '#EF4444' : '#3B82F6';
            ctx.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

            // Use the SVG as a mask - only keep color where SVG has content
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            ctx.globalCompositeOperation = 'source-over'; // Reset

            ctx.restore();
          }
        });

        // Title text
        ctx.save();
        ctx.fillStyle = '#c084fc';
        ctx.font = 'italic 68px "Palatino Linotype", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('The Kinetic', centerX, 140);
        ctx.fillText('Alphabet', centerX, 215);
        ctx.restore();

        // Tagline
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.font = '15px system-ui, sans-serif';
        ctx.letterSpacing = '3px';
        ctx.textAlign = 'center';
        ctx.fillText('A FLOW ARTS CHOREOGRAPHY TOOLBOX', centerX, 250);
        ctx.restore();

        // Sequence cards (fanned)
        const cardConfigs = [
          { img: 'seq1', x: centerX - 80, y: 360, rotate: -12, scale: 0.95, z: 1 },
          { img: 'seq2', x: centerX, y: 340, rotate: 0, scale: 1.02, z: 2 },
          { img: 'seq3', x: centerX + 80, y: 360, rotate: 12, scale: 0.95, z: 1 },
        ];

        cardConfigs.forEach(card => {
          if (images[card.img]) {
            ctx.save();
            ctx.translate(card.x, card.y);
            ctx.rotate((card.rotate * Math.PI) / 180);
            ctx.scale(card.scale, card.scale);

            // Card background
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = card.z === 2 ? 50 : 30;
            ctx.shadowOffsetY = card.z === 2 ? 16 : 8;

            const cardWidth = 220;
            const cardHeight = 165;
            ctx.beginPath();
            ctx.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
            ctx.fill();

            // Image
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            const padding = 14;
            ctx.drawImage(
              images[card.img],
              -cardWidth / 2 + padding,
              -cardHeight / 2 + padding,
              cardWidth - padding * 2,
              cardHeight - padding * 2
            );

            // Border for center card
            if (card.z === 2) {
              ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
              ctx.stroke();
            }

            ctx.restore();
          }
        });

        // Pictograph cards (fanned) - using pictograph data rendered to images
        const pictographConfigs = [
          { letter: 'A', x: centerX - 60, y: 680, rotate: -10, scale: 0.92, z: 1 },
          { letter: 'B', x: centerX, y: 670, rotate: 0, scale: 1.0, z: 2 },
          { letter: 'C', x: centerX + 60, y: 680, rotate: 10, scale: 0.92, z: 1 },
        ];

        // For pictographs, we need to render them from the actual pictograph components
        // This is complex, so for now let's draw placeholder cards
        pictographConfigs.forEach(card => {
          ctx.save();
          ctx.translate(card.x, card.y);
          ctx.rotate((card.rotate * Math.PI) / 180);
          ctx.scale(card.scale, card.scale);

          // Card background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
          ctx.shadowBlur = card.z === 2 ? 32 : 20;
          ctx.shadowOffsetY = card.z === 2 ? 12 : 6;

          const size = 120;
          ctx.beginPath();
          ctx.roundRect(-size / 2, -size / 2, size, size, 12);
          ctx.fill();

          // Pictograph letter label
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 48px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(card.letter, 0, 0);

          ctx.restore();
        });

        console.log("Canvas drawing complete, converting to data URL...");
        const dataUrl = canvas.toDataURL('image/png');
        console.log("Data URL generated, length:", dataUrl.length);
        resolve(dataUrl);
      }
    });
  }

  let previewDataUrl = $state<string>("");
  let isRendering = $state(true);

  async function exportImage() {
    try {
      if (!previewDataUrl) {
        console.error("Image not ready");
        return;
      }

      // Download the image
      const link = document.createElement('a');
      link.download = 'kinetic-alphabet-grant-feature.png';
      link.href = previewDataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to export image:", error);
      alert("Failed to export image: " + error);
    }
  }

  // Render preview on mount
  onMount(async () => {
    try {
      console.log("Starting canvas render...");
      isRendering = true;
      const dataUrl = await renderToCanvas();
      console.log("Canvas render complete, dataUrl length:", dataUrl.length);

      previewDataUrl = dataUrl;
      isRendering = false;
      console.log("Preview ready");
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
      <p>Canvas rendering in progress</p>
    </div>
  {:else}
    <div class="preview-container">
      <img src={previewDataUrl} alt="Grant feature preview" class="preview-image" />
    </div>

    <div class="export-controls">
      <button class="export-btn" onclick={exportImage}>
        Export High-Resolution PNG
      </button>
      <p class="note">
        This uses 100% reliable canvas rendering - colors will match exactly.
      </p>
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
    margin-bottom: 20px;
    color: #c084fc;
  }

  .status p {
    font-size: 18px;
    margin: 10px 0;
    color: rgba(255, 255, 255, 0.8);
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

  .export-btn {
    padding: 16px 32px;
    background: linear-gradient(135deg, #ef4444 0%, #a78bfa 50%, #3b82f6 100%);
    border: none;
    color: white;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .export-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(139, 92, 246, 0.6);
  }

  .export-btn:active {
    transform: translateY(0);
  }

  .note {
    margin-top: 16px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
