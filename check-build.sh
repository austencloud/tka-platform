#!/bin/bash
cd "F:/tka-platform"
npx vite build 2>&1 | tail -20
echo "EXIT: $?"
