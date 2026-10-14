import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

/**
 * 计划模块被拆成「页面 + 组件 + composable + 样式片段」之后，有一类错误构建和 lint 都不报：
 * 漏一个图标导入、少一个事件监听、样式片段拆错归属、composable 少返回一个状态。
 * 这里跑一遍 check-plan-module 的静态部分，把它们变成测试失败。
 *
 * 完整检查还包含 SSR 冒烟（渲染页面、抽屉、页签和四个弹窗，把 Vue 运行时警告当失败），
 * 需要启动 vite，所以放在手动命令里：`pnpm check:plan-module`。
 */
test('计划模块的静态结构自检通过', () => {
  try {
    execFileSync(process.execPath, ['client/scripts/check-plan-module.mjs', '--static'], {
      cwd: root,
      encoding: 'utf8'
    });
  } catch (error) {
    assert.fail(`check-plan-module --static 未通过：\n${error.stdout || ''}${error.stderr || ''}`);
  }
});
