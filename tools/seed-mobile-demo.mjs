// 一次性演示数据播种脚本：为移动端「今日训练」页面准备一个可直接试用的临时数据库。
// 用法：DB_PATH=<临时库路径> node tools/seed-mobile-demo.mjs
import fs from 'node:fs';
import { config } from '../server/src/config/index.js';
import { databaseService } from '../server/src/services/database.js';
import { seedTrainingExercises } from '../server/src/services/trainingExerciseSeed.js';
import {
  createTrainingPhase,
  createTrainingPlan,
  createTrainingSession
} from '../server/src/controllers/trainingPlanController.js';
import { saveTrainingSessionExecution } from '../server/src/controllers/trainingExecutionController.js';

function rec() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send() {
      return this;
    }
  };
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(base, days) {
  const date = new Date(`${base}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return ymd(date);
}

function queryJson(sql, params) {
  const rows = databaseService.query(sql, params);
  return rows.length === 0 ? [] : rows[0].values;
}

if (fs.existsSync(config.dbPath)) {
  console.log('Removing existing demo database:', config.dbPath);
  fs.rmSync(config.dbPath, { force: true });
}

await databaseService.initialize();
console.log('Exercises seeded:', seedTrainingExercises());

const exerciseIdByName = new Map(
  queryJson('SELECT id, name FROM training_exercises').map(([id, name]) => [name, Number(id)])
);

const today = ymd(new Date());
const startDate = shiftDays(today, -35);
const endDate = shiftDays(today, 28);

const plan = rec();
createTrainingPlan(
  {
    body: {
      name: '2026 秋季减脂与力量',
      goal: '每周 3 次力量训练配合 2 次有氧，稳步降低体脂并保住肌肉量',
      startDate,
      endDate,
      status: 'active'
    }
  },
  plan
);
const planId = plan.body.id;

const phase = rec();
createTrainingPhase(
  {
    params: { planId },
    body: {
      name: '基础适应期',
      startDate,
      endDate: shiftDays(today, 10),
      description: '以建立训练习惯为主，重量宁轻勿重，每个动作先做满目标组数。'
    }
  },
  phase
);

const strengthTemplate = [
  { name: '肩膊推举器', targets: { weight: 30, sets: 3 } },
  { name: '高拉背器', targets: { weight: 35, sets: 3 } },
  { name: '大腿内外侧肌训练器', targets: { weight: 25, sets: 3 } },
  { name: '平板支撑', targets: { sets: 3, durationSeconds: 60 } }
];
// 有氧日只用自动验证项目（室内步行由手表同步确认），
// 用来覆盖「这天不需要手动记录」的提示分支。
const cardioTemplate = [{ name: '室内步行', targets: { duration: 40, distance: 4 } }];

function toItems(template) {
  return template.map((entry) => ({ exerciseId: exerciseIdByName.get(entry.name), targets: entry.targets }));
}

// 隔天力量、隔天有氧交替；今天固定安排一次力量训练，方便直接试用确认流程。
const created = [];
for (let offset = -35; offset <= 28; offset += 1) {
  // 加 70 保证偏移为正，避免 Math.abs 在跨越今天时把奇偶翻转。
  const isStrength = (offset + 70) % 2 === 0;
  const date = shiftDays(today, offset);
  const session = rec();
  createTrainingSession(
    {
      params: { planId },
      body: {
        scheduledDate: date,
        name: isStrength ? '力量训练日' : '有氧训练日',
        notes: isStrength ? '注意动作全程控制，最后两组接近力竭即可。' : '',
        items: toItems(isStrength ? strengthTemplate : cardioTemplate)
      }
    },
    session
  );
  if (session.statusCode !== 201) {
    console.error(
      'Failed to create session for',
      date,
      isStrength ? 'STRENGTH' : 'CARDIO',
      session.statusCode,
      session.body
    );
    continue;
  }
  created.push({ id: session.body.id, scheduledDate: date, isStrength });
}

console.log('Sessions created:', created.length);

// 只加载需要人工确认的项目：自动验证项目不参与手动记录，
// 全自动的训练单元也就没有可提交的内容（服务端会返回 409）。
function loadSessionItems(sessionId) {
  return queryJson(
    `SELECT item.id, item.targets, exercise.metrics
     FROM training_session_items item
     JOIN training_exercises exercise ON exercise.id = item.exercise_id
     WHERE item.session_id = ? AND item.verification_mode = 'manual'
     ORDER BY item.position, item.id`,
    [sessionId]
  ).map(([id, targets, metrics]) => ({
    sessionItemId: Number(id),
    targets: JSON.parse(targets),
    metrics: JSON.parse(metrics)
  }));
}

// 为今天之前的训练单元补上实际记录，让移动端能显示「上次成绩」并预填重量。
let logged = 0;
for (const session of created) {
  if (session.scheduledDate >= today) continue;
  const items = loadSessionItems(session.id);
  if (items.length === 0) continue;

  const daysAgo = Math.round(
    (new Date(`${today}T00:00:00Z`) - new Date(`${session.scheduledDate}T00:00:00Z`)) / 86400000
  );
  // 越早的记录重量越低，模拟逐步加重，也让「上次成绩」预填看起来有变化。
  const weightBonus = Math.max(0, 21 - daysAgo) * 0.5;
  // 三天前那次故意留一个跳过项，用来验证部分完成和跳过原因。
  const skippedIndex = session.scheduledDate === shiftDays(today, -3) ? 1 : -1;

  const body = {
    status: 'completed',
    sessionFeel: daysAgo <= 2 ? 'hard' : 'normal',
    discomfort: '',
    items: items.map((item, index) => {
      if (index === skippedIndex) {
        return { sessionItemId: item.sessionItemId, status: 'skipped', skipReason: 'equipment_busy' };
      }
      const actuals = {};
      for (const [metric, value] of Object.entries(item.targets || {})) {
        if (metric === 'weight') {
          actuals.weight = Number(value) + weightBonus;
          continue;
        }
        if (metric === 'duration') {
          // duration 是分钟；动作若支持 durationSeconds 就换算成秒记录，否则原样记录分钟。
          actuals[item.metrics.includes('durationSeconds') ? 'durationSeconds' : 'duration'] = item.metrics.includes(
            'durationSeconds'
          )
            ? Math.round(Number(value) * 60)
            : Number(value);
          continue;
        }
        actuals[metric] = value;
      }
      return { sessionItemId: item.sessionItemId, status: 'done', actuals };
    })
  };
  if (skippedIndex >= 0) body.status = 'partial';

  const saved = rec();
  saveTrainingSessionExecution({ params: { id: session.id }, body }, saved);
  if (saved.statusCode === 200) logged += 1;
  else console.error('Failed to log session', session.id, saved.statusCode, saved.body);
}

console.log('Sessions logged:', logged);
console.log('Today:', today);
console.log('Demo database ready:', config.dbPath);
databaseService.close();
