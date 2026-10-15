// CI 的 `pnpm test` 入口。这里只做聚合，不要再逐个列举测试文件。
//
// 之前这份清单只列了 10 个文件，而 tests/client 与 tests/server 下共有 26 个测试文件，
// 于是 CI 长期漏跑 16 个文件、约 81 项用例，其中包含整个训练计划域
// （trainingPlanCrud / trainingPlanAdherence / trainingExecution / aerobicMatching /
// planAdherence / trainingPlanValidation …）以及 Element Plus 注册与样式守卫
// （elementRegistration / mobileTooling / planModule）。漏跑是真实发生过问题的：
// Element Plus 改为按需引入时打破了 elementRegistration 的断言，CI 却完全看不到。
//
// 改为直接引入两个子聚合文件：以后新增测试只要挂到子目录的 index 上就会被 CI 跑到，
// 不会再因为忘记更新清单而静默失效。
import './client/index.test.js';
import './server/index.test.js';
