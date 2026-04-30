#!/usr/bin/env bash
# TKA dev server — bash version. Use this from Git Bash / MINGW.
# The PowerShell wrapper (start-dev.ps1) full-buffers stdout when piped,
# so Git Bash shows nothing until Vite exits. This script streams live.

set -u

PHONE_IP="${PHONE_IP:-192.168.12.107}"
DEV_PORT="${DEV_PORT:-5173}"
ADB="${ADB:-/c/Users/Austen/AppData/Local/Android/Sdk/platform-tools/adb.exe}"

ts() { date +%H:%M:%S; }
log() { printf '[%s] %s\n' "$(ts)" "$*"; }

cleanup() {
    log "Shutting down..."
    [[ -n "${MOBILE_PID:-}" ]] && kill "$MOBILE_PID" 2>/dev/null || true
    [[ -n "${DEV_PID:-}" ]] && kill "$DEV_PID" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

mobile_monitor() {
    local retry=10 max=300
    local ports=(5555 32849 37777 38000 39000 40000 41000 42000 43000 44000 45000)
    while :; do
        local devices
        devices=$("$ADB" devices 2>/dev/null | awk 'NR>1 && /device$/ {print $1}')
        if [[ -n "$devices" ]]; then
            local id; id=$(echo "$devices" | head -1)
            "$ADB" -s "$id" reverse "tcp:$DEV_PORT" "tcp:$DEV_PORT" >/dev/null 2>&1
            printf '[%s] [Mobile] Connected: %s — phone can reach localhost:%s\n' "$(ts)" "$id" "$DEV_PORT"
            retry=10
            sleep 30
        else
            printf '[%s] [Mobile] No device. Scanning wireless ports...\n' "$(ts)"
            local ok=0
            for port in "${ports[@]}"; do
                if "$ADB" connect "${PHONE_IP}:${port}" 2>&1 | grep -qE 'connected|already'; then
                    sleep 0.5
                    if "$ADB" devices 2>/dev/null | awk 'NR>1 && /device$/' | grep -q .; then
                        ok=1; break
                    fi
                fi
            done
            if [[ "$ok" -eq 0 ]]; then
                printf '[%s] [Mobile] No device. Retry in %ss.\n' "$(ts)" "$retry"
                sleep "$retry"
                retry=$(( retry * 2 ))
                (( retry > max )) && retry=$max
            fi
        fi
    done
}

echo ""
echo "========================================"
echo "     TKA Development Server"
echo "========================================"
echo ""

if [[ ! -x "$ADB" ]]; then
    log "adb not found at $ADB — skipping mobile monitor"
else
    log "Cleaning up stale ADB connections..."
    "$ADB" devices 2>/dev/null | awk 'NR>1 && /offline|unauthorized/ {print $1}' | while read -r id; do
        log "  disconnecting stale: $id"
        "$ADB" disconnect "$id" >/dev/null 2>&1 || true
    done
    log "Starting mobile connection monitor..."
    mobile_monitor &
    MOBILE_PID=$!
fi

echo ""
log "Starting Vite dev server..."
echo ""

# Run pnpm in foreground. node/pnpm stream stdout line-buffered to pty.
pnpm run dev &
DEV_PID=$!
wait "$DEV_PID"
