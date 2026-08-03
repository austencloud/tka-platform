# Laptop → tka-dev3 Tunnel — Handoff (2026-08-03)

For the agent on **hp-omnibook7** (the laptop). Written from d1.

## What changed

Austen's decision (2026-08-03): dev hostnames follow machine rank — dev = d1,
dev2 = d2 (office desktop), dev3 = laptop. The laptop currently runs the
`tka-dev2` connector (pm2, via `scripts/tunnel2-pm2.cjs`); that tunnel and
hostname now belong to d2. The laptop moves to `tka-dev3` →
`dev3.tkaflowarts.com`, already created and DNS-routed from d1.

## Steps on the laptop

1. Stop and remove the old connector so dev2 stops round-robining between the
   laptop and d2:
   `pm2 delete tka-dev2-tunnel` (check the actual name with `pm2 ls`), then
   `pm2 save`.
2. Get the dev3 token (cert.pem from the previous login should still be
   present; if not, `cloudflared tunnel login` first):
   `cloudflared tunnel token tka-dev3 | Set-Content "$env:USERPROFILE\.cloudflared\tka-dev3.token"`
3. Pull `main`, then register the new shim:
   `pm2 start scripts/tunnel3-pm2.cjs --name tka-dev3-tunnel` and `pm2 save`.
4. Verify: with a dev server running locally,
   `curl https://dev3.tkaflowarts.com` returns the app.
5. Housekeeping: the old tunnel credentials json for `tka-dev2` (a
   `57ee9a37-*.json` under `%USERPROFILE%\.cloudflared\`) is no longer needed
   on this machine. Leave cert.pem.

## Notes

- `scripts/tunnel2-pm2.cjs` in the repo is now d2's shim (token-based). Do not
  run it on the laptop.
- The repo is public: never commit tokens, tunnel credentials json files, or
  cert.pem.
