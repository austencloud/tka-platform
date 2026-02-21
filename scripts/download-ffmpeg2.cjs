const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Use BtbN's ffmpeg builds from GitHub (more reliable direct links)
const url = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
const zipPath = 'C:/Users/Austen/ffmpeg.zip';
const extractDir = 'C:/Users/Austen';

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log('Downloading from', url.slice(0, 80) + '...');
    const follow = (u) => {
      const mod = u.startsWith('https') ? https : require('http');
      mod.get(u, { headers: { 'User-Agent': 'Node' } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 303) {
          console.log('  -> Redirect', res.statusCode);
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        const totalBytes = parseInt(res.headers['content-length'] || '0');
        console.log('  Size:', (totalBytes / 1024 / 1024).toFixed(1), 'MB');
        const file = fs.createWriteStream(dest);
        let bytes = 0;
        let lastLog = 0;
        res.on('data', (chunk) => {
          bytes += chunk.length;
          const mb = bytes / 1024 / 1024;
          if (mb - lastLog > 10) {
            const pct = totalBytes ? ((bytes / totalBytes) * 100).toFixed(0) + '%' : '';
            console.log(`  ${mb.toFixed(0)} MB ${pct}`);
            lastLog = mb;
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`  Complete: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
          resolve();
        });
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  await download(url, zipPath);

  console.log('Extracting...');
  try {
    execSync(`powershell.exe -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${extractDir}' -Force"`, {
      stdio: 'inherit',
      timeout: 180000
    });

    const dirs = fs.readdirSync(extractDir).filter(d => d.startsWith('ffmpeg-'));
    if (dirs.length > 0) {
      const binDir = path.join(extractDir, dirs[0], 'bin');
      const files = fs.readdirSync(binDir);
      console.log('Installed to:', binDir);
      console.log('Files:', files.join(', '));
    }

    fs.unlinkSync(zipPath);
    console.log('Cleanup done');
  } catch (e) {
    console.error('Extract error:', e.message);
  }
}

main().catch(console.error);
