#!/usr/bin/env bash
# 用法：typecheck-happiest.sh <workspace 名> [...]，每个 workspace 的输出写到 .dev/local/out/tc-<短名>.log
set -u
WORKTREE=/c/Users/Thinkbook-16p/Workspace/code/Happiest/.dev/worktree/happiest-experience
OUT=/c/Users/Thinkbook-16p/Workspace/code/Happiest/.dev/local/out
mkdir -p "$OUT"
cd "$WORKTREE"
for ws in "$@"; do
  short="${ws##*/}"
  (yarn workspace "$ws" typecheck > "$OUT/tc-$short.log" 2>&1; echo "exit $?" >> "$OUT/tc-$short.log") &
done
wait
for ws in "$@"; do
  short="${ws##*/}"
  echo "== $ws"
  tail -n 8 "$OUT/tc-$short.log"
done
