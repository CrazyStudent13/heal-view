# 自动部署

往 `master` 推送代码后，GitHub Actions 会自动构建镜像、推送到 GHCR，并让服务器拉取新镜像重启容器。整个过程不需要人工登录服务器。

## 工作方式

```
push 到 master
      │
      ├─ quality.yml        格式化 / ESLint / i18n / 测试 / 前端构建
      │        │ 通过
      ▼        ▼
  构建 Docker 镜像 ──► 推送 ghcr.io/crazystudent13/heal-view:latest
                                  和  :<commit-sha>
      │
      ▼
  SSH 登录服务器 ──► 传输镜像并 docker load ──► up -d
      │
      ▼
  轮询容器健康检查，超过 2 分钟仍未 healthy 则整个流程失败并打印日志
```

几个关键设计：

- **质量门禁**：`deploy.yml` 通过 `uses: ./.github/workflows/quality.yml` 复用同一套检查，检查不过就不部署。
- **镜像标签用 commit SHA**：每次发布都留下不可变的 `:<sha>` 标签，回滚时直接指定即可，不依赖 `latest` 的时序。
- **部署不并发**：`concurrency` 设为 `cancel-in-progress: false`。连续 push 会排队，而不是把正在进行的部署砍在半路。
- **数据卷不动**：`deploy/data` 与 `deploy/uploads` 是挂载卷，更新镜像不会影响数据库。
- **生产镜像精简**：镜像只包含后端生产依赖、服务端源码和前端构建产物，不会把服务器上的导入归档、数据库或上传文件打包进去。
- **绕过 GHCR 慢链路**：构建完成后，Actions 会通过部署所用的 SSH 链路传输压缩镜像并在服务器上加载；传输失败时才回退到 GHCR 拉取。

如果服务器位于中国大陆，访问 `ghcr.io` 的速度可能受跨境网络影响。现在正常发布会优先走 SSH 镜像传输，不要求服务器直接访问 GHCR；只有 SSH 传输失败时才会回退到 GHCR。新版镜像也移除了本地数据和前端开发依赖，进一步减少传输量。

## 前置要求

服务器（Linux VPS）：

- 已安装 Docker 与 Docker Compose **V2**（`docker compose`，不是 `docker-compose`）
- 能用 SSH 登录，且登录用户在 `docker` 组内（或直接用 root）
- 仓库是公开的，服务器拉取仓库不需要额外凭据

## 第一步：初始化服务器

SSH 登录服务器后执行：

```bash
git clone https://github.com/CrazyStudent13/heal-view.git /opt/heal-view
bash /opt/heal-view/deploy/setup-server.sh
```

脚本会检查依赖、克隆或更新仓库、由模板生成 `deploy/.env`，并打印需要配置的 Secrets 清单。脚本可以重复执行，不会覆盖已有的 `deploy/.env`，也不会碰数据库。

部署路径、分支、端口都可以覆盖：

```bash
DEPLOY_PATH=/srv/heal-view APP_PORT=8080 bash deploy/setup-server.sh
```

## 第二步：创建 GHCR 访问令牌

服务器需要凭据才能拉取私有镜像。到 GitHub → Settings → Developer settings → **Personal access tokens (classic)** → Generate new token，只勾选：

- ✅ `read:packages`

生成后把令牌保存好，下一步要用。（如果把这个包的可见性改成 public，就可以跳过这一步，同时服务器上的 `docker login` 也不再需要。）

## 第三步：创建 `production` 环境

部署任务在 `deploy.yml` 里声明了 `environment: production`，所以 Secrets 配在**环境级**，而不是仓库级：

- 环境级 Secrets 只会注入到**显式声明了该环境**的任务，仓库里其它工作流读不到它们；
- 顺带可以在这个环境上加人工审批（见下方「可选」）。

到仓库的 **Settings → Environments → New environment**，名称填 **`production`**，然后点 **Configure environment**。

> ⚠️ 顺序不能反：**先建好环境，再往里放 Secrets**。环境不存在时没有地方存放。

## 第四步：配置 Secrets

在刚建好的 `production` 环境页面，找到 **Environment secrets → Add secret**，逐个添加：

| Secret | 必填 | 说明 |
|---|---|---|
| `DEPLOY_HOST` | ✅ | 服务器公网 IP 或域名 |
| `DEPLOY_USER` | ✅ | SSH 登录用户名 |
| `DEPLOY_SSH_KEY` | ✅ | SSH **私钥**完整内容，包含 `-----BEGIN ... KEY-----` 与 `-----END ... KEY-----` 两行 |
| `DEPLOY_PATH` | ✅ | 部署目录，与第一步保持一致，例如 `/opt/heal-view` |
| `GHCR_TOKEN` | ✅ | 上一步创建的 PAT（`read:packages`） |
| `DEPLOY_PORT` | ❌ | SSH 端口，默认 `22` |

