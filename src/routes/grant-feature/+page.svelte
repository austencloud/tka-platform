<script lang="ts">
  import { onMount } from "svelte";

  // Recolor an SVG image to a solid color using offscreen canvas
  function recolorImage(
    img: HTMLImageElement,
    color: string,
    width: number,
    height: number
  ): HTMLCanvasElement {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d')!;

    // Draw original image
    offCtx.drawImage(img, 0, 0, width, height);

    // Use source-in to replace all visible pixels with the desired color
    offCtx.globalCompositeOperation = 'source-in';
    offCtx.fillStyle = color;
    offCtx.fillRect(0, 0, width, height);

    return offscreen;
  }

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
      const totalImages = 17; // artist photo + 10 props + 3 sequence thumbnails + 3 pictographs

      const images: Record<string, HTMLImageElement> = {};
      const imageUrls = {
        artist: '/images/austen-fire.jpg',
        // 10 props - base versions
        prop1: '/images/props/staff.svg',
        prop2: '/images/props/fan.svg',
        prop3: '/images/props/triad.svg',
        prop4: '/images/props/club.svg',
        prop5: '/images/props/buugeng.svg',
        prop6: '/images/props/doublestar.svg',
        prop7: '/images/props/sword.svg',
        prop8: '/images/props/eightrings.svg',
        prop9: '/images/props/triquetra.svg',
        prop10: '/images/props/quiad.svg',
        // Sequence thumbnails
        seq1: '/thumbnails/staff/ABC_light.webp',
        seq2: '/thumbnails/staff/AABB_light.webp',
        seq3: '/thumbnails/staff/AKE_light.webp',
        // Pre-rendered pictographs
        pictoA: '/images/grant-feature/pictograph-A.png',
        pictoB: '/images/grant-feature/pictograph-B.png',
        pictoC: '/images/grant-feature/pictograph-C.png',
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
        // === BACKGROUND: Red-Purple-Blue gradient (AAA compliant for white text) ===
        // Base: dark gradient ensuring 7:1+ contrast with white text
        const rightHalf = width / 2;

        // Main horizontal gradient: Red (left) -> Purple (center) -> Blue (right)
        // Using dark, rich tones for AAA readability
        const mainGradient = ctx.createLinearGradient(rightHalf, 0, width, 0);
        mainGradient.addColorStop(0, '#1a0a1f');    // Dark purple-red at center
        mainGradient.addColorStop(0.5, '#12081a');  // Deep purple in middle
        mainGradient.addColorStop(1, '#0a1020');    // Dark blue at right edge

        // Fill right side with main gradient
        ctx.fillStyle = mainGradient;
        ctx.fillRect(rightHalf, 0, width / 2, height);

        // Red glow on left side of right panel (near props column)
        const redGlow = ctx.createRadialGradient(
          rightHalf + 80, height * 0.5, 0,
          rightHalf + 80, height * 0.5, height * 0.6
        );
        redGlow.addColorStop(0, 'rgba(180, 30, 50, 0.35)');
        redGlow.addColorStop(0.5, 'rgba(120, 20, 40, 0.15)');
        redGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = redGlow;
        ctx.fillRect(rightHalf, 0, width / 2, height);

        // Blue glow on right side of right panel (near props column)
        const blueGlow = ctx.createRadialGradient(
          width - 80, height * 0.5, 0,
          width - 80, height * 0.5, height * 0.6
        );
        blueGlow.addColorStop(0, 'rgba(30, 60, 180, 0.35)');
        blueGlow.addColorStop(0.5, 'rgba(20, 40, 120, 0.15)');
        blueGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = blueGlow;
        ctx.fillRect(rightHalf, 0, width / 2, height);

        // Subtle purple accent in center for visual interest
        const purpleCenter = ctx.createRadialGradient(
          rightHalf + (width / 4), height * 0.45, 0,
          rightHalf + (width / 4), height * 0.45, height * 0.4
        );
        purpleCenter.addColorStop(0, 'rgba(139, 92, 246, 0.12)');
        purpleCenter.addColorStop(1, 'transparent');
        ctx.fillStyle = purpleCenter;
        ctx.fillRect(rightHalf, 0, width / 2, height);

        // Vertical gradient for depth (darker at edges)
        const verticalShade = ctx.createLinearGradient(0, 0, 0, height);
        verticalShade.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
        verticalShade.addColorStop(0.3, 'transparent');
        verticalShade.addColorStop(0.7, 'transparent');
        verticalShade.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
        ctx.fillStyle = verticalShade;
        ctx.fillRect(rightHalf, 0, width / 2, height);

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

        // TKA brand colors - proper red and blue
        const TKA_RED = '#ED1C24';
        const TKA_BLUE = '#2E3192';

        // Prop column positions
        const leftColX = rightStart + 80;   // Left column (red props)
        const rightColX = width - 80;       // Right column (blue props)

        // Evenly distributed Y positions (5 per column)
        const yPositions = [
          height * 0.08,  // Top
          height * 0.29,  // Upper
          height * 0.50,  // Middle
          height * 0.71,  // Lower
          height * 0.92,  // Bottom
        ];

        // Draw prop decorations - 10 props, 5 per column, evenly spaced
        const propConfig = [
          // LEFT COLUMN (Red)
          { img: 'prop1', x: leftColX, y: yPositions[0], size: 85, rotate: -15, color: TKA_RED },  // Staff
          { img: 'prop7', x: leftColX, y: yPositions[1], size: 80, rotate: 20, color: TKA_RED },   // Sword
          { img: 'prop5', x: leftColX, y: yPositions[2], size: 85, rotate: -10, color: TKA_RED },  // Buugeng
          { img: 'prop9', x: leftColX, y: yPositions[3], size: 80, rotate: 15, color: TKA_RED },   // Triquetra
          { img: 'prop3', x: leftColX, y: yPositions[4], size: 85, rotate: -20, color: TKA_RED },  // Triad

          // RIGHT COLUMN (Blue)
          { img: 'prop2', x: rightColX, y: yPositions[0], size: 85, rotate: 15, color: TKA_BLUE },  // Fan
          { img: 'prop8', x: rightColX, y: yPositions[1], size: 80, rotate: -20, color: TKA_BLUE }, // Eight Rings
          { img: 'prop6', x: rightColX, y: yPositions[2], size: 80, rotate: 25, color: TKA_BLUE },  // Doublestar
          { img: 'prop10', x: rightColX, y: yPositions[3], size: 80, rotate: -15, color: TKA_BLUE },// Quiad
          { img: 'prop4', x: rightColX, y: yPositions[4], size: 85, rotate: 20, color: TKA_BLUE },  // Club
        ];

        propConfig.forEach(prop => {
          if (images[prop.img]) {
            const img = images[prop.img];
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            let drawWidth, drawHeight;

            if (aspectRatio > 1) {
              drawWidth = prop.size;
              drawHeight = prop.size / aspectRatio;
            } else {
              drawHeight = prop.size;
              drawWidth = prop.size * aspectRatio;
            }

            // Recolor the prop to the desired color (no background artifacts)
            const recolored = recolorImage(img, prop.color, Math.ceil(drawWidth), Math.ceil(drawHeight));

            ctx.save();
            ctx.globalAlpha = 0.70;
            ctx.translate(prop.x, prop.y);
            ctx.rotate((prop.rotate * Math.PI) / 180);

            // Draw the recolored prop (no fillRect, no background)
            ctx.drawImage(recolored, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

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

        // Pictograph cards (fanned) - A, B, C with alpha1→alpha3 variation
        const pictographConfigs = [
          { img: 'pictoA', x: centerX - 110, y: 820, rotate: -12, scale: 0.90, z: 1 },
          { img: 'pictoB', x: centerX, y: 795, rotate: 0, scale: 1.0, z: 2 },
          { img: 'pictoC', x: centerX + 110, y: 820, rotate: 12, scale: 0.90, z: 1 },
        ];

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

          const size = 130;
          ctx.beginPath();
          ctx.roundRect(-size / 2, -size / 2, size, size, 12);
          ctx.fill();

          // Draw the pre-rendered pictograph image
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          if (images[card.img]) {
            const padding = 8;
            const imgSize = size - padding * 2;
            ctx.drawImage(
              images[card.img],
              -imgSize / 2,
              -imgSize / 2,
              imgSize,
              imgSize
            );
          }

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
