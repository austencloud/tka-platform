@echo off
REM Launcher for the Flow Arts Knowledge MCP server in HTTP mode.
REM Invoked by NSSM as a Windows service. Do not run directly.

set MCP_HTTP_PORT=3333
cd /d "E:\tka-platform\mcp-server"
"C:\Program Files\nodejs\npx.cmd" --no-install tsx index.ts
