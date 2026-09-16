import { databaseService } from '../services/database.js';
import { seedTrainingExercises } from '../services/trainingExerciseSeed.js';

try {
  await databaseService.initialize();
  const result = seedTrainingExercises();
  console.log(`运动项目初始化完成：新增 ${result.created} 项，更新 ${result.updated} 项，共 ${result.total} 项。`);
} catch (error) {
  console.error(`运动项目初始化失败：${error.message}`);
  process.exitCode = 1;
} finally {
  databaseService.close();
}
