-- =============================================================================
-- Heal View MySQL 数据库初始化脚本
-- 适用版本：MySQL 8.4.x
-- =============================================================================
-- 使用说明：
--   1. 本脚本仅用于首次创建数据库和基础表。
--   2. 默认数据库名为 heal_view，如需修改，请同时修改 CREATE DATABASE 和 USE。
--   3. 后续字段或索引变更必须通过版本化 Migration 完成，不要重复修改并执行本文件。
--   4. 应用账号请在腾讯云控制台或密钥管理服务中创建，不要把真实密码写入仓库。
--   5. 所有 DATETIME 字段按 UTC 写入，local_date 和 user_profiles.timezone 用于本地日期换算。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. 数据库与连接会话设置
-- -----------------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS `heal_view`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `heal_view`;

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- 1. 用户账号表
--    保存登录凭据和账号状态，不存放具体健康数据。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_accounts` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户账号主键',
  `username`          VARCHAR(50) NOT NULL COMMENT '登录用户名，全局唯一',
  `email`             VARCHAR(254) NOT NULL COMMENT '登录邮箱，全局唯一',
  `password_hash`     VARCHAR(255) NOT NULL COMMENT 'Argon2id 密码哈希',
  `status`            VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '账号状态：active/disabled/deleted',
  `email_verified_at` DATETIME(3) NULL COMMENT '邮箱验证时间，首期暂不使用',
  `last_login_at`     DATETIME(3) NULL COMMENT '最近一次成功登录时间',
  `created_at`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',

  -- 主键、唯一约束和状态检查
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_accounts_username` (`username`),
  UNIQUE KEY `uk_user_accounts_email` (`email`),
  CONSTRAINT `chk_user_accounts_status`
    CHECK (`status` IN ('active', 'disabled', 'deleted'))
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '用户账号表';

-- -----------------------------------------------------------------------------
-- 2. 用户档案表
--    与用户账号一对一，保存展示和健康计算需要的基础信息。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_profiles` (
  `user_id`             BIGINT UNSIGNED NOT NULL COMMENT '关联的用户账号 ID，同时作为主键',
  `display_name`        VARCHAR(80) NULL COMMENT '用户展示名称',
  `sex`                 VARCHAR(20) NULL COMMENT '性别：male/female/other/undisclosed',
  `birth_date`          DATE NULL COMMENT '出生日期',
  `height_cm`           DECIMAL(5, 2) NULL COMMENT '身高，单位 cm',
  `initial_weight_kg`   DECIMAL(6, 2) NULL COMMENT '初始体重，单位 kg',
  `target_weight_kg`    DECIMAL(6, 2) NULL COMMENT '目标体重，单位 kg',
  `daily_calorie_goal`  SMALLINT UNSIGNED NULL COMMENT '每日运动热量目标，单位 kcal',
  `vo2_max`             DECIMAL(5, 2) NULL COMMENT '最大摄氧量',
  `timezone`            VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai' COMMENT '用户所在 IANA 时区',
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',

  -- 主键、外键和数据范围检查
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_profiles_account`
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chk_user_profiles_sex`
    CHECK (`sex` IS NULL OR `sex` IN ('male', 'female', 'other', 'undisclosed')),
  CONSTRAINT `chk_user_profiles_height`
    CHECK (`height_cm` IS NULL OR (`height_cm` > 0 AND `height_cm` <= 300)),
  CONSTRAINT `chk_user_profiles_initial_weight`
    CHECK (`initial_weight_kg` IS NULL OR `initial_weight_kg` > 0),
  CONSTRAINT `chk_user_profiles_target_weight`
    CHECK (`target_weight_kg` IS NULL OR `target_weight_kg` > 0)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '用户健康档案表';

-- -----------------------------------------------------------------------------
-- 3. 用户会话表
--    每个 user_id 仅允许一条会话，用数据库唯一约束保证单设备登录。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '会话 UUID',
  `user_id`            BIGINT UNSIGNED NOT NULL COMMENT '关联的用户账号 ID',
  `refresh_token_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Refresh Token 的 SHA-256 哈希',
  `ip_address`         VARCHAR(45) NULL COMMENT '登录 IP，兼容 IPv4 和 IPv6',
  `user_agent`         VARCHAR(512) NULL COMMENT '登录设备 User-Agent',
  `created_at`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '会话创建时间',
  `last_seen_at`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '最近活动时间',
  `expires_at`         DATETIME(3) NOT NULL COMMENT '会话过期时间',
  `revoked_at`         DATETIME(3) NULL COMMENT '会话撤销时间，NULL 表示未撤销',

  -- 主键、单设备唯一约束和过期时间索引
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_sessions_user` (`user_id`),
  KEY `idx_user_sessions_expires_at` (`expires_at`),
  CONSTRAINT `fk_user_sessions_account`
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chk_user_sessions_expiry`
    CHECK (`expires_at` > `created_at`)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '用户单设备登录会话表';

