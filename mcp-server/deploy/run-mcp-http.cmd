@echo off
REM Launcher for the Flow Arts Knowledge MCP server in HTTP mode.
REM Invoked by NSSM as a Windows service. Do not run directly.

set MCP_HTTP_PORT=3333

REM Authorization config lives in auth.local.cmd, which is gitignored: it names a
REM specific Cloudflare Zero Trust org and application. The server REFUSES to
REM start over HTTP without it rather than falling back to an open endpoint, so a
REM missing file is a loud crash in deploy\logs\mcp-stderr.log, not a silent
REM downgrade. See deploy\README.md for the values and where to get them.
if exist "%~dp0auth.local.cmd" call "%~dp0auth.local.cmd"

cd /d "E:\tka-platform\mcp-server"
"C:\Program Files\nodejs\npx.cmd" --no-install tsx index.ts
