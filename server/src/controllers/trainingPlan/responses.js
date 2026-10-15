// 控制器共用的响应形态。
// 409 冲突的 code 是前端分支依赖的契约（例如 PLAN_END_DATE_CANNOT_SHRINK），不要改。

export function respondConflict(res, code, message) {
  return res.status(409).json({ code, message });
}
