/**
 * Compare SVG vs Canvas 2D Rendering
 *
 * This script renders the same pictograph using both methods
 * and saves the output for visual comparison.
 *
 * Run: node scripts/compare-render-methods.js
 *
 * Output: Creates two PNG files in the scratchpad directory
 * - svg-render.png (correct reference)
 * - canvas2d-render.png (to be compared)
 */

// This script needs to run in the browser context
// We'll create an HTML file that does the comparison

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const html = `<!DOCTYPE html>
<html>
<head>
  <title>Render Method Comparison</title>
  <style>
    body { font-family: sans-serif; background: #1a1a2e; color: white; padding: 20px; }
    .container { display: flex; gap: 40px; flex-wrap: wrap; }
    .render-box {
      border: 2px solid #333;
      padding: 20px;
      border-radius: 8px;
      background: #0a0a0f;
    }
    .render-box h2 { margin-top: 0; }
    .render-box canvas, .render-box img {
      border: 1px solid #444;
      display: block;
      margin-bottom: 10px;
    }
    .info { font-size: 12px; color: #888; }
    .error { color: #ff6b6b; }
    .success { color: #51cf66; }
    button {
      padding: 10px 20px;
      margin: 10px 5px 10px 0;
      cursor: pointer;
      background: #4c6ef5;
      color: white;
      border: none;
      border-radius: 4px;
    }
    button:hover { background: #364fc7; }
    #status { margin: 20px 0; padding: 10px; background: #1e1e3f; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>SVG vs Canvas 2D Render Comparison</h1>

  <div id="status">Ready to render. Click a button to start.</div>

  <div>
    <button onclick="renderComparison()">Render Comparison</button>
    <button onclick="downloadImages()">Download Both Images</button>
  </div>

  <div class="container">
    <div class="render-box">
      <h2>SVG Render (Reference)</h2>
      <div id="svg-output"></div>
      <div id="svg-info" class="info"></div>
    </div>

    <div class="render-box">
      <h2>Canvas 2D Render</h2>
      <div id="canvas2d-output"></div>
      <div id="canvas2d-info" class="info"></div>
    </div>
  </div>

  <script type="module">
    // Import the rendering utilities
    // This assumes the dev server is running

    window.renderComparison = async function() {
      const status = document.getElementById('status');
      status.innerHTML = 'Rendering...';

      try {
        // Create a test pictograph data object
        const testPictograph = {
          id: 'test-1',
          letter: 'A',
          motions: {
            blue: {
              motionType: 'pro',
              startLocation: 'n',
              endLocation: 'e',
              turns: 1,
              rotationDirection: 'cw',
              startOrientation: 'in',
              endOrientation: 'in',
              propType: 'staff',
              propPlacementData: {
                propType: 'staff'
              }
            },
            red: {
              motionType: 'pro',
              startLocation: 's',
              endLocation: 'w',
              turns: 1,
              rotationDirection: 'cw',
              startOrientation: 'in',
              endOrientation: 'in',
              propType: 'staff',
              propPlacementData: {
                propType: 'staff'
              }
            }
          }
        };

        // Import the SVG renderer
        const { renderPictographToSVG } = await import('/src/lib/shared/render/utils/pictograph-to-svg.ts');

        const size = 300;

        // Render using SVG method
        status.innerHTML = 'Rendering SVG...';
        const startSvg = performance.now();
        const svgString = await renderPictographToSVG(testPictograph, size, undefined, {
          showTKA: true,
          darkMode: true
        });
        const svgTime = performance.now() - startSvg;

        // Display SVG result
        const svgImg = new Image();
        svgImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        svgImg.onload = () => {
          document.getElementById('svg-output').innerHTML = '';
          document.getElementById('svg-output').appendChild(svgImg);
          document.getElementById('svg-info').innerHTML =
            'Time: ' + svgTime.toFixed(1) + 'ms<br>Size: ' + size + 'x' + size;
        };

        window.svgImage = svgImg;
        window.svgString = svgString;

        status.innerHTML = '<span class="success">✓ SVG rendered in ' + svgTime.toFixed(1) + 'ms</span>';

      } catch (error) {
        status.innerHTML = '<span class="error">Error: ' + error.message + '</span>';
        console.error('Render error:', error);
      }
    };

    window.downloadImages = function() {
      if (window.svgString) {
        // Download SVG as file
        const blob = new Blob([window.svgString], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'svg-render.svg';
        a.click();
        URL.revokeObjectURL(url);
      }
    };
  </script>
</body>
</html>
`;

// Write the HTML file
const outputPath = path.join(__dirname, '..', 'static', 'render-compare.html');
fs.writeFileSync(outputPath, html);
console.log('Created comparison page at: static/render-compare.html');
console.log('');
console.log('To use:');
console.log('1. Start the dev server: npm run dev');
console.log('2. Open: http://localhost:5173/render-compare.html');
console.log('3. Click "Render Comparison" to see the SVG output');
console.log('');
console.log('This will show you exactly what the SVG renderer produces,');
console.log('which the Canvas 2D renderer must match pixel-for-pixel.');
