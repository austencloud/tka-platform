#!/usr/bin/env bash
# Ask Codex (OpenAI CLI) a question about this repo, non-interactively.
#
# Usage:
#   scripts/codex-ask.sh <prompt-file> [output-file]
#   echo "some prompt" | scripts/codex-ask.sh - [output-file]
#
# Prints the path to the answer file on success.
#
# Why the flags, since every one of them is load-bearing:
#
#   --ignore-user-config
#       ~/.codex/config.toml registers plugin marketplaces for the Codex
#       DESKTOP APP, one of them at a `/mnt/c/...` WSL path that cannot resolve
#       on Windows. The CLI hands those to its tool host at startup, the host
#       dies with "code-mode host exited during handshake", and the run ends
#       having read zero files. This flag skips that config; auth.json is still
#       read from CODEX_HOME, so it stays signed in. Do NOT "fix" this by
#       editing ~/.codex/config.toml -- that file belongs to the desktop app.
#
#   -o <file>
#       codex exec drops its final message on long runs: the work happens, the
#       report never arrives, exit code is 0. Four separate runs died this way.
#       This writes the last message to a file instead of relying on stdout.
#
#   -m
#       --ignore-user-config also discards the model setting, so it has to be
#       named here or the CLI falls back to its own default.
#
# Trust levels are also discarded by --ignore-user-config, which does not
# matter: --dangerously-bypass-approvals-and-sandbox already bypasses approval.

set -euo pipefail

MODEL="${CODEX_ASK_MODEL:-gpt-5.6-sol}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -lt 1 ]; then
	echo "usage: $0 <prompt-file|-> [output-file]" >&2
	exit 64
fi

PROMPT_FILE="$1"
OUT="${2:-$REPO/.codex-answer.md}"

if [ "$PROMPT_FILE" = "-" ]; then
	PROMPT="$(cat)"
elif [ -f "$PROMPT_FILE" ]; then
	PROMPT="$(cat "$PROMPT_FILE")"
else
	echo "no such prompt file: $PROMPT_FILE" >&2
	exit 66
fi

codex exec \
	--ignore-user-config \
	-m "$MODEL" \
	-o "$OUT" \
	--dangerously-bypass-approvals-and-sandbox \
	-C "$REPO" \
	"$PROMPT" >"${OUT%.md}.log" 2>&1

if [ ! -s "$OUT" ]; then
	echo "codex produced no answer; transcript: ${OUT%.md}.log" >&2
	exit 70
fi

echo "$OUT"
