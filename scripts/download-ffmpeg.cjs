const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Download ffmpeg essentials from gyan.dev (zip)
const url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
const zipPath = 'C:/Users/Austen/ffmpeg.zip';
const extractDir = 'C:/Users/Austen';

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log('Downloading ffmpeg from', url);
    const follow = (u) => {
      https.get(u, { headers: { 'User-Agent': 'Node' } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          console.log('Redirecting to', res.headers.location);
          follow(res.headers.location);
          return;
        }
        console.log('Status:', res.statusCode, 'Content-Length:', res.headers['content-length']);
        const file = fs.createWriteStream(dest);
        let bytes = 0;
        let lastLog = 0;
        res.on('data', (chunk) => {
          bytes += chunk.length;
          const mb = bytes / 1024 / 1024;
          if (mb - lastLog > 10) {
            console.log(`  ${mb.toFixed(0)} MB downloaded...`);
            lastLog = mb;
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Done: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
          resolve();
        });
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  await download(url, zipPath);
  console.log('Extracting with PowerShell...');
  try {
    execSync(`powershell.exe -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`, { stdio: 'inherit', timeout: 120000 });
    // Find the extracted bin directory
    const dirs = fs.readdirSync(extractDir).filter(d => d.startsWith('ffmpeg-'));
    if (dirs.length > 0) {
      const binDir = path.join(extractDir, dirs[0], 'bin');
      console.log('ffmpeg bin directory:', binDir);
      console.log('Files:', fs.readdirSync(binDir).join(', '));
    }
    // Clean up zip
    fs.unlinkSync(zipPath);
    console.log('Cleaned up zip file');
  } catch (e) {
    console.error('Extract error:', e.message);
  }
}

main().catch(console.error);
