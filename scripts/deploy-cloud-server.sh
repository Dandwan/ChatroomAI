#!/usr/bin/env bash
# ============================================================
# deploy-cloud-server.sh — 一键更新 dandwan.site 上的云端服务
#
# 用法:
#   ./scripts/deploy-cloud-server.sh           # 使用默认配置
#   ./scripts/deploy-cloud-server.sh --dry-run  # 仅预览将要同步的文件
#   ./scripts/deploy-cloud-server.sh --no-build # 仅同步代码，不重建
# ============================================================
set -euo pipefail

# ── 配置 ──────────────────────────────────────────────────
SSH_HOST="${DEPLOY_SSH_HOST:-dandwan.site}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/root/actichat-cloud-server}"
LOCAL_DIR="${DEPLOY_LOCAL_DIR:-$(cd "$(dirname "$0")/.." && pwd)/cloud-server}"
# ───────────────────────────────────────────────────────────

DRY_RUN=false
NO_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --no-build) NO_BUILD=true ;;
    -h|--help)
      echo "用法: $0 [--dry-run] [--no-build]"
      echo ""
      echo "选项:"
      echo "  --dry-run   仅列出将要同步的文件变更，不实际执行"
      echo "  --no-build  仅同步代码，跳过 Docker 构建和重启"
      echo "  -h, --help  显示此帮助信息"
      echo ""
      echo "环境变量:"
      echo "  DEPLOY_SSH_HOST        SSH 目标主机 (默认: dandwan.site)"
      echo "  DEPLOY_REMOTE_DIR      服务器上的项目目录 (默认: /root/actichat-cloud-server)"
      echo "  DEPLOY_LOCAL_DIR       本地 cloud-server 目录 (默认: 自动检测)"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════════════╗"
echo "║   ActiChat Cloud Server — 一键部署脚本      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  本地目录 : $LOCAL_DIR"
echo "  远程主机 : $SSH_HOST"
echo "  远程目录 : $REMOTE_DIR"
echo ""

if [ ! -d "$LOCAL_DIR" ]; then
  echo "❌ 错误: 本地 cloud-server 目录不存在: $LOCAL_DIR"
  exit 1
fi

# ── Step 1: 检查 SSH 连接 ──────────────────────────────────
echo "🔍 [1/3] 检查 SSH 连接..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$SSH_HOST" "echo OK" &>/dev/null; then
  echo "❌ 错误: 无法连接到 $SSH_HOST，请检查 SSH 配置"
  exit 1
fi
echo "   ✅ SSH 连接正常"
echo ""

# ── Step 2: 同步代码 ──────────────────────────────────────
RSYNC_EXCLUDES=(
  --exclude='node_modules'
  --exclude='dist'
  --exclude='data'
  --exclude='admin-ui/dist'
  --exclude='admin-ui/node_modules'
  --exclude='admin-ui/tsconfig.tsbuildinfo'
  --exclude='config.json'
)

if $DRY_RUN; then
  echo "🔍 [2/3] (预览模式) 将要同步的文件变更..."
  echo ""
  rsync -avz --dry-run --delete "${RSYNC_EXCLUDES[@]}" \
    "$LOCAL_DIR/" "$SSH_HOST:$REMOTE_DIR/"
  echo ""
  echo "   ℹ️  以上是将要同步的变更 (未实际执行)"
  exit 0
fi

echo "📦 [2/3] 同步代码到服务器..."
rsync -avz --delete "${RSYNC_EXCLUDES[@]}" \
  "$LOCAL_DIR/" "$SSH_HOST:$REMOTE_DIR/"
echo "   ✅ 代码同步完成"
echo ""

# ── Step 3: 重建并重启 ─────────────────────────────────────
if $NO_BUILD; then
  echo "⏭️  [3/3] 跳过构建 (--no-build)"
  echo ""
  echo "✨ 完成! 代码已同步但未重建容器。"
  exit 0
fi

echo "🐳 [3/3] 重建 Docker 镜像并重启容器..."
ssh "$SSH_HOST" <<'ENDSSH'
set -e
cd /root/actichat-cloud-server

# 修复权限
chown -R admin:admin . 2>/dev/null || true

echo "   ⏳ 停止旧容器..."
docker compose down

echo "   ⏳ 构建新镜像..."
docker compose up -d --build

echo ""
echo "   ✅ 容器状态:"
docker ps --filter "name=actichat-cloud-server" \
  --format "   {{.Names}} | {{.Status}} | {{.CreatedAt}}"

echo ""
echo "   📋 最近日志:"
docker logs actichat-cloud-server --tail 8 2>&1 | while IFS= read -r line; do
  echo "   | $line"
done
ENDSSH

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ✨ 部署完成!                              ║"
echo "║   服务地址: https://dandwan.site:2179        ║"
echo "║   Admin UI: https://dandwan.site:2179/admin  ║"
echo "╚══════════════════════════════════════════════╝"
