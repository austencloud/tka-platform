// pm2 app definition for the TKA dev server (vite :5173 + Cloudflare tunnel).
// Daily driver: pm2 restart tka-dev | pm2 logs tka-dev | pm2 status
// Spec: docs/superpowers/specs/2026-07-18-pm2-dev-server-runner-design.md
module.exports = {
  apps: [
    {
      name: "tka-dev",
      script: "scripts/start-dev-pm2.cjs",
      cwd: __dirname,
      autorestart: true,
      // Vite on this project cold-boots slowly; don't flap-detect it as broken.
      min_uptime: 30000,
      max_restarts: 10,
      restart_delay: 3000,
      // Give the script's finally block time to tree-kill vite + cloudflared.
      kill_timeout: 15000,
      windowsHide: true,
    },
  ],
};