> 缺少任何一个必填 Secret，工作流会在部署前**明确失败**并列出缺哪几个，不会静默跳过。

如果服务器上还没有密钥对，在**本地**生成一对专用密钥：

```bash
ssh-keygen -t ed25519 -C "heal-view deploy" -f ~/.ssh/heal_view_deploy -N ""
ssh-copy-id -i ~/.ssh/heal_view_deploy.pub 你的用户@你的服务器
```

`heal_view_deploy`（私钥）的内容填进 `DEPLOY_SSH_KEY`，`.pub`（公钥）留在服务器的 `~/.ssh/authorized_keys`。

### 可选：部署前人工审批

在同一环境页面的 **Deployment protection rules** 勾选 **Required reviewers** 并选中自己。开启后每次部署都会暂停等待批准，建议等流水线稳定跑通几次之后再开。

## 第五步：合并到 master

部署文件必须存在于 `master` 分支上，GitHub 才会执行这套工作流。合并之后，任意一次 `master` 推送都会自动发布。

也可以在 **Actions → Build and Deploy → Run workflow** 手动触发一次。

## 回滚

在 **Actions → Build and Deploy → Run workflow**，把 `image_tag` 填成要回到的那次 commit SHA：

```
image_tag: 25c6bf3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e
```

指定 `image_tag` 时会**跳过质量检查**直接部署——回滚要快，而且此时 `master` 上的代码可能正处于出问题的状态，跑检查反而会挡住回滚。可用的标签见仓库的 **Packages** 页面。

## 数据库备份

数据全部集中在服务器的一个 SQLite 文件里，备份就是复制这个文件：

```bash
cd /opt/heal-view
docker compose --env-file deploy/.env stop heal-view
cp deploy/data/health_data.db ~/health_data-$(date +%F).db
docker compose --env-file deploy/.env start heal-view
```

> ⚠️ 数据库迁移是**单向**的。升级后如果有问题，把镜像回滚到旧 SHA 并不能撤销已经执行过的迁移。跨版本升级前先备份。
>
> 只回滚镜像、不回滚数据，是安全的——新迁移通常只是新增表或字段。

## 排查

**工作流在 "Check required secrets" 失败**
Secrets 没配全，报错信息里会列出缺哪几个。最容易踩的坑是把 Secret 配成了**仓库级**——那样部署任务读不到，必须配在 `production` 环境的 **Environment secrets** 里。

**`docker compose` 报 `unknown command` 或 `--env-file` 不识别**
服务器装的是 Compose V1。安装 `docker-compose-plugin` 换成 V2。

**`permission denied while trying to connect to the Docker daemon socket`**
SSH 用户不在 `docker` 组：`sudo usermod -aG docker $USER`，然后重新登录。

**`pull access denied` / `unauthorized`**
`GHCR_TOKEN` 无效或缺少 `read:packages`；也可能令牌已过期，重新生成并更新 Secret。

**健康检查一直不通过**
工作流会打印容器最后 150 行日志。常见原因是端口 `43128` 被占用（改 `deploy/.env` 的 `HEAL_VIEW_PORT`），或数据卷权限不对。

**部署日志里出现 `WARNING: 无法从 GitHub 同步仓库`**
服务器访问 `github.com` 被网络干扰（部分地区的常见情况）。这一步是**刻意设计成不阻断**的：真正要部署的镜像来自 `ghcr.io`，拿不到最新 compose 文件时会沿用服务器上现成的那份继续发布。

`docker-compose.yml` 很少改动，所以通常可以忽略。如果确实需要更新它，在服务器上手动执行：

```bash
cd /opt/heal-view && git pull
```

**本地 `git push` 连不上 github.com**
同样是网络干扰，且往往是间歇性的。可以改走 SSH 通道（GitHub 的 SSH 服务走 443 端口，通常不受影响）：

```bash
ssh-keygen -t ed25519 -C "heal-view" -f ~/.ssh/id_ed25519
# 把 ~/.ssh/id_ed25519.pub 的内容添加到 GitHub → Settings → SSH and GPG keys
git remote set-url origin git@github.com:CrazyStudent13/heal-view.git
```

并让 SSH 走 443 端口，在 `~/.ssh/config` 中加入：

```
Host github.com
  Hostname ssh.github.com
  Port 443
  User git
```

注意这只影响**你本地的推送**。GitHub Actions 跑在 GitHub 自己的机器上，不受此影响。

在服务器上手动查看：

```bash
cd /opt/heal-view
docker compose --env-file deploy/.env ps
docker compose --env-file deploy/.env logs --tail=100 heal-view
curl -fsS http://127.0.0.1:43128/health
```
