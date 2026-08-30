#!/usr/bin/env bash
# =========================================================
# photo-album 一键部署脚本（Windows Git Bash / Linux 通用）
#
# 流程: 本地 docker build → docker save 导出 tar.gz → scp 上传
#    → 远端 docker load → docker compose 重建容器 → 健康检查
#    → 清理旧镜像与临时文件
#
# 用法:
#   ./deploy.sh          完整部署
#   ./deploy.sh init     仅配置 SSH 免密（首次使用前执行一次）
#   ./deploy.sh build    仅构建本地镜像
#   ./deploy.sh status   查看服务器容器状态
#   ./deploy.sh logs     跟随查看服务器日志（Ctrl+C 退出）
#   ./deploy.sh help     查看帮助
#
# 首次使用:
#   cp .deploy.env.example .deploy.env   # 填入服务器 SSH 密码（已 gitignore）
#   ./deploy.sh init                    # 自动安装公钥，成功后 .deploy.env 可删除
#   ./deploy.sh
# =========================================================
set -euo pipefail

# ---------- 配置（可用环境变量覆盖） ----------
REMOTE_HOST="${DEPLOY_HOST:-192.168.31.241}"
REMOTE_USER="${DEPLOY_USER:-yjltf}"
REMOTE_DIR="${DEPLOY_DIR:-/app/photo-album}"
IMAGE_NAME="${DEPLOY_IMAGE:-photo-album:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-photo-album-server}"
DEPLOY_OUT_DIR="${DEPLOY_OUT_DIR:-deploy-out}"  # 本地导出包目录（已 gitignore）
KEEP_LOCAL_TARS="${KEEP_LOCAL_TARS:-3}"         # 本地保留最近几个导出包
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"         # 远端健康检查等待秒数
COMPOSE_FILE="docker-compose.yml"
DEPLOY_ENV_FILE=".deploy.env"                   # 仅 init 使用，存放服务器 SSH 密码

# ---------- 输出辅助 ----------
if [ -t 1 ]; then
  C_G=$'\033[32m'; C_Y=$'\033[33m'; C_R=$'\033[31m'; C_B=$'\033[36m'; C_0=$'\033[0m'
else
  C_G=''; C_Y=''; C_R=''; C_B=''; C_0=''
