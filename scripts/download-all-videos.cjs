const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ytdlp = 'C:/Users/Austen/yt-dlp.exe';
const ffmpegDir = 'C:/Users/Austen/ffmpeg-master-latest-win64-gpl/bin';
const baseDir = 'C:/Users/Austen/Downloads/MatthiasBarker';

const playlists = [
  {
    name: 'From Stuck to Secure',
    videos: [
      { title: '01 - Introduction', url: 'https://cdn.membership.io/4474733/30fbbe51b7c8bec77880e0a5e794bbb0.m3u8' },
      { title: '02 - Module 1 - The Pleaser', url: 'https://cdn.membership.io/4473953/18841756ea60a2799a0f540df994ef50.m3u8' },
      { title: '03 - Module 2 - The Dominator', url: 'https://cdn.membership.io/4473950/15f59b9172100cbe89fde49a16e98b1f.m3u8' },
      { title: '04 - Module 3 - The Feeler', url: 'https://cdn.membership.io/4473939/836acdffb0e458f081b5aa681f4ed1fd.m3u8' },
      { title: '05 - Module 4 - The Avoider', url: 'https://cdn.membership.io/4473944/707ba9bf57688947017c10335261ec0d.m3u8' },
      { title: '06 - Module 5 - Tossing', url: 'https://cdn.membership.io/4473961/d86cc651d66bfc4b9cc5acbcfaa4325b.m3u8' },
      { title: '07 - Module 6 - Catching', url: 'https://cdn.membership.io/4473926/5675892e297a0a9ecb4bd8184b25ac4c.m3u8' },
      { title: '08 - Module 7 - Healthy Habits', url: 'https://cdn.membership.io/4473931/ebb23973bd6da2473a86c79d465b7da7.m3u8' },
      { title: '09 - Final Summary', url: 'https://cdn.membership.io/4473941/9a177e0730dbfa906f94c895842c47d0.m3u8' },
    ]
  },
  {
    name: 'Your Questions Answered',
    videos: [
      { title: '10 - Q1', url: 'https://cdn.membership.io/4473924/ba4ceb42e258f6f00cc533a5af66c3ac.m3u8' },
      { title: '11 - Q2', url: 'https://cdn.membership.io/4473934/12ffb068d2821865d09987ff7a7ee1eb.m3u8' },
      { title: '12 - Q3', url: 'https://cdn.membership.io/4474732/2a0b89dd0b44fec887482939c191ea58.m3u8' },
      { title: '13 - Q4', url: 'https://cdn.membership.io/4473899/76e8ec1936dfaad405a3fd5357f99a85.m3u8' },
      { title: '14 - Q5', url: 'https://cdn.membership.io/4473854/93497c0c3d8b3c134dc06bff639d93df.m3u8' },
      { title: '15 - Q6', url: 'https://cdn.membership.io/4473900/e46ea2499b375a0c736f20e5885fcf7c.m3u8' },
      { title: '16 - Q7', url: 'https://cdn.membership.io/4473864/0f7a904ef4762bf7dd6fa1b121bc4bba.m3u8' },
      { title: '17 - Q8', url: 'https://cdn.membership.io/4473962/fc97435ccbb803acf5927ca272e7d842.m3u8' },
    ]
  },
  {
    name: 'Live QA Replays',
    videos: [
      { title: '18 - Matthias and Jimmy QA 3', url: 'https://cdn.membership.io/4509191/fff44b76afada8ac4603185656421737.m3u8' },
      { title: '19 - Matthias and Jimmy QA 2', url: 'https://cdn.membership.io/4513689/54c1e6881d5d1651524740a8071a0693.m3u8' },
      { title: '20 - Matthias and Jimmy QA 1', url: 'https://cdn.membership.io/4513688/b6a46115d9e67c89aac2275942d11644.m3u8' },
    ]
  }
];

async function main() {
  let total = 0;
  let completed = 0;
  let failed = [];

  for (const pl of playlists) {
    total += pl.videos.length;
  }

  console.log(`\n=== Downloading ${total} videos ===\n`);

  for (const pl of playlists) {
    const dir = path.join(baseDir, pl.name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    console.log(`\n--- ${pl.name} (${pl.videos.length} videos) ---\n`);

    for (const vid of pl.videos) {
      const outPath = path.join(dir, `${vid.title}.mp4`);

      if (fs.existsSync(outPath)) {
        console.log(`SKIP (exists): ${vid.title}`);
        completed++;
        continue;
      }

      console.log(`[${completed + 1}/${total}] Downloading: ${vid.title}`);

      try {
        execSync(
          `"${ytdlp}" "${vid.url}" --ffmpeg-location "${ffmpegDir}" -o "${outPath}" --no-part`,
          { stdio: 'inherit', timeout: 600000 }
        );
        completed++;
        console.log(`  DONE: ${vid.title}\n`);
      } catch (e) {
        console.error(`  FAILED: ${vid.title} - ${e.message}\n`);
        failed.push(vid.title);
      }
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`Downloaded: ${completed}/${total}`);
  if (failed.length) {
    console.log(`Failed: ${failed.join(', ')}`);
  }
}

main().catch(console.error);
