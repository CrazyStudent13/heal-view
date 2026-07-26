# Nest + MySQL + Redis 后端重构计划

> 状态：讨论稿 v0.2
>
> 更新日期：2026-07-20
>
> 目标分支：`codex/refactor-nest-backend`

## 1. 项目目标

将当前单用户 Express + `sql.js` 后端重构为支持多用户的 Nest Web 服务，使用 MySQL 作为唯一业务数据源，使用 Redis 处理登录会话、缓存、限流、实时安全通知和导入任务队列。

首期目标用户约 100 人，同时在线不超过 20 人；架构需要能平滑扩展到约 1000 人，但不引入微服务或 Kubernetes。

## 2. 已确认的产品与环境约束

| 项目 | 已确认决策 |
| --- | --- |
| 客户端 | 首期仅 Web，保留未来 App 扩展可能 |
| 开发端口 | Vue `5173`，Nest API `3000` |
| MySQL | 8.4.9；首期不启用 SSL，配置层预留 TLS/CA 支持 |
| Redis | 独立实例；启用密码和 TLS；不与其他项目共用 |
| 云服务器 | 腾讯云，4C4G，70GB 硬盘，当前约 40GB 可用 |
| 用户规模 | 首期约 100 人，长期上限预估约 1000 人 |
| 登录方式 | 用户名或邮箱 + 密码 |
| 注册方式 | 用户名、邮箱、密码、确认密码；暂不验证邮箱 |
| 多设备策略 | 不允许多设备；检测到已有有效会话时拒绝新设备登录 |
| 安全提醒 | 拒绝新登录后，向当前在线会话发送账号登录尝试提醒，并建议修改密码 |
| 邮箱能力 | 邮箱验证、找回密码、邮件通知均延期 |
| 数据来源 | 用户上传小米健康导出 ZIP；未来可能连接小米接口 |
| SQLite | 测试数据，不迁移到生产 MySQL |
| 原始 ZIP | 导入后暂时保留，每月定期清理，并在上传页面明确提示 |
| 用户删除 | 用户可删除自己的全部健康数据 |

## 3. 总体架构

```text
Nginx
  ├── Vue Web
  └── /api -> Nest API :3000
                  ├── MySQL 8.4.9
                  ├── Redis (TLS + password)
                  ├── WebSocket Gateway
                  └── BullMQ -> Import Worker
```

- 使用模块化 Nest 单体，不拆微服务。
- API 与导入 Worker 分进程运行，避免大文件解析阻塞 HTTP 请求。
- 生产环境通过 Nginx 同域代理 `/api`，降低 Cookie、CORS 和 CSRF 配置复杂度。
- Worker 首期并发固定为 1，适配 4GB 内存；后续根据监控调整。
- MySQL连接池首期限制在 10～15 个连接，避免空闲连接占满云数据库配额。

## 4. Nest 模块边界

| 模块 | 职责 |
| --- | --- |
| `AuthModule` | 注册、登录、刷新、退出、单设备会话、密码修改 |
| `UsersModule` | 用户账号、状态、个人档案、数据删除 |
| `HealthMetricsModule` | 步数、心率、压力、卡路里、血氧等时序数据 |
| `SleepModule` | 睡眠会话、阶段和分析 |
| `SportsModule` | 运动记录和轨迹摘要 |
| `WeightModule` | 体重、BMI及目标信息 |
| `ImportsModule` | ZIP上传、校验、任务进度、解析和幂等导入 |
| `CacheModule` | Redis缓存、键名规范和失效策略 |
| `NotificationsModule` | WebSocket安全事件通知 |
| `CommonModule` | Guard、装饰器、异常过滤、日志、请求上下文 |

Controller只负责协议转换和参数校验；业务逻辑进入 Service；数据库读写进入 Repository，禁止在Controller中直接拼SQL。

## 5. 认证与单设备会话

### 5.1 首期认证流程

- 注册字段：`username`、`email`、`password`、`confirmPassword`。
- 用户名和邮箱分别全局唯一，统一转小写/规范化后判断重复。
- `confirmPassword` 仅用于注册校验，不写入数据库。
- 密码使用 Argon2id 哈希，不保存明文或可逆密文。
- 登录字段为 `identifier + password`，`identifier` 可为用户名或邮箱。
- Access Token 建议有效期 15 分钟；Refresh Session 建议有效期 30 天。
- Web端通过 `HttpOnly + Secure + SameSite` Cookie保存令牌；本地开发允许非Secure Cookie。

### 5.2 单设备约束

- MySQL `user_sessions` 保存可审计的会话记录和刷新令牌哈希。
- Redis保存 `auth:user:{userId}:session -> sessionId`，TTL与Refresh Session一致。
- 新登录成功校验密码后，如果发现其他有效会话：
  1. 返回 `409 ACTIVE_SESSION_EXISTS`，拒绝创建新会话。
  2. 写入结构化安全日志。
  3. 通过Redis Pub/Sub和WebSocket向旧会话发送 `security.login_attempt`。
  4. 前端展示“检测到其他设备尝试登录，账号可能存在安全风险，建议修改密码”。
