import { defaultTrainingExercises } from '../data/defaultTrainingExercises.js';
import { databaseService } from './database.js';

export function seedTrainingExercises(service = databaseService) {
  const db = service.getDb();
  const now = Date.now();
  let created = 0;
  let updated = 0;

  db.run('BEGIN IMMEDIATE');
  try {
    for (const exercise of defaultTrainingExercises) {
      const existing = service.query('SELECT id FROM training_exercises WHERE name = ? ORDER BY id ASC LIMIT 1', [
        exercise.name
      ]);
      if (existing.length > 0) {
        const id = Number(existing[0].values[0][0]);
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
            id
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

  return { created, updated, total: defaultTrainingExercises.length };
}