fi
info() { printf '%s[INFO]%s %s\n' "$C_B" "$C_0" "$*"; }
ok()   { printf '%s[ OK ]%s %s\n' "$C_G" "$C_0" "$*"; }
warn() { printf '%s[WARN]%s %s\n' "$C_Y" "$C_0" "$*"; }
die()  { printf '%s[FAIL]%s %s\n' "$C_R" "$C_0" "$*" >&2; exit 1; }

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
ssh_run() { ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" "$@"; }

TAR_NAME=""

# ---------- SSH 免密配置 ----------
load_deploy_env() {
  if [ -f "$DEPLOY_ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1091
    . "./$DEPLOY_ENV_FILE"
    set +a
  fi
}

cmd_init() {
  local pub="$HOME/.ssh/id_ed25519.pub"
  if [ ! -f "$pub" ]; then
    info "本地没有 SSH 密钥，先生成 id_ed25519 ..."
    ssh-keygen -t ed25519 -N "" -f "$HOME/.ssh/id_ed25519" -q
  fi
  load_deploy_env
  if [ -n "${DEPLOY_SSH_PASS:-}" ]; then
    # 无交互方式：通过 SSH_ASKPASS 提供密码（需 OpenSSH >= 8.4，Git Bash 自带版本满足）
    local askpass
    askpass=$(mktemp)
    printf '#!/bin/sh\necho "$DEPLOY_SSH_PASS"\n' > "$askpass"
    chmod +x "$askpass"
    info "使用 $DEPLOY_ENV_FILE 中的密码自动安装公钥到 $REMOTE_USER@$REMOTE_HOST ..."
    if SSH_ASKPASS="$askpass" SSH_ASKPASS_REQUIRE=force DISPLAY=:0 \
       ssh-copy-id -i "$pub" "$REMOTE_USER@$REMOTE_HOST"; then
      rm -f "$askpass"
    else
      rm -f "$askpass"
      die "自动安装公钥失败，可删除 $DEPLOY_ENV_FILE 后重试（会提示手动输入密码）"
    fi
  else
    info "未配置 DEPLOY_SSH_PASS，将提示输入服务器密码（只需这一次）..."
    ssh-copy-id -o StrictHostKeyChecking=accept-new -i "$pub" "$REMOTE_USER@$REMOTE_HOST"
  fi
  ssh_run 'echo -n' >/dev/null 2>&1 || die "免密登录验证失败"
  ok "SSH 免密登录已配置: $REMOTE_USER@$REMOTE_HOST"
}

ensure_ssh() {
  if ssh_run 'echo -n' >/dev/null 2>&1; then
    return 0
  fi
  warn "尚未配置 SSH 免密，尝试自动配置 ..."
  cmd_init
}

# ---------- 本地构建 / 导出 ----------
# 可传入构建用的 VITE_API_URL；不传则回退到本地 .env（再回退 /api）
cmd_build() {
  command docker >/dev/null 2>&1 || die "本地未安装 docker"
  local vite_api_url="${1:-}"
  if [ -z "$vite_api_url" ]; then
    vite_api_url="/api"
    if [ -f .env ]; then
      vite_api_url=$(sed -n 's/^VITE_API_URL=//p' .env | tail -n 1)
      vite_api_url="${vite_api_url:-/api}"
    fi
  fi
  info "构建镜像 $IMAGE_NAME（VITE_API_URL=$vite_api_url）..."
  # Git Bash 下 docker.exe 是原生 Windows 程序，/api 这类参数会被 MSYS 自动转成
  # D:/.../Git/api 之类的路径打进前端包，必须关闭参数路径转换；
  # 值等于默认 /api 时直接不传，用 Dockerfile 内置默认值（在 Linux 容器内展开，最稳妥）
  if [ "$vite_api_url" = "/api" ]; then
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker build -t "$IMAGE_NAME" .
  else
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker build --build-arg "VITE_API_URL=$vite_api_url" -t "$IMAGE_NAME" .
  fi
  ok "镜像构建完成: $IMAGE_NAME"
}

step_export() {
  command docker >/dev/null 2>&1 || die "本地未安装 docker"
  mkdir -p "$DEPLOY_OUT_DIR"
  TAR_NAME="photo-album-$(date +%Y%m%d-%H%M%S).tar"
  info "导出镜像到 $DEPLOY_OUT_DIR/$TAR_NAME.gz（可能需要几分钟）..."
  # 先 save 到文件再 gzip，避免 Windows 下二进制管道兼容问题
  docker save -o "$DEPLOY_OUT_DIR/$TAR_NAME" "$IMAGE_NAME"
  gzip -f "$DEPLOY_OUT_DIR/$TAR_NAME"
  local size
  size=$(du -h "$DEPLOY_OUT_DIR/$TAR_NAME.gz" | cut -f 1)
  ok "导出完成，大小 $size"
  # 本地只保留最近 KEEP_LOCAL_TARS 个导出包
  ls -1t "$DEPLOY_OUT_DIR"/photo-album-*.tar.gz 2>/dev/null | tail -n "+$((KEEP_LOCAL_TARS + 1))" | while IFS= read -r f; do
    warn "删除旧导出包: $f"
    rm -f "$f"
  done || true
}

# ---------- 上传 ----------
step_upload() {
  info "准备远端目录并清理历史安装包 ..."
  ssh_run "mkdir -p '$REMOTE_DIR' && rm -f '$REMOTE_DIR'/photo-album-*.tar.gz '$REMOTE_DIR'/photo-album-*.tar '$REMOTE_DIR'/photo-album.tar"
  info "上传 $COMPOSE_FILE 与镜像包到 $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR ..."
  scp "${SSH_OPTS[@]}" "$COMPOSE_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/$COMPOSE_FILE"
  scp "${SSH_OPTS[@]}" "$DEPLOY_OUT_DIR/$TAR_NAME.gz" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/$TAR_NAME.gz"
  ok "上传完成"
}

# ---------- 远端部署 ----------
step_remote_deploy() {
  info "远端加载镜像并重启服务 ..."
  ssh_run 'bash -s' -- "$TAR_NAME.gz" "$IMAGE_NAME" "$CONTAINER_NAME" "$REMOTE_DIR" "$HEALTH_TIMEOUT" <<'REMOTE_SCRIPT'
set -euo pipefail
TAR_GZ="$1"; IMAGE="$2"; CONTAINER="$3"; RDIR="$4"; TIMEOUT="$5"
cd "$RDIR"

if ! docker ps >/dev/null 2>&1; then
  echo "FAIL: 当前用户无法访问 docker（不在 docker 组）。请在服务器执行:"
  echo "  sudo groupadd -f docker && sudo usermod -aG docker \$USER && sudo chgrp docker /var/run/docker.sock"
  echo "然后重新登录再部署"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "FAIL: 服务器未安装 docker compose 插件"
  exit 1
fi
COMPOSE="docker compose"

# 旧部署的环境变量文件名为 env（docker compose 不识别），首次部署迁移为 .env
if [ ! -f .env ] && [ -f env ]; then
  cp env .env
  echo "已将 $RDIR/env 复制为 $RDIR/.env（docker compose 默认读取 .env）"
fi
if [ ! -f .env ]; then
  echo "FAIL: $RDIR/.env 不存在（需包含 JWT_SECRET 等）。脚本不会覆盖服务器 .env，请手动配置后再部署"
  exit 1
fi

# 记录旧镜像 ID（docker load 覆盖 latest 标签后旧镜像会变成悬空镜像）
OLD_ID=$(docker images --no-trunc -q "$IMAGE" 2>/dev/null || true)

echo "加载镜像 $TAR_GZ ..."
docker load -i "$TAR_GZ"
NEW_ID=$(docker images --no-trunc -q "$IMAGE" 2>/dev/null || true)

echo "重建容器 ..."
$COMPOSE up -d --no-build

printf '等待健康检查'
status=""; elapsed=0
while [ "$elapsed" -lt "$TIMEOUT" ]; do
  status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER" 2>/dev/null || echo missing)
  if [ "$status" = "healthy" ]; then
    break
  fi
  if [ "$status" = "missing" ]; then
    echo
    echo "FAIL: 容器 $CONTAINER 未运行，最近日志:"
    docker logs --tail 50 "$CONTAINER" 2>&1 || true
    exit 1
  fi
  printf '.'; sleep 3; elapsed=$((elapsed + 3))
done
echo

if [ "$status" != "healthy" ]; then
  echo "FAIL: 健康检查超时（${TIMEOUT}s），容器日志:"
  docker logs --tail 50 "$CONTAINER" 2>&1 || true
  if [ -n "$OLD_ID" ] && [ "$OLD_ID" != "$NEW_ID" ]; then
    echo "提示: 旧镜像尚未删除，可手动回滚: docker tag $OLD_ID $IMAGE && cd $RDIR && $COMPOSE up -d --no-build"
  fi
  exit 1
fi

# 健康检查通过后才清理旧镜像与临时文件
if [ -n "$OLD_ID" ] && [ "$OLD_ID" != "$NEW_ID" ]; then
  docker rmi "$OLD_ID" >/dev/null 2>&1 || true
fi
docker image prune -f >/dev/null 2>&1 || true
rm -f "$TAR_GZ"
docker ps --filter "name=$CONTAINER" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "REMOTE_OK new_image=${NEW_ID}"
REMOTE_SCRIPT
  ok "远端部署完成"
}

# ---------- 子命令 ----------
# 生产前端的 API 地址以服务器 env 为准，避免把本地开发配置（localhost）打进镜像
remote_vite_api_url() {
  ssh_run "[ -f '$REMOTE_DIR/.env' ] && f='$REMOTE_DIR/.env' || f='$REMOTE_DIR/env'; sed -n 's/^VITE_API_URL=//p' \"\$f\" 2>/dev/null | tail -1" 2>/dev/null
}

cmd_deploy() {
  info "========== 一键部署 $IMAGE_NAME → $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR =========="
  ensure_ssh
  local vite
  vite=$(remote_vite_api_url) || vite=""
  info "前端 API 地址（取自服务器配置）: VITE_API_URL=${vite:-/api}"
  cmd_build "${vite:-/api}"
  step_export
  step_upload
  step_remote_deploy
  ok "========== 部署成功 =========="
}

cmd_status() {
  ensure_ssh
  ssh_run "docker ps -a --filter name=$CONTAINER_NAME --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'; docker images '$IMAGE_NAME'; df -h '$REMOTE_DIR' | tail -1"
}

cmd_logs() {
  ensure_ssh
  ssh_run "docker logs -f --tail 100 '$CONTAINER_NAME'"
}

usage() {
  sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
}

main() {
  cd "$(dirname "$0")"
  local cmd="${1:-deploy}"
  case "$cmd" in
    deploy) cmd_deploy ;;
    init)   cmd_init ;;
    build)  cmd_build ;;
    status) cmd_status ;;
    logs)   cmd_logs ;;
    help|-h|--help) usage ;;
    *) die "未知命令: $cmd（参见 ./deploy.sh help）" ;;
  esac
}

main "$@"