- 用户主动退出或修改密码后，撤销MySQL会话并删除Redis会话键。
- Redis状态丢失时以MySQL有效会话为兜底，避免错误放行多设备登录。

### 5.3 首期限制

- 暂不实现邮箱验证、邮箱找回密码和邮件通知。
- 在自助找回密码上线前，遗失唯一登录设备后的会话解除需要管理员处理。
- 邮箱验证和找回密码作为独立后续里程碑，不能以明文临时密码替代。

## 6. MySQL 数据设计

采用 TypeORM Entity + Migration 管理结构，同时交付可人工执行的初始化SQL。生产账号只授予目标数据库所需的最小权限。

### 6.1 核心表

- `user_accounts`：账号、密码哈希、状态、邮箱验证状态、时间戳。
- `user_profiles`：性别、出生日期、身高、目标信息。
- `user_sessions`：单设备会话、刷新令牌哈希、设备/IP信息、过期与撤销状态。
- `import_jobs`：ZIP路径、哈希、上传、排队、解析、成功、失败和计划删除状态。
- `health_metric_series`：按用户、日期、指标保存统计字段和压缩后的分钟级数据。
- `sleep_sessions`：结构化睡眠记录及压缩后的阶段数据。
- `sport_records`：结构化运动记录。

### 6.2 时序数据存储

不将每个分钟采样点保存为独立MySQL行。使用以下逻辑主键保存按日压缩数据块：

```text
(user_id, local_date, metric_type) -> gzip payload
```

当前真实测试库包含约100万条、341天的时序采样，SQLite文件为146MB。将数据转为紧凑数组并按日/指标gzip后约为1.51MB；按相同密度推算三年压缩载荷约4.9MB/用户。生产MySQL还需计算行开销、索引、汇总、运动和备份，因此按100用户预留10～20GB数据库空间。

建议表约束和索引：

```text
UNIQUE (user_id, local_date, metric_type)
INDEX  (user_id, local_date)
INDEX  (user_id, metric_type, local_date)
```

日汇总和跨日期统计直接读取 `health_metric_series` 的 `min_value`、`max_value`、`avg_value` 和 `sum_value`，并缓存最终响应；单日图表才解压 `payload`，避免在MySQL中扫描和解析分钟级明细。

## 7. ZIP 上传与导入

### 7.1 已检查样例

样例：`data/20260629_1323159881_MiFitness_c3_data_copy.zip`

| 指标 | 结果 |
| --- | ---: |
| ZIP大小 | 7,510,587 bytes |
| 文件数量 | 35 |
| 解压总大小 | 136,197,775 bytes |
| 最大CSV | 134,611,694 bytes |
| 压缩比 | 约18.1:1 |
| 路径穿越条目 | 0 |

### 7.2 导入流程

1. API流式接收ZIP到隔离上传目录，不把完整文件读入内存。
2. 校验扩展名、MIME、文件头、条目数量、路径和压缩比。
3. 计算SHA-256并创建 `import_jobs`；相同用户和相同哈希禁止重复导入。
4. 将任务写入BullMQ，API立即返回任务ID。
5. Worker流式解压和解析CSV，以每批1000条左右写入或合并MySQL。
6. 写入每个指标的统计字段，清除当前用户相关Redis缓存。
7. 删除解压后的临时CSV，保留原始ZIP到计划清理日期。
8. 前端轮询或通过WebSocket显示导入进度和失败原因。

### 7.3 首期安全限制

- 单ZIP建议上限：200MB。
- 解压后总大小建议上限：2GB。
- 条目数建议上限：200。
- 单文件建议上限：1GB。
- 最大压缩比建议上限：100:1。
- 禁止绝对路径、`../`、符号链接和目标目录外写入。
- Worker并发为1；无论成功或失败，都清理解压临时目录。

### 7.4 原始ZIP保留与清理

- 上传界面明确提示原始ZIP会被定期删除，导入后的健康数据不受影响。
- 使用定时任务执行文件删除，并同步更新 `import_jobs.zip_deleted_at`。
- 删除用户全部数据时立即删除其所有原始ZIP，不等待月度任务。
- 本地上传目录设置容量告警；磁盘使用超过80%时暂停新上传并通知管理员。

## 8. Redis 使用规范

- 连接使用 `rediss://` 或等价TLS配置，并验证服务端证书。
- 密码只通过环境变量或云密钥服务注入，不写入仓库。
- 使用统一前缀，如 `heal-view:prod:`，禁止执行 `FLUSHDB`。
- 主要键空间：

