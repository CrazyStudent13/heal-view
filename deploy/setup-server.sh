#!/usr/bin/env bash
#
# Heal View 服务器端初始化脚本（Linux VPS + Docker）
#
# 作用：检查依赖 → 拉取仓库到部署目录 → 生成 deploy/.env → 打印下一步要配的 GitHub Secrets。
# 本脚本可重复执行，不会覆盖已有的 deploy/.env，也不会碰数据库。
#
# 用法：
#   bash deploy/setup-server.sh
#
# 可用环境变量覆盖默认值：
#   DEPLOY_PATH    部署目录          默认 /opt/heal-view
#   DEPLOY_BRANCH  跟踪的分支        默认 master
#   REPO_URL       仓库地址          默认 https://github.com/CrazyStudent13/heal-view.git
#   APP_PORT       对外端口          默认 43128
#
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/heal-view}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-master}"
REPO_URL="${REPO_URL:-https://github.com/CrazyStudent13/heal-view.git}"
APP_PORT="${APP_PORT:-43128}"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

log "检查依赖"

command -v git >/dev/null 2>&1 || die "未安装 git。Debian/Ubuntu: apt install -y git；CentOS/RHEL: yum install -y git"

command -v docker >/dev/null 2>&1 || die "未安装 Docker。请参考 https://docs.docker.com/engine/install/ 安装后重试。"

if ! docker compose version >/dev/null 2>&1; then
  die "未找到 docker compose（V2 插件）。本项目的 compose 文件使用 V2 语法，请安装 docker-compose-plugin。"
fi

if ! docker info >/dev/null 2>&1; then
  die "当前用户无法访问 Docker 守护进程。请用 root 运行，或执行：sudo usermod -aG docker \$USER 后重新登录。"
fi

log "依赖检查通过（git / docker / docker compose 均可用）"

# ---------------------------------------------------------------- 拉取仓库

if [ -d "$DEPLOY_PATH/.git" ]; then
  log "更新已有部署目录 $DEPLOY_PATH（分支 $DEPLOY_BRANCH）"
  git -C "$DEPLOY_PATH" fetch --prune origin "$DEPLOY_BRANCH"
  # deploy/.env、deploy/data、deploy/uploads 都在 .gitignore 中，不会被覆盖。
  git -C "$DEPLOY_PATH" checkout -f -B "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"
else
  if [ -e "$DEPLOY_PATH" ] && [ -n "$(ls -A "$DEPLOY_PATH" 2>/dev/null)" ]; then
    die "$DEPLOY_PATH 已存在且不为空，但不是 git 仓库。请先清空该目录，或用 DEPLOY_PATH=其他路径 重新运行。"
  fi
  log "克隆仓库到 $DEPLOY_PATH（分支 $DEPLOY_BRANCH）"
  mkdir -p "$(dirname "$DEPLOY_PATH")"
  git clone --branch "$DEPLOY_BRANCH" "$REPO_URL" "$DEPLOY_PATH"
fi

cd "$DEPLOY_PATH"

[ -f docker-compose.yml ] || die "$DEPLOY_BRANCH 分支上还没有 docker-compose.yml。请先把包含部署文件的提交合并到 $DEPLOY_BRANCH 再重试。"

# ---------------------------------------------------------------- 生成配置

if [ -f deploy/.env ]; then
  log "deploy/.env 已存在，保持不变"
else
  log "由 deploy/.env.example 生成 deploy/.env"
  cp deploy/.env.example deploy/.env
  if grep -q '^HEAL_VIEW_PORT=' deploy/.env; then
    sed -i "s#^HEAL_VIEW_PORT=.*#HEAL_VIEW_PORT=$APP_PORT#" deploy/.env
  else
    echo "HEAL_VIEW_PORT=$APP_PORT" >> deploy/.env
  fi
fi

mkdir -p deploy/data deploy/uploads

# ---------------------------------------------------------------- 输出结论

cat <<EOF

────────────────────────────────────────────────────────────────
服务器准备完成
────────────────────────────────────────────────────────────────
部署目录   : $DEPLOY_PATH
跟踪分支   : $DEPLOY_BRANCH
配置模板   : $DEPLOY_PATH/deploy/.env
数据库位置 : $DEPLOY_PATH/deploy/data/health_data.db

接下来在 GitHub 上配置 Secrets（注意是「环境级」，不是仓库级）

  1) 仓库 → Settings → Environments → New environment
     名称填 production（必须与 deploy.yml 里的 environment 一致）

  2) 在该环境的 Environment secrets 里逐个添加：

  DEPLOY_HOST    = 本机公网 IP 或域名
  DEPLOY_USER    = 用于 SSH 登录的用户（需在 docker 组内）
  DEPLOY_SSH_KEY = 对应私钥的完整内容（含 BEGIN/END 行）
  DEPLOY_PATH    = $DEPLOY_PATH
  GHCR_TOKEN     = GitHub PAT（classic），勾选 read:packages
  DEPLOY_PORT    = 可选，SSH 端口，默认 22

  配成仓库级 Secret 部署任务读不到，会直接报缺少 Secrets。

配好之后，只要往 master 推代码就会自动构建并部署。

手动验证（首次部署后执行）：
  cd $DEPLOY_PATH
  docker compose --env-file deploy/.env ps
  curl -fsS http://127.0.0.1:$APP_PORT/health

EOF
