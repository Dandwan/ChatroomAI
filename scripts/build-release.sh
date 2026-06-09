#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SKIP_RUNTIME_PACKAGE="${SKIP_RUNTIME_PACKAGE:-false}"
BUILD_OFFLINE="${BUILD_OFFLINE:-false}"

cd "$PROJECT_DIR"

echo "==> 同步 union-search skill..."
npm run skill:sync:union-search

# ============================================================
# 打包内置运行时（Node.js / Python）→ public/runtime-packages/
# 这样 vite build 会将其复制到 dist/，最终打包进 APK
# 可通过 SKIP_RUNTIME_PACKAGE=true 跳过（用 public/ 中已有包）
# ============================================================
if [ "$SKIP_RUNTIME_PACKAGE" = "true" ]; then
  echo "==> [跳过] 跳过运行时打包 (SKIP_RUNTIME_PACKAGE=true)"
else
  RUNTIME_PACKAGE_OPTS="--output-dir public/runtime-packages"
  if [ "$BUILD_OFFLINE" = "true" ]; then
    RUNTIME_PACKAGE_OPTS="$RUNTIME_PACKAGE_OPTS --offline true"
    echo "==> 离线模式：使用缓存的运行时包 (BUILD_OFFLINE=true)"
  fi

  echo "==> 打包 Node.js 运行时..."
  NODE_OPTIONS="${NODE_OPTIONS:-} --use-system-ca" \
    npm run runtime:package:node -- $RUNTIME_PACKAGE_OPTS || {
    echo "  ⚠ Node.js 运行时打包失败（使用已有包继续）"
  }

  echo "==> 打包 Python 运行时..."
  NODE_OPTIONS="${NODE_OPTIONS:-} --use-system-ca" \
    npm run runtime:package:python -- $RUNTIME_PACKAGE_OPTS || {
    echo "  ⚠ Python 运行时打包失败（使用已有包继续）"
  }

  echo "==> 运行时打包完成"
fi

# ============================================================
# 构建 Android release APK
# ============================================================
echo "==> 构建 Android release APK..."
npm run android:build:release

APK="$PROJECT_DIR/android/app/build/outputs/apk/release/app-release.apk"

if [ ! -f "$APK" ]; then
  echo "ERROR: APK 未找到: $APK"
  exit 1
fi

OUT_DIR="$PROJECT_DIR/build-output"
mkdir -p "$OUT_DIR"
cp "$APK" "$OUT_DIR/ActiChat-release.apk"
echo "==> 构建完成: $OUT_DIR/ActiChat-release.apk"