```text
auth:user:{userId}:session
auth:session:{sessionId}
rate-limit:login:{ip-or-identifier}
cache:user:{userId}:summary:{date}
cache:user:{userId}:metric:{metric}:{date}
import:job:{jobId}
notification:user:{userId}
```

- 缓存不是事实来源；Redis不可用时允许健康数据查询降级直读MySQL，但登录、刷新和导入队列需要明确返回服务暂不可用。

## 9. 用户数据删除

提供两个独立操作：

- 删除健康数据：删除时序、汇总、睡眠、运动、体重、导入记录、ZIP和相关Redis缓存，保留账号。
- 注销账号：先撤销会话，再删除全部健康数据和用户资料，最后删除或匿名化账号审计信息。

删除使用后台任务执行，接口返回任务ID。任务必须幂等，并记录每个数据域的删除结果；前端在执行前要求用户再次输入密码确认。

## 10. 配置约定

不在聊天、仓库或日志中提交真实连接密码。实现阶段提供 `.env.example`：

```env
PORT=3000
WEB_ORIGIN=http://localhost:5173

MYSQL_HOST=
MYSQL_PORT=3306
MYSQL_DATABASE=
MYSQL_USERNAME=
MYSQL_PASSWORD=
MYSQL_SSL_ENABLED=false
MYSQL_SSL_CA_PATH=

REDIS_HOST=
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_TLS_ENABLED=true
REDIS_TLS_CA_PATH=

JWT_ACCESS_SECRET=
JWT_ACCESS_TTL=15m
SESSION_TTL=30d

UPLOAD_DIR=
MAX_UPLOAD_BYTES=209715200
MAX_UNCOMPRESSED_BYTES=2147483648
IMPORT_WORKER_CONCURRENCY=1
```

## 11. 分阶段实施

### 阶段一：契约与基础设施

- 固化当前前端使用的API响应，建立契约测试。
- 在旧Express服务旁创建Nest TypeScript项目，接入配置校验、日志、MySQL和Redis。
- 建立TypeORM Migration和人工初始化SQL。

### 阶段二：用户与认证

- 完成注册、用户名/邮箱登录、刷新、退出和密码修改。
- 完成单设备拒绝策略、安全事件和WebSocket提醒。
- 前端增加登录、注册、退出和安全提醒界面。

### 阶段三：ZIP导入

- 完成安全上传、BullMQ任务、流式解析、进度和幂等导入。
- 完成按日压缩时序数据与日汇总生成。
- 完成原始ZIP保留提示和清理任务。

### 阶段四：业务API迁移

- 依次迁移日期、日汇总、时序、运动、睡眠、体重和用户档案接口。
- 所有Repository查询强制使用当前 `userId`，并增加跨用户隔离测试。
- 保持现有响应兼容，必要变更同步修改Vue客户端。

### 阶段五：删除、运维与切换

- 完成健康数据删除和账号注销。
- 增加健康检查、磁盘告警、导入队列监控、MySQL备份和日志轮转。
- 对比新旧接口结果后切换Nginx，再移除Express和SQLite依赖。

## 12. 验收标准

- 用户可使用用户名或邮箱注册、登录和退出，密码不以明文落盘或记录日志。
- 已有有效会话时，新设备登录被拒绝，旧设备立即收到安全提醒。
- 两个用户的数据、缓存、导入任务和ZIP完全隔离。
- 样例ZIP可在4GB内存机器上完成导入，API进程保持可响应。
- 重复上传同一ZIP不会重复写入数据。
- 单日和多日图表接口与当前前端口径一致。
- 用户可以删除全部健康数据，MySQL、Redis和文件系统无残留业务数据。
- MySQL关闭SSL时可运行，未来开启SSL只需配置证书和环境变量。
- Redis必须通过密码和TLS连接，连接失败不会静默降级为无认证Redis。

## 13. 待确认事项

1. 新设备被拒绝后，合法用户遗失旧设备时，首期是否仅允许管理员解除会话，还是提供“再次输入密码后强制退出旧设备”。
2. 月度ZIP清理的精确规则：每月30日删除全部ZIP，还是只删除上月及更早的ZIP；2月是否在最后一天补跑。
3. 原始ZIP首期保存在云服务器本地磁盘，还是直接接入腾讯云COS。
4. 用户“删除全部数据”是否保留导入历史审计信息，账号注销后安全事件保留多久。
5. 正式域名和Nginx终止TLS方案，用于确定Cookie的Domain、Secure和SameSite策略。

## 14. 实施前需要提供

- MySQL数据库名和应用账号连接配置，通过本地 `.env` 提供。
- Redis主机、端口、用户名、密码和TLS CA配置，通过本地 `.env` 提供。
- 腾讯云服务器部署方式：Docker Compose或宿主机进程管理；建议Docker Compose。
- 上述“待确认事项”的最终选择。

真实密码、JWT密钥和证书私钥不得粘贴到聊天中或提交到Git。
