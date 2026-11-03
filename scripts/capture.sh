#!/bin/bash
# Captures the demo window on macOS's glass, as macOS composites it: screencapture of this one window only, never
# brought to the front. Usage: scripts/capture.sh <backdrop picture> <out.png> [electron binary]
set -euo pipefail
BACKDROP="$1"; OUT="$2"; ELECTRON="${3:-node_modules/electron/dist/Electron.app/Contents/MacOS/Electron}"
cd "$(dirname "$0")/.."
LOCUST_GLASS_BACKDROP="$BACKDROP" "$ELECTRON" demo/main.mjs --capture > /tmp/locust-glass-capture.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
sleep 4
ID=$(osascript -l JavaScript -e "ObjC.import('CoreGraphics'); var l = ObjC.castRefToObject(\$.CGWindowListCopyWindowInfo(\$.kCGWindowListOptionAll, 0)); var best = 0, area = 0; for (var i = 0; i < l.count; i++) { var d = l.objectAtIndex(i); if (ObjC.unwrap(d.objectForKey('kCGWindowOwnerPID')) !== $PID || ObjC.unwrap(d.objectForKey('kCGWindowLayer')) !== 0) continue; var b = ObjC.deepUnwrap(d.objectForKey('kCGWindowBounds')); if (b.Width * b.Height > area) { area = b.Width * b.Height; best = ObjC.unwrap(d.objectForKey('kCGWindowNumber')) } } best")
[ "$ID" != "0" ] || { echo "no window"; cat /tmp/locust-glass-capture.log; exit 1; }
screencapture -x -o -l"$ID" "$OUT"
grep "locust-glass demo" /tmp/locust-glass-capture.log || true
echo "captured window $ID to $OUT"
