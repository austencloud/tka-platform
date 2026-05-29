#!/usr/bin/env python
"""Direct client for the BlenderMCP addon socket (localhost:9876).

Bypasses the blender-mcp stdio bridge (which fails Claude Code's health check).
Speaks the addon's raw JSON protocol: {"type": cmd, "params": {...}}.

Usage:
  python scripts/blender-client.py scene
  python scripts/blender-client.py object <name>
  python scripts/blender-client.py shot <out.png> [max_size]
  python scripts/blender-client.py exec <code-file.py>
"""
import json
import socket
import sys

HOST, PORT = "localhost", 9876


def send(cmd_type, params=None):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(180.0)
    s.connect((HOST, PORT))
    s.sendall(json.dumps({"type": cmd_type, "params": params or {}}).encode("utf-8"))
    chunks = []
    while True:
        chunk = s.recv(8192)
        if not chunk:
            break
        chunks.append(chunk)
        try:
            data = b"".join(chunks)
            json.loads(data.decode("utf-8"))
            break
        except json.JSONDecodeError:
            continue
    s.close()
    resp = json.loads(b"".join(chunks).decode("utf-8"))
    if resp.get("status") == "error":
        raise SystemExit("Blender error: " + str(resp.get("message")))
    return resp.get("result", {})


def main():
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    cmd = args[0]
    if cmd == "scene":
        print(json.dumps(send("get_scene_info"), indent=2))
    elif cmd == "object":
        print(json.dumps(send("get_object_info", {"name": args[1]}), indent=2))
    elif cmd == "shot":
        out = args[1]
        max_size = int(args[2]) if len(args) > 2 else 1200
        r = send("get_viewport_screenshot", {"max_size": max_size, "filepath": out, "format": "png"})
        print(json.dumps(r, indent=2))
    elif cmd == "exec":
        with open(args[1], "r", encoding="utf-8") as f:
            code = f.read()
        print(json.dumps(send("execute_code", {"code": code}), indent=2))
    else:
        raise SystemExit("Unknown command: " + cmd)


if __name__ == "__main__":
    main()