-- -----------------------------------------------------------------------------
-- 4. 数据导入任务表
--    保存 ZIP 文件元数据、解析进度、失败信息和原始文件清理时间。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `import_jobs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '导入任务 UUID',
  `user_id`                 BIGINT UNSIGNED NOT NULL COMMENT '发起导入的用户账号 ID',
  `original_file_name`      VARCHAR(255) NOT NULL COMMENT '用户上传时的原始文件名',
  `storage_path`            VARCHAR(1024) NOT NULL COMMENT '原始 ZIP 在服务器或对象存储中的位置',
  `file_sha256`             CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'ZIP 文件 SHA-256，用于幂等校验',
  `file_size_bytes`         BIGINT UNSIGNED NOT NULL COMMENT 'ZIP 压缩文件大小，单位 byte',
  `uncompressed_size_bytes` BIGINT UNSIGNED NULL COMMENT 'ZIP 解压后的总大小，单位 byte',
  `entry_count`             SMALLINT UNSIGNED NULL COMMENT 'ZIP 内文件条目数量',
  `status`                  VARCHAR(20) NOT NULL DEFAULT 'uploaded' COMMENT '任务状态：uploaded/queued/processing/completed/failed/cancelled',
  `progress_percent`        TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '处理进度，范围 0～100',
  `total_rows`              BIGINT UNSIGNED NULL COMMENT '待处理 CSV 总行数',
  `processed_rows`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '成功处理行数',
  `failed_rows`             BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '处理失败行数',
  `error_code`              VARCHAR(64) NULL COMMENT '机器可读错误码',
  `error_message`           TEXT NULL COMMENT '开发和用户可读的错误摘要',
  `queued_at`               DATETIME(3) NULL COMMENT '进入 Redis 队列时间',
  `started_at`              DATETIME(3) NULL COMMENT 'Worker 开始处理时间',
  `finished_at`             DATETIME(3) NULL COMMENT '任务完成或失败时间',
  `scheduled_delete_at`     DATETIME(3) NULL COMMENT '原始 ZIP 计划删除时间',
  `zip_deleted_at`          DATETIME(3) NULL COMMENT '原始 ZIP 实际删除时间',
  `created_at`              DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',

  -- 主键、幂等约束和任务扫描索引
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_import_jobs_user_hash` (`user_id`, `file_sha256`),
  KEY `idx_import_jobs_user_created` (`user_id`, `created_at`),
  KEY `idx_import_jobs_status_created` (`status`, `created_at`),
  KEY `idx_import_jobs_scheduled_delete` (`scheduled_delete_at`, `zip_deleted_at`),
  CONSTRAINT `fk_import_jobs_account`
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chk_import_jobs_status`
    CHECK (`status` IN ('uploaded', 'queued', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT `chk_import_jobs_progress`
    CHECK (`progress_percent` <= 100)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '小米健康 ZIP 数据导入任务表';

-- -----------------------------------------------------------------------------
-- 5. 健康指标日内序列表
--    每个用户、日期、指标仅一行；统计字段用于汇总接口，payload 用于日内图表。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `health_metric_series` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '健康指标序列主键',
  `user_id`       BIGINT UNSIGNED NOT NULL COMMENT '关联的用户账号 ID',
  `import_job_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '来源导入任务 UUID',
  `local_date`    DATE NOT NULL COMMENT '按用户时区计算的数据日期',
  `metric_type`   VARCHAR(32) NOT NULL COMMENT '指标类型，如 heart_rate/steps/stress/calories/spo2/weight',
  `sample_count`  INT UNSIGNED NOT NULL COMMENT '压缩数据块中的采样点数量',
  `min_value`     DECIMAL(18, 4) NULL COMMENT '当日最小值，不适用时为 NULL',
  `max_value`     DECIMAL(18, 4) NULL COMMENT '当日最大值，不适用时为 NULL',
  `avg_value`     DECIMAL(18, 4) NULL COMMENT '当日平均值，不适用时为 NULL',
  `sum_value`     DECIMAL(20, 4) NULL COMMENT '当日累计值，不适用时为 NULL',
  `payload`       MEDIUMBLOB NOT NULL COMMENT '紧凑数组序列的压缩二进制数据',
  `payload_compression` VARCHAR(16) NOT NULL DEFAULT 'gzip' COMMENT 'payload 压缩方式：gzip/none',
  `payload_version`     SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'payload 数据格式版本',
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',

  -- 主键、日指标幂等约束和查询索引
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_health_metric_user_date_type` (`user_id`, `local_date`, `metric_type`),
  KEY `idx_health_metric_user_type_date` (`user_id`, `metric_type`, `local_date`),
  KEY `idx_health_metric_import_job` (`import_job_id`),
  CONSTRAINT `fk_health_metric_account`
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_health_metric_import_job`
    FOREIGN KEY (`import_job_id`) REFERENCES `import_jobs` (`id`)
    ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `chk_health_metric_sample_count`
    CHECK (`sample_count` > 0),
  CONSTRAINT `chk_health_metric_compression`
    CHECK (`payload_compression` IN ('gzip', 'none'))
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '用户每日健康指标压缩序列表';

