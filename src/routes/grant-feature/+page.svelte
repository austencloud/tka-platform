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
    offCtx.drawImage(img, 0, 0, width, height);
    offCtx.globalCompositeOperation = 'source-in';
    offCtx.fillStyle = color;
    offCtx.fillRect(0, 0, width, height);
    return offscreen;
  }

  let canvasWidth = 0;
  let canvasHeight = 0;

  async function renderToCanvas() {
    return new Promise<string>((resolve, reject) => {
      let loadedImages = 0;
      const totalImages = 14; // artist + 10 props + 3 phones

      const images: Record<string, HTMLImageElement> = {};
      const imageUrls = {
        artist: '/images/austen-fire.jpg',
        // 10 props
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
        // Phone mockups
        phone1: '/store-assets/phone-1.png',
        phone2: '/store-assets/phone-2.png',
        phone3: '/store-assets/phone-3.png',
      };

      Object.entries(imageUrls).forEach(([key, url]) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          images[key] = img;
          loadedImages++;
          if (loadedImages === totalImages) drawCanvas();
        };
        img.onerror = () => {
          console.error(`Failed to load: ${url}`);
          loadedImages++;
          if (loadedImages === totalImages) drawCanvas();
        };
        img.src = url;
      });

      function drawCanvas() {
        // Use artist photo to determine max resolution
        const artistImg = images.artist;
        if (!artistImg) {
          reject(new Error("Artist image failed to load"));
          return;
        }

        // Scale based on artist image height, maintain 16:9 aspect ratio
        const height = artistImg.naturalHeight;
        const width = Math.round(height * (16 / 9));
        canvasWidth = width;
        canvasHeight = height;

        // Scale factor relative to 1080p base
        const scale = height / 1080;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        const rightHalf = width / 2;

        // === RIGHT SIDE GRADIENT ===
        const mainGradient = ctx.createLinearGradient(rightHalf, 0, width, 0);
        mainGradient.addColorStop(0, '#1a0a1f');
        mainGradient.addColorStop(0.5, '#12081a');
        mainGradient.addColorStop(1, '#0a1020');
        ctx.fillStyle = mainGradient;
        ctx.fillRect(rightHalf, 0, width / 2, height);

        // Red glow
        const redGlow = ctx.createRadialGradient(
          rightHalf + 80, height * 0.5, 0,
          rightHalf + 80, height * 0.5, height * 0.6
        );
        redGlow.addColorStop(0, 'rgba(180, 30, 50, 0.35)');
        redGlow.addColorStop(0.5, 'rgba(120, 20, 40, 0.15)');
        redGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = redGlow;
        ctx.fillRect(rightHalf, 0, width / 2, height);

        // Blue glow
        const blueGlow = ctx.createRadialGradient(
          width - 80, height * 0.5, 0,
          width - 80, height * 0.5, height * 0.6
        );
        blueGlow.addColorStop(0, 'rgba(30, 60, 180, 0.35)');
        blueGlow.addColorStop(0.5, 'rgba(20, 40, 120, 0.15)');
        blueGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = blueGlow;
        ctx.fillRect(rightHalf, 0, width / 2, height);

        // Purple center accent
        const purpleCenter = ctx.createRadialGradient(
          rightHalf + (width / 4), height * 0.45, 0,
          rightHalf + (width / 4), height * 0.45, height * 0.4
        );
        purpleCenter.addColorStop(0, 'rgba(139, 92, 246, 0.12)');
        purpleCenter.addColorStop(1, 'transparent');
        ctx.fillStyle = purpleCenter;
        ctx.fillRect(rightHalf, 0, width / 2, height);

        // Vertical shading
        const verticalShade = ctx.createLinearGradient(0, 0, 0, height);
        verticalShade.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
        verticalShade.addColorStop(0.3, 'transparent');
        verticalShade.addColorStop(0.7, 'transparent');
        verticalShade.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
        ctx.fillStyle = verticalShade;
        ctx.fillRect(rightHalf, 0, width / 2, height);

        // === LEFT SIDE - Artist photo ===
        if (images.artist) {
          ctx.drawImage(images.artist, 0, 0, width / 2, height);
          const overlayGradient = ctx.createLinearGradient(0, 0, width / 2, 0);
          overlayGradient.addColorStop(0, 'rgba(10, 5, 16, 0.0)');
          overlayGradient.addColorStop(0.7, 'rgba(10, 5, 16, 0.15)');
          overlayGradient.addColorStop(1, 'rgba(10, 5, 16, 0.6)');
          ctx.fillStyle = overlayGradient;
          ctx.fillRect(0, 0, width / 2, height);
        }

        // Artist attribution
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `${16 * scale}px system-ui, sans-serif`;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 12 * scale;
        ctx.fillText('Created by', 40 * scale, height - 60 * scale);
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 ${20 * scale}px system-ui, sans-serif`;
        ctx.fillText('Austen Cloud', 40 * scale, height - 35 * scale);
        ctx.restore();

        // === PROPS ===
        const TKA_RED = '#ED1C24';
        const TKA_BLUE = '#2E3192';
        const leftColX = rightHalf + 80 * scale;
        const rightColX = width - 80 * scale;
        const yPositions = [height * 0.08, height * 0.29, height * 0.50, height * 0.71, height * 0.92];

        const propConfig = [
          { img: 'prop1', x: leftColX, y: yPositions[0], size: 85 * scale, rotate: -15, color: TKA_RED },
          { img: 'prop7', x: leftColX, y: yPositions[1], size: 80 * scale, rotate: 20, color: TKA_RED },
          { img: 'prop5', x: leftColX, y: yPositions[2], size: 85 * scale, rotate: -10, color: TKA_RED },
          { img: 'prop9', x: leftColX, y: yPositions[3], size: 80 * scale, rotate: 15, color: TKA_RED },
          { img: 'prop3', x: leftColX, y: yPositions[4], size: 85 * scale, rotate: -20, color: TKA_RED },
          { img: 'prop2', x: rightColX, y: yPositions[0], size: 85 * scale, rotate: 15, color: TKA_BLUE },
          { img: 'prop8', x: rightColX, y: yPositions[1], size: 80 * scale, rotate: -20, color: TKA_BLUE },
          { img: 'prop6', x: rightColX, y: yPositions[2], size: 80 * scale, rotate: 25, color: TKA_BLUE },
          { img: 'prop10', x: rightColX, y: yPositions[3], size: 80 * scale, rotate: -15, color: TKA_BLUE },
          { img: 'prop4', x: rightColX, y: yPositions[4], size: 85 * scale, rotate: 20, color: TKA_BLUE },
        ];

        propConfig.forEach(prop => {
          if (images[prop.img]) {
            const img = images[prop.img];
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            let drawWidth = aspectRatio > 1 ? prop.size : prop.size * aspectRatio;
            let drawHeight = aspectRatio > 1 ? prop.size / aspectRatio : prop.size;
            const recolored = recolorImage(img, prop.color, Math.ceil(drawWidth), Math.ceil(drawHeight));
            ctx.save();
            ctx.globalAlpha = 0.45; // Reduced opacity so props don't compete with phones
            ctx.translate(prop.x, prop.y);
            ctx.rotate((prop.rotate * Math.PI) / 180);
            ctx.drawImage(recolored, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            ctx.restore();
          }
        });

        const centerX = rightHalf + (width / 2) / 2;

        // === TITLE ===
        ctx.save();
        ctx.fillStyle = '#c084fc';
        ctx.font = `italic ${68 * scale}px "Palatino Linotype", Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText('The Kinetic', centerX, 120 * scale);
        ctx.fillText('Alphabet', centerX, 195 * scale);
        ctx.restore();

        // === TAGLINE ===
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.font = `${15 * scale}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('A FLOW ARTS CHOREOGRAPHY TOOLBOX', centerX, 235 * scale);
        ctx.restore();

        // === FEATURE CHIPS (2x2 grid) ===
        const chips = [
          ['Create', 'Visualize'],
          ['Discover', 'Learn']
        ];
        const chipGridStartY = 280 * scale;
        const chipRowSpacing = 50 * scale;
        const chipColSpacing = 140 * scale;

        ctx.save();
        ctx.font = `600 ${13 * scale}px system-ui, sans-serif`;
        ctx.textAlign = 'center';

        chips.forEach((row, rowIndex) => {
          row.forEach((chip, colIndex) => {
            const x = centerX + (colIndex - 0.5) * chipColSpacing;
            const y = chipGridStartY + rowIndex * chipRowSpacing;

            // Chip background
            const chipWidth = 120 * scale;
            const chipHeight = 36 * scale;
            ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
            ctx.lineWidth = 1.5 * scale;
            ctx.beginPath();
            ctx.roundRect(x - chipWidth / 2, y - chipHeight / 2, chipWidth, chipHeight, 10 * scale);
            ctx.fill();
            ctx.stroke();

            // Chip text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(chip.toUpperCase(), x, y + 5 * scale);
          });
        });
        ctx.restore();

        // === SEQUENCE CARDS PLACEHOLDER ===
        // Space reserved for sequence cards around Y = 480-600

        // === PHONE MOCKUPS ===
        const phoneWidth = 150 * scale;
        const phoneHeight = 320 * scale;
        const phoneY = 780 * scale; // Moved down further to make room for sequence cards
        const phoneSpacing = 160 * scale;

        // Draw in order: left, right, then center (so center is on top)
        const phoneConfigs = [
          { img: 'phone1', x: centerX - phoneSpacing, phoneScale: 0.85, offsetY: 30 * scale, opacity: 0.9, zIndex: 1 },
          { img: 'phone3', x: centerX + phoneSpacing, phoneScale: 0.85, offsetY: 30 * scale, opacity: 0.9, zIndex: 1 },
          { img: 'phone2', x: centerX, phoneScale: 1.15, offsetY: -20 * scale, opacity: 1, zIndex: 2 }, // Center phone drawn last (on top)
        ];

        phoneConfigs.forEach(phone => {
          if (images[phone.img]) {
            ctx.save();
            ctx.globalAlpha = phone.opacity;
            ctx.translate(phone.x, phoneY + phone.offsetY);
            ctx.scale(phone.phoneScale, phone.phoneScale);

            // Phone frame (black bezel)
            const frameWidth = phoneWidth + 12 * scale;
            const frameHeight = phoneHeight + 12 * scale;
            ctx.fillStyle = '#000000';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = (phone.zIndex === 2 ? 50 : 30) * scale;
            ctx.shadowOffsetY = (phone.zIndex === 2 ? 25 : 12) * scale;
            ctx.beginPath();
            ctx.roundRect(-frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight, 24 * scale);
            ctx.fill();

            // Screen
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            ctx.beginPath();
            ctx.roundRect(-phoneWidth / 2, -phoneHeight / 2, phoneWidth, phoneHeight, 18 * scale);
            ctx.clip();
            ctx.drawImage(images[phone.img], -phoneWidth / 2, -phoneHeight / 2, phoneWidth, phoneHeight);

            ctx.restore();
          }
        });

        resolve(canvas.toDataURL('image/png'));
      }
    });
  }

  let previewDataUrl = $state<string>("");
  let isRendering = $state(true);

  async function exportImage() {
    if (!previewDataUrl) return;
    const link = document.createElement('a');
    link.download = `tka-grant-feature-${canvasWidth}x${canvasHeight}.png`;
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
      <p>Canvas rendering in progress</p>
    </div>
  {:else}
    <div class="preview-container">
      <img src={previewDataUrl} alt="Grant feature preview" class="preview-image" />
    </div>

    <div class="export-controls">
      <p class="resolution">{canvasWidth} x {canvasHeight} pixels</p>
      <button class="export-btn" onclick={exportImage}>
        Export High-Resolution PNG
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

  .resolution {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    margin-bottom: 12px;
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
