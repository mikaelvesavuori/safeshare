#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

npm run build

rm -rf release
mkdir -p release

cp dist/worker.js release/worker.js
cp README.md LICENSE package.json wrangler.toml release/

rm -f safeshare_release.zip worker.js.sha256 safeshare_release.zip.sha256

(
  cd release
  zip -r ../safeshare_release.zip .
)

shasum -a 256 dist/worker.js > worker.js.sha256
shasum -a 256 safeshare_release.zip > safeshare_release.zip.sha256
