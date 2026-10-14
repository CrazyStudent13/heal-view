// 导入运动类型映射：把小米 / 华为归档里"同一种运动"的不同写法归一到稳定的 slug。
//
// 归档解析结果里，运动记录同时可能带三样东西：
//   - 数字 sport_type（例如小米的 2 = 健走）
//   - 文字 category（例如 walking / outdoor_walking）
//   - Key 列映射出来的 sportType 字符串
// 训练计划侧只认 slug，匹配时就不必关心数据来自哪个平台。

/**
 * slug 到原始写法的映射表。
 * codes 是归档里出现的数字 sport_type，slugs 是 category / key 列出现的文字写法。
 */
export const SPORT_TYPE_GROUPS = {
  running: {
    codes: [1],
    slugs: ['running', 'indoor_running', 'outdoor_running', 'treadmill_running', 'jogging']
  },
  walking: {
    codes: [2, 22],
    slugs: ['walking', 'indoor_walking', 'outdoor_walking', 'treadmill_walking', 'brisk_walking']
  },
  cycling: {
    codes: [3, 6],
    slugs: ['cycling', 'indoor_cycling', 'outdoor_cycling', 'outdoor_riding', 'indoor_riding', 'biking', 'spinning']
  },
  swimming: {
    codes: [4],
    slugs: ['swimming', 'pool_swimming', 'open_water_swimming']
  },
  hiking: {
    codes: [5, 15],
    slugs: ['hiking', 'outdoor_hiking', 'mountaineering', 'trekking']
  },
  elliptical: {
    codes: [11],
    slugs: ['elliptical', 'elliptical_trainer', 'elliptical_machine', 'cross_trainer']
  },
  rowing: {
    codes: [13],
    slugs: ['rowing', 'rowing_machine', 'indoor_rowing', 'canoeing']
  },
  jump_rope: {
    codes: [10],
    slugs: ['jump_rope', 'rope_skipping', 'skipping', 'jump_ropes']
  },
  stair_climbing: {
    codes: [],
    slugs: ['stair_climbing', 'stair_stepper', 'stepper', 'climbing_stairs', 'stair_machine']
  },
  dancing: {
    codes: [],
    slugs: ['dancing', 'dance', 'aerobics', 'aerobic_dance', 'square_dance']
  }
};

/** 允许在运动项目上配置的导入运动类型 slug。 */
export const SPORT_TYPE_KEYS = Object.freeze(Object.keys(SPORT_TYPE_GROUPS));

const SPORT_TYPE_KEY_SET = new Set(SPORT_TYPE_KEYS);

// 原始写法 → slug 的反查表，数字和文字写法共用一张表。
const RAW_TO_SPORT_TYPE = new Map();
for (const [key, group] of Object.entries(SPORT_TYPE_GROUPS)) {
  for (const code of group.codes) RAW_TO_SPORT_TYPE.set(String(code), key);
  for (const slug of group.slugs) RAW_TO_SPORT_TYPE.set(slug, key);
}

/**
 * 把单个原始写法解析成归一后的 slug。
 * @param {unknown} rawValue 数字 sport_type、category 或 key 列的值
 * @returns {string|null} 归一后的 slug；无法识别时返回 null
 */
export function resolveSportTypeKey(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  const normalized = String(rawValue).trim().toLowerCase();
  if (!normalized) return null;
  if (RAW_TO_SPORT_TYPE.has(normalized)) return RAW_TO_SPORT_TYPE.get(normalized);

  // 归档里出现过带平台前缀或后缀的写法，例如 huawei_rowing_machine。
  for (const [raw, key] of RAW_TO_SPORT_TYPE) {
    if (/^\d+$/.test(raw)) continue;
    if (normalized.includes(raw)) return key;
  }
  return null;
}

/**
 * 收集一条导入运动记录可能对应的全部 slug。
 * 同一条记录的数字类型和文字类型可能指向不同的 slug，所以全部保留。
 * @param {{sport_type?: unknown, category?: unknown, key?: unknown}} record 导入运动记录
 * @returns {string[]} 去重后的 slug 列表
 */
export function collectRecordSportTypeKeys(record) {
  if (!record || typeof record !== 'object') return [];
  const keys = new Set();
  for (const raw of [record.sport_type, record.category, record.key]) {
    const key = resolveSportTypeKey(raw);
    if (key) keys.add(key);
  }
  return [...keys];
}

/**
 * 校验并归一运动项目上配置的导入运动类型。
 * @param {unknown} value 客户端提交的 sportTypes
 * @returns {string[]|null} 归一后的 slug 列表；包含未知取值时返回 null
 */
export function normalizeSportTypes(value) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const keys = [];
  for (const raw of value) {
    const key = resolveSportTypeKey(raw);
    if (!key || !SPORT_TYPE_KEY_SET.has(key)) return null;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/**
 * 判断一条导入运动记录是否属于某个训练项目的自动验证范围。
 * @param {string[]} sportTypes 训练项目配置的 slug
 * @param {object} record 导入运动记录
 * @returns {boolean} 是否匹配
 */
export function recordMatchesSportTypes(sportTypes, record) {
  if (!Array.isArray(sportTypes) || sportTypes.length === 0) return false;
  const configured = new Set(sportTypes);
  return collectRecordSportTypeKeys(record).some((key) => configured.has(key));
}
