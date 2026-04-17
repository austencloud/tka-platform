# Flow Arts Knowledge MCP — Bulletproof Deploy

Two Windows services that survive reboots, crashes, and closed terminals:

1. **`FlowArtsKnowledgeMCP`** — the Node MCP server listening on `localhost:3333`
2. **`cloudflared`** — a Cloudflare Tunnel exposing it at a stable public URL

Both start automatically at boot. The public URL never rotates (it's a real DNS record on `tkaflowarts.com`, not a `trycloudflare.com` throwaway).

---

## Part 1 — MCP server service (one-time, ~2 min)

Open **PowerShell as Administrator**, then:

```powershell
cd E:\tka-platform\mcp-server\deploy
powershell -ExecutionPolicy Bypass -File .\install-service.ps1
```

The script:
- Installs NSSM via winget if missing
- Registers `FlowArtsKnowledgeMCP` as an auto-start Windows service
- Points it at `run-mcp-http.cmd` (which runs `tsx index.ts` with `MCP_HTTP_PORT=3333`)
- Configures restart-on-crash (3s delay) and rotating logs at `deploy\logs\`
- Starts it and smoke-tests `http://localhost:3333/`

If the smoke test passes you're done with part 1. If not, check `deploy\logs\mcp-stderr.log`.

---

## Part 2 — Cloudflare Tunnel (one-time, ~5 min)

Follow the official remote-managed path (Cloudflare's current recommended setup):

1. Open [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/) → **Networks → Tunnels** → **Create a tunnel**.
2. Connector type: **Cloudflared**. Name it `tka-mcp`. **Save tunnel**.
3. Environment: **Windows**. Architecture: **64-bit**. Copy the generated install command (contains a token); run it in **an elevated PowerShell**. It installs `cloudflared` as a Windows service for you. Wait for the dashboard to show the connector as healthy, then **Next**.
4. **Public Hostnames** tab → **Add a public hostname**:
   - Subdomain: `mcp`
   - Domain: `tkaflowarts.com`
   - Type: `HTTP`
   - URL: `localhost:3333`
   - **Save hostname**.
5. In the **TLS** section of that hostname's advanced settings, leave **No TLS verify** off — the origin is plain HTTP on localhost, which Cloudflare handles correctly by default.

Public URL: `https://mcp.tkaflowarts.com/mcp`

---

## Part 3 — Point claude.ai at the new URL

1. Open claude.ai → Settings → Integrations.
2. Edit the **Flow Arts Knowledge** MCP integration.
3. Replace the old `medicine-relationship-grew-now.trycloudflare.com/mcp` URL with `https://mcp.tkaflowarts.com/mcp`.
4. Reconnect. In Claude Code: `claude mcp list` should show it as `✓ Connected`.

---

## Verifying end-to-end

```powershell
# Service status
Get-Service FlowArtsKnowledgeMCP, cloudflared

# Local health
curl http://localhost:3333/

# Public health (after Part 2)
curl https://mcp.tkaflowarts.com/
```

Both `curl` calls should return `Flow Arts Knowledge MCP Server`.

---

## Updating the server

After changing code in `mcp-server\src\`:

```powershell
Restart-Service FlowArtsKnowledgeMCP
```

No rebuild needed — it runs via `tsx` on source.

---

## Uninstall

```powershell
nssm stop FlowArtsKnowledgeMCP confirm
nssm remove FlowArtsKnowledgeMCP confirm
cloudflared service uninstall
```
