#!/bin/sh
# Copy the mizan-agent-tools client into src/vendor until it is published to npm.
set -e
SRC="${MIZAN_CLIENT_SRC:-$(dirname "$0")/../../mizan-agent-tools/src}"
DST="$(dirname "$0")/../src/vendor/mizan-agent-tools"
mkdir -p "$DST"
for f in client.ts types.ts index.ts; do
  { echo "// Vendored from mizan-agent-tools (MIT). Do not edit here; run scripts/sync-client.sh."; cat "$SRC/$f"; } > "$DST/$f"
done
