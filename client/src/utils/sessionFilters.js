/**
 * 训练单元列表的复合检索条件。
 *
 * 抽成纯函数是因为两件事都容易写错，而且第二条错了会有真实后果：
 *
 *  1. 归一化：页面上的空字符串对服务端来说应该是"这个条件没给"，不能当成一个空条件发出去。
 *  2. 条件摘要：批量删除的确认弹窗要按"真正发出去的那份条件"生成文案。用户点"删除筛选结果"
 *     之前看到的必须是服务端会执行的那批条件，不能是输入框里还没提交的内容。
 */

export function emptySessionFilters() {
  return { startDate: '', endDate: '', planId: '', status: '', logged: '', search: '' };
}

/** 空值统一转成 undefined：让它从请求里消失，而不是变成 `startDate=`。 */
export function buildSessionFilterRequest(filters = {}) {
  return {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    planId: filters.planId || undefined,
    status: filters.status || undefined,
    // 打卡状态是 'true' / 'false' 两个字符串，'false' 本身是真值，所以不能顺手做布尔化。
    logged: filters.logged || undefined,
    search: (filters.search || '').trim() || undefined
  };
}

/** 是否至少有一个生效的条件。没有条件的"删除筛选结果"等于删除全部，必须被挡住。 */
export function hasSessionFilters(filters = {}) {
  return Object.values(buildSessionFilterRequest(filters)).some((value) => value !== undefined);
}

/**
 * 删除确认弹窗里的条件摘要，顺序固定为日期 → 计划 → 完成状态 → 打卡状态 → 训练内容。
 * @param {object} filters 已生效的检索条件
 * @param {object} options translate 文案函数、planName 计划 id → 名称
 * @returns {string} 用列表分隔符拼起来的条件说明
 */
export function summarizeSessionFilters(filters = {}, { translate, planName = () => '' } = {}) {
  const parts = [];
  const startDate = filters.startDate || '';
  const endDate = filters.endDate || '';
  if (startDate && endDate) {
    parts.push(translate('plans.sessions.conditionDateRange', { start: startDate, end: endDate }));
  } else if (startDate) {
    parts.push(translate('plans.sessions.conditionDateFrom', { start: startDate }));
  } else if (endDate) {
    parts.push(translate('plans.sessions.conditionDateUntil', { end: endDate }));
  }
  if (filters.planId) {
    parts.push(translate('plans.sessions.conditionPlan', { name: planName(filters.planId) || String(filters.planId) }));
  }
  if (filters.status) {
    parts.push(
      translate('plans.sessions.conditionStatus', { status: translate(`plans.manager.statuses.${filters.status}`) })
    );
  }
  if (filters.logged) {
    parts.push(
      translate('plans.sessions.conditionLogged', {
        status: translate(filters.logged === 'true' ? 'plans.sessions.logged' : 'plans.sessions.loggedNo')
      })
    );
  }
  const keyword = (filters.search || '').trim();
  if (keyword) parts.push(translate('plans.sessions.conditionSearch', { keyword }));
  return parts.join(translate('common.listSeparator'));
}
