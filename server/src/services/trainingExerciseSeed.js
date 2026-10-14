import { defaultTrainingExercises, legacyTrainingExerciseNames } from '../data/defaultTrainingExercises.js';
import { databaseService } from './database.js';

function findExerciseId(service, name) {
  const rows = service.query('SELECT id FROM training_exercises WHERE name = ? ORDER BY id ASC LIMIT 1', [name]);
  return rows.length > 0 ? Number(rows[0].values[0][0]) : null;
}

/**
 * 早期目录把正反手、内收外展压在同一行，现在拆成了变体。
 * 旧行已经被既有计划和训练记录用 exercise_id 引用，所以这里按 id 原地改名，
 * 而不是新建一行把历史留在没人看的旧项目上。
 * 只有当目标名已经存在时才不改名（避免出现同名两行），改用停用旧行保底。
 */
function renameLegacyExercises(service, now) {
  const db = service.getDb();
  let renamed = 0;
  let retired = 0;

  for (const [legacyName, replacementName] of Object.entries(legacyTrainingExerciseNames)) {
    const legacyId = findExerciseId(service, legacyName);
    if (legacyId === null) continue;

    const replacementId = findExerciseId(service, replacementName);
    if (replacementId !== null) {
      if (replacementId !== legacyId) {
        // 用户自己建过同名项目，或者上一次初始化只完成了一半：旧行停用但保留，
        // 历史计划继续读得到它，只是不再出现在可选项目里。
        db.run('UPDATE training_exercises SET enabled = 0, updated_at = ? WHERE id = ?', [now, legacyId]);
        retired += 1;
      }
      continue;
    }

    db.run('UPDATE training_exercises SET name = ?, updated_at = ? WHERE id = ?', [replacementName, now, legacyId]);
    renamed += 1;
  }

  return { renamed, retired };
}

export function seedTrainingExercises(service = databaseService) {
  const db = service.getDb();
  const now = Date.now();
  let created = 0;
  let updated = 0;

  db.run('BEGIN IMMEDIATE');
  let legacy = { renamed: 0, retired: 0 };
  try {
    // 改名必须排在写入之前：旧行改名后会被下面的更新分支原地接住，不会再插入一份新的。
    legacy = renameLegacyExercises(service, now);

    for (const exercise of defaultTrainingExercises) {
      const existingId = findExerciseId(service, exercise.name);
      if (existingId !== null) {
        // 导入运动类型属于用户可改的配置：只在还没有值时补默认值，不覆盖用户的选择。
        db.run(
          `UPDATE training_exercises
           SET icon = ?, category = ?, scene = ?, verification_mode = ?, equipment_mode = ?, equipment = ?, metrics = ?, purpose = ?,
               sport_types = CASE
                 WHEN sport_types IS NULL OR sport_types = '' OR sport_types = '[]' THEN ?
                 ELSE sport_types
               END,
               updated_at = ?
           WHERE id = ?`,
          [
            exercise.icon,
            exercise.category,
            exercise.scene,
            exercise.verificationMode,
            exercise.equipmentMode,
            exercise.equipment,
            JSON.stringify(exercise.metrics),
            exercise.purpose,
            JSON.stringify(exercise.sportTypes || []),
            now,
            existingId
          ]
        );
        updated += 1;
      } else {
        db.run(
          `INSERT INTO training_exercises
            (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, sport_types, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            exercise.name,
            exercise.icon,
            exercise.category,
            exercise.scene,
            exercise.verificationMode,
            exercise.equipmentMode,
            exercise.equipment,
            JSON.stringify(exercise.metrics),
            exercise.purpose,
            JSON.stringify(exercise.sportTypes || []),
            now,
            now
          ]
        );
        created += 1;
      }
    }
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  return { created, updated, renamed: legacy.renamed, retired: legacy.retired, total: defaultTrainingExercises.length };
}