-- -----------------------------------------------------------------------------
-- 6. 睡眠会话表
--    保存睡眠汇总字段；stage_payload 保存可还原时间轴的阶段分段。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sleep_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '睡眠会话主键',
  `user_id`       BIGINT UNSIGNED NOT NULL COMMENT '关联的用户账号 ID',
  `import_job_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '来源导入任务 UUID',
  `external_id`   VARCHAR(128) NULL COMMENT '小米数据中的外部睡眠记录 ID',
  `local_date`    DATE NOT NULL COMMENT '睡眠归属日期，按用户时区计算',
  `bedtime_at`    DATETIME(3) NOT NULL COMMENT '入睡时间，按 UTC 保存',
  `wake_up_at`    DATETIME(3) NOT NULL COMMENT '醒来时间，按 UTC 保存',
  `total_sleep_minutes` SMALLINT UNSIGNED NOT NULL COMMENT '实际睡眠总分钟数，不含清醒阶段',
  `deep_sleep_minutes`  SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '深睡分钟数',
  `light_sleep_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '浅睡分钟数',
  `rem_sleep_minutes`   SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '快速眼动分钟数',
  `awake_minutes`       SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '睡眠期间清醒分钟数',
  `avg_heart_rate`      DECIMAL(6, 2) NULL COMMENT '睡眠期间平均心率',
  `stage_payload`       MEDIUMBLOB NULL COMMENT '睡眠阶段时间轴的压缩二进制数据',
  `payload_compression` VARCHAR(16) NOT NULL DEFAULT 'gzip' COMMENT 'stage_payload 压缩方式：gzip/none',
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',

  -- 主键、睡眠区间幂等约束和查询索引
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sleep_sessions_user_period` (`user_id`, `bedtime_at`, `wake_up_at`),
  KEY `idx_sleep_sessions_user_date` (`user_id`, `local_date`),
  KEY `idx_sleep_sessions_import_job` (`import_job_id`),
  CONSTRAINT `fk_sleep_sessions_account`
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_sleep_sessions_import_job`
    FOREIGN KEY (`import_job_id`) REFERENCES `import_jobs` (`id`)
    ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `chk_sleep_sessions_period`
    CHECK (`wake_up_at` > `bedtime_at`),
  CONSTRAINT `chk_sleep_sessions_compression`
    CHECK (`payload_compression` IN ('gzip', 'none'))
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '用户睡眠会话与阶段数据表';

-- -----------------------------------------------------------------------------
-- 7. 运动记录表
--    常用字段结构化保存，非通用详情保存在 details JSON 中。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sport_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '运动记录主键',
  `user_id`       BIGINT UNSIGNED NOT NULL COMMENT '关联的用户账号 ID',
  `import_job_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '来源导入任务 UUID',
  `external_id`   VARCHAR(128) NULL COMMENT '小米数据中的外部运动记录 ID',
  `sport_type`    VARCHAR(64) NOT NULL COMMENT '运动类型，如 running/walking/cycling',
  `category`      VARCHAR(64) NULL COMMENT '原始运动分类',
  `started_at`    DATETIME(3) NOT NULL COMMENT '运动开始时间，按 UTC 保存',
  `ended_at`      DATETIME(3) NULL COMMENT '运动结束时间，按 UTC 保存',
  `duration_seconds` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '运动时长，单位秒',
  `distance_meters`  DECIMAL(14, 2) NULL COMMENT '运动距离，单位米',
  `calories`         DECIMAL(12, 2) NULL COMMENT '运动消耗，单位 kcal',
  `steps`            INT UNSIGNED NULL COMMENT '运动步数',
  `avg_heart_rate`   DECIMAL(6, 2) NULL COMMENT '运动平均心率',
  `max_heart_rate`   SMALLINT UNSIGNED NULL COMMENT '运动最高心率',
  `details`          JSON NULL COMMENT '配速、分段、轨迹摘要等扩展数据',
  `created_at`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',

  -- 主键、外部记录幂等约束和查询索引
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sport_records_user_external` (`user_id`, `external_id`),
  KEY `idx_sport_records_user_started` (`user_id`, `started_at`),
  KEY `idx_sport_records_user_type_started` (`user_id`, `sport_type`, `started_at`),
  KEY `idx_sport_records_import_job` (`import_job_id`),
  CONSTRAINT `fk_sport_records_account`
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_sport_records_import_job`
    FOREIGN KEY (`import_job_id`) REFERENCES `import_jobs` (`id`)
    ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `chk_sport_records_period`
    CHECK (`ended_at` IS NULL OR `ended_at` >= `started_at`)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '用户运动记录表';

-- =============================================================================
-- 初始化脚本结束
-- 共创建 7 张业务表：
--   user_accounts、user_profiles、user_sessions、import_jobs、
--   health_metric_series、sleep_sessions、sport_records。
-- =============================================================================
