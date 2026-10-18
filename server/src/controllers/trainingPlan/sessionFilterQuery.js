// 训练单元的复合检索条件，以及"按条件取出候选行 + 派生完成状态"的公共查询层。
//
// 这份条件原来长在 sessionController 里。训练项目级的批量删除要用完全相同的作用范围
// （"这个时间段里的哪些训练单元"），所以抽成独立模块，避免两处各写一份筛选口径后互相漂移：
// 列表、训练单元批量删除、训练项目批量删除都从这里取条件。
import { loadNormalizedSportRecords, todayDateKey } from '../../services/sportRecordRepository.js';
import { queryRows } from './queryHelpers.js';
import { completionStatusOf, deriveStatusForSession, evaluateAutoMatches } from './sessionStatus.js';
import { isValidDate } from './validation.js';

// 全局训练单元页的筛选项：只保留"练完没有"这一类结果，待开始是时间位置、无数据和无法验证是
// 数据问题，都不参与筛选。未完成不是存量状态，是过期且推导结果仍为 planned（见下面的口径）。
export const SESSION_COMPLETION_STATUSES = new Set(['achieved', 'partial', 'skipped', 'missed']);

/**
 * 打卡状态筛选：'true' 只看留过执行记录的单元，'false' 只看没留过的。
 * 执行记录在 training_session_logs 里是一行，所以这个条件能直接在 SQL 里筛，
 * 不需要像完成状态那样读取时推导。布尔和字符串两种写法都收，统一归一成字符串。
 */
const SESSION_LOGGED_VALUES = new Map([
  [true, 'true'],
  [false, 'false'],
  ['true', 'true'],
  ['false', 'false']
]);

/** 关键词检索的长度上限，和列表页输入框的 maxlength 一致；超长截断而不是报错。 */
const SESSION_SEARCH_MAX_LENGTH = 60;

/**
 * 列表每一行的投影。列表和批量删除共用同一份，所以"筛选结果"和"被删掉的行"是同一批。
 * exercises 里带上项目 id 和"这条项目有没有打卡记录"，训练单元列表的展开行直接用它们。
 */
const SESSION_LIST_SELECT = `SELECT s.*, p.name AS plan_name,
    log.id AS execution_id,
    log.status AS execution_status,
    log.source AS execution_source,
    log.completed_at AS execution_completed_at,
    log.session_feel AS execution_session_feel,
    log.discomfort AS execution_discomfort,
    log.note AS execution_note,
    (SELECT COUNT(*) FROM training_session_items item_count WHERE item_count.session_id = s.id) AS item_count,
    (SELECT COUNT(*) FROM training_session_log_items logged_item
      JOIN training_session_logs logged_log ON logged_log.id = logged_item.session_log_id
      WHERE logged_log.session_id = s.id) AS logged_item_count,
    (SELECT COALESCE(json_group_array(json_object(
        'id', listed.id,
        'position', listed.position,
        'name', listed.name,
        'targets', json(listed.targets),
        'logged', listed.logged_count > 0)), '[]')
      FROM (SELECT item.id AS id, item.position AS position, exercise.name AS name,
              item.targets AS targets,
              (SELECT COUNT(*) FROM training_session_log_items log_item
                WHERE log_item.session_item_id = item.id) AS logged_count
        FROM training_session_items item
        JOIN training_exercises exercise ON exercise.id = item.exercise_id
        WHERE item.session_id = s.id
        ORDER BY item.position, item.id) AS listed) AS exercises
   FROM training_sessions s
   JOIN training_plans p ON p.id = s.plan_id
   LEFT JOIN training_session_logs log ON log.session_id = s.id`;

