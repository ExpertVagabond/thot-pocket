#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Building WASM..."
wasm-pack build --target web --release --out-dir web/pkg
echo "Build complete. Serve from web/ directory."
echo "  Local: cd web && python3 -m http.server 8080"
echo "  Deploy: wrangler pages deploy web --project-name thot-pocket-demo"
