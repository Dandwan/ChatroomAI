#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PORT=8000

usage() {
  echo "Usage: $0 [-p port]"
  echo "  -p port  监听端口 (默认 8000)"
  exit 1
}

while getopts "p:h" opt; do
  case $opt in
    p) PORT="$OPTARG" ;;
    h) usage ;;
    *) usage ;;
  esac
done

DIR="$PROJECT_DIR/android/app/build/outputs/apk/debug"

if [ ! -d "$DIR" ]; then
  echo "ERROR: debug 构建目录不存在: $DIR"
  echo "请先运行构建: scripts/build-and-install.sh"
  exit 1
fi

LAN_IP=$(ip -4 addr show scope global | grep -oP 'inet \K[\d.]+' | head -1)

echo "==> 共享目录: $DIR"
echo "==> 局域网访问:"
echo "    http://${LAN_IP}:${PORT}/"
echo "    http://localhost:${PORT}/"
echo ""

cd "$DIR"
python3 -m http.server "$PORT"