const SESSION_LIST_ORDER = (sort) => {
  // 只认 asc，其余（含缺省、非法值）都按原来的时间倒序。
  const direction = sort === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY s.scheduled_date ${direction}, s.sequence ASC, s.id ${direction}`;
};

/** 把条件片段拼成 WHERE 子句；调用方可能要在此基础上再叠自己的条件（例如"某个训练项目"）。 */
export function toWhereClause(conditions) {
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

/**
 * 复合检索条件：日期区间、所属计划、完成状态、打卡状态、训练内容关键词，五者之间是 AND。
 *
 * 批量删除会按同样的条件重新求交，而不是接收客户端传来的行 id 列表，所以"删掉筛选结果"
 * 不会和分页看到的行数对不上。
 *
 * @param {object} query 查询条件（列表来自 req.query，删除来自请求体的 filter）
 * @returns {{conditions: Array<string>, whereClause: string, params: Array<*>, status: string,
 *   logged: string, hasCondition: boolean}} conditions 供调用方继续叠加条件
 */
export function buildSessionFilter(query = {}) {
  const conditions = [];
  const params = [];
  if (isValidDate(query.startDate)) {
    conditions.push('s.scheduled_date >= ?');
    params.push(query.startDate);
  }
  if (isValidDate(query.endDate)) {
    conditions.push('s.scheduled_date <= ?');
    params.push(query.endDate);
  }
  if (Number.isInteger(Number(query.planId)) && Number(query.planId) > 0) {
    conditions.push('p.id = ?');
    params.push(Number(query.planId));
  }
  const keyword = normalizeSessionKeyword(query.search);
  if (keyword) {
    const pattern = `%${escapeLikePattern(keyword)}%`;
    // 关键词只搜"训练内容"，也就是这个单元里的训练项目名：加错单元时最直接的线索就是
    // "这天的项目配错了"。单元名称和备注是自由文本，混进来会让这个条件的结果不可预期。
    conditions.push(`EXISTS (SELECT 1 FROM training_session_items keyword_item
        JOIN training_exercises keyword_exercise ON keyword_exercise.id = keyword_item.exercise_id
        WHERE keyword_item.session_id = s.id AND keyword_exercise.name LIKE ? ESCAPE '\\')`);
    params.push(pattern);
  }
  const status = SESSION_COMPLETION_STATUSES.has(query.status) ? query.status : '';
  const logged = normalizeLoggedFilter(query.logged);
  if (logged) {
    // 用 EXISTS 而不是列表里那个 log 别名：同一份 whereClause 还会被项目行查询复用，
    // 那边没有 join 执行记录表，写成别名会直接报 "no such column: log.id"。
    conditions.push(
      logged === 'true'
        ? 'EXISTS (SELECT 1 FROM training_session_logs logged_session WHERE logged_session.session_id = s.id)'
        : 'NOT EXISTS (SELECT 1 FROM training_session_logs logged_session WHERE logged_session.session_id = s.id)'
    );
  }
  return {
    conditions,
    whereClause: toWhereClause(conditions),
    params,
    status,
    logged,
    // 完成状态是读取时推导的，SQL 里筛不出来，但它同样是一个生效的条件。
    hasCondition: conditions.length > 0 || Boolean(status)
  };
}

export function normalizeLoggedFilter(value) {
  return SESSION_LOGGED_VALUES.get(value) || '';
}

function normalizeSessionKeyword(value) {
  return typeof value === 'string' ? value.trim().slice(0, SESSION_SEARCH_MAX_LENGTH) : '';
}

/** 关键词里的 % 和 _ 是 LIKE 通配符，用户输入要当字面量处理。 */
function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * 取出筛选后的全部行（不分页）并派生每行的完成状态。
 * 状态过滤放在这里而不是 SQL 里，和列表、计划详情、训练日历保持同一个口径。
 * 训练项目级的批量删除也用它决定作用范围，所以两边看到的是同一批训练单元。
 */
export function selectSessionMatches(filter) {
  const built = buildSessionFilter(filter);
  const rows = queryRows(
    `${SESSION_LIST_SELECT} ${built.whereClause} ${SESSION_LIST_ORDER(filter?.sort)}`,
    built.params
  );
  const statuses = deriveSessionListStatuses(rows, todayDateKey(), built.whereClause, built.params);
  const matched = built.status ? rows.filter((row) => statuses.get(Number(row.id)) === built.status) : rows;
  return { rows: matched, statuses, status: built.status, hasCondition: built.hasCondition };
}

/**
 * 批量推导训练单元列表里每一行的完成状态。
 * 有氧匹配依赖导入的运动记录，只能读取时算；项目行用同一套筛选条件和训练单元一起取出，
 * 避免按 id 列表拼一条可能超过 SQLite 参数上限的 IN 查询。
 * @param {Array<object>} sessionRows 候选训练单元行
 * @param {string} today 今天的日期
 * @param {string} whereClause 列表的复合筛选条件（引用 s.scheduled_date、p.id 和训练项目名）
 * @param {Array<*>} params whereClause 的参数
 * @returns {Map<number, string>} 训练单元 id → 展示状态（含未完成）
 */
function deriveSessionListStatuses(sessionRows, today, whereClause, params) {
  const statuses = new Map();
  if (sessionRows.length === 0) return statuses;
  const itemRows = queryRows(
    `SELECT i.id, i.session_id, i.verification_mode, i.targets,
       s.scheduled_date AS scheduled_date,
       e.sport_types AS exercise_sport_types,
       (SELECT COUNT(*) FROM training_session_log_items item_log
          JOIN training_session_logs item_log_head ON item_log_head.id = item_log.session_log_id
          WHERE item_log.session_item_id = i.id) AS item_log_count
     FROM training_session_items i
     JOIN training_exercises e ON e.id = i.exercise_id
     JOIN training_sessions s ON s.id = i.session_id
     JOIN training_plans p ON p.id = s.plan_id
     ${whereClause}`,
    params
  );
  const dateKeys = sessionRows
    .map((row) => row.scheduled_date)
    .filter(Boolean)
    .sort();
  const records = loadNormalizedSportRecords(dateKeys[0], dateKeys.at(-1));
  const matches = evaluateAutoMatches(itemRows, records, today);
  const itemsBySession = Map.groupBy(itemRows, (row) => Number(row.session_id));
  for (const session of sessionRows) {
    const { status } = deriveStatusForSession(session, itemsBySession.get(Number(session.id)) || [], matches, today);
    statuses.set(Number(session.id), completionStatusOf(status, session.scheduled_date, today));
  }
  return statuses;
}

/** 批量删除的筛选条件校验：删除是破坏性操作，认不出的条件直接报错，不静默忽略。 */
export function validateSessionDeleteFilter(filter) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    return { errors: { filter: 'Filter must be an object' } };
  }
  const errors = {};
  if (filter.startDate != null && !isValidDate(filter.startDate)) errors.startDate = 'Invalid start date';
  if (filter.endDate != null && !isValidDate(filter.endDate)) errors.endDate = 'Invalid end date';
  if (filter.planId != null && !(Number.isInteger(Number(filter.planId)) && Number(filter.planId) > 0)) {
    errors.planId = 'Invalid plan id';
  }
  if (filter.status != null && !SESSION_COMPLETION_STATUSES.has(filter.status)) {
    errors.status = 'Invalid completion status';
  }
  if (filter.logged != null && !normalizeLoggedFilter(filter.logged)) {
    errors.logged = 'Invalid check-in state';
  }
  if (filter.search != null && typeof filter.search !== 'string') errors.search = 'Invalid search keyword';
  if (Object.keys(errors).length > 0) return { errors };
  return {
    value: {
      startDate: filter.startDate,
      endDate: filter.endDate,
      planId: filter.planId,
      status: filter.status,
      logged: filter.logged,
      search: filter.search
    }
  };
}
