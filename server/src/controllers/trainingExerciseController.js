import { databaseService } from '../services/database.js';

const CATEGORIES = new Set(['aerobic', 'strength', 'flexibility', 'balance', 'other']);
const SCENES = new Set(['indoor', 'outdoor']);
const VERIFICATION_MODES = new Set(['auto', 'manual', 'mixed']);
const EQUIPMENT_MODES = new Set(['bodyweight', 'equipment']);
const MDI_ICON_PATTERN = /^mdi:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const METRICS = new Set([
  'duration',
  'distance',
  'sets',
  'repetitions',
  'weight',
  'speed',
  'incline',
  'resistance',
  'heart_rate',
  'calories'
]);

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch {
    return fallback;
  }
}

function serializeExercise(row) {
  return {
    id: Number(row.id),
    name: row.name,
    icon: row.icon,
    category: row.category,
    scene: row.scene,
    verificationMode: row.verification_mode,
    equipmentMode: row.equipment_mode,
    equipment: row.equipment || '',
    metrics: parseJson(row.metrics, []),
    purpose: row.purpose || '',
    enabled: Boolean(row.enabled),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function validatePayload(payload = {}) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const icon = payload.icon || 'mdi:fitness-center';
  const category = payload.category || 'other';
  const verificationMode = payload.verificationMode || 'manual';
  const scene = payload.scene || '';
  const equipmentMode = payload.equipmentMode || 'bodyweight';
  const equipment = typeof payload.equipment === 'string' ? payload.equipment.trim() : '';
  const metrics = Array.isArray(payload.metrics) ? [...new Set(payload.metrics)] : [];
  const purpose = typeof payload.purpose === 'string' ? payload.purpose.trim() : '';

  const errors = {};
  if (!name || name.length > 80) errors.name = 'Name is required and must be 80 characters or fewer';
  if (!MDI_ICON_PATTERN.test(icon) || icon.length > 80) errors.icon = 'Invalid Material Design icon';
  if (!CATEGORIES.has(category)) errors.category = 'Invalid category';
  if (!SCENES.has(scene)) errors.scene = 'Select a valid scene';
  if (!EQUIPMENT_MODES.has(equipmentMode)) errors.equipmentMode = 'Select a valid equipment mode';
  if (equipmentMode === 'equipment' && (!equipment || equipment.length > 80)) {
    errors.equipment = 'Equipment is required and must be 80 characters or fewer';
  }
  if (!VERIFICATION_MODES.has(verificationMode)) errors.verificationMode = 'Invalid verification mode';
  if (metrics.some((metric) => !METRICS.has(metric))) errors.metrics = 'Invalid metric';
  if (purpose.length > 500) errors.purpose = 'Purpose must be 500 characters or fewer';

  if (Object.keys(errors).length > 0) return { errors };
  return {
    value: {
      name,
      icon,
      category,
      scene,
      verificationMode,
      equipmentMode,
      equipment: equipmentMode === 'equipment' ? equipment : '',
      metrics,
      purpose
    }
  };
}

function validateEnabled(enabled) {
  return typeof enabled === 'boolean';
}

function validateIds(ids) {
  return Array.isArray(ids) && ids.length > 0 && ids.every((id) => Number.isInteger(Number(id)) && Number(id) > 0);
}

function normalizeIds(ids) {
  return [...new Set(ids.map(Number))];
}

function getExercise(id) {
  const result = databaseService.query('SELECT * FROM training_exercises WHERE id = ?', [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const columns = result[0].columns;
  const row = Object.fromEntries(columns.map((column, index) => [column, result[0].values[0][index]]));
  return serializeExercise(row);
}

function queryRows(sql, params = []) {
  const result = databaseService.query(sql, params);
  if (result.length === 0) return [];
  return result[0].values.map((values) =>
    Object.fromEntries(result[0].columns.map((column, index) => [column, values[index]]))
  );
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function findExerciseReferences(id) {
  const tables = queryRows("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
  const references = [];

  for (const { name: tableName } of tables) {
    const foreignKeys = queryRows(`PRAGMA foreign_key_list(${quoteIdentifier(tableName)})`);
    for (const foreignKey of foreignKeys) {
      if (foreignKey.table !== 'training_exercises') continue;
      const [{ count = 0 } = {}] = queryRows(
        `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(foreignKey.from)} = ?`,
        [id]
      );
      if (Number(count) > 0) references.push({ table: tableName, count: Number(count) });
    }
  }

  return references;
}

export function listTrainingExercises(req, res) {
  try {
    const enabled = req.query.enabled;
    const whereClause = enabled === 'true' ? 'WHERE enabled = 1' : enabled === 'false' ? 'WHERE enabled = 0' : '';
    const result = databaseService.query(
      `SELECT * FROM training_exercises ${whereClause} ORDER BY name COLLATE NOCASE ASC, id ASC`
    );
    const rows =
      result.length === 0
        ? []
        : result[0].values.map((values) =>
            serializeExercise(Object.fromEntries(result[0].columns.map((column, index) => [column, values[index]])))
          );
    res.json({ exercises: rows });
  } catch (error) {
    console.error('Error listing training exercises:', error);
    res.status(500).json({ error: 'Failed to fetch training exercises' });
  }
}

export function getTrainingExercise(req, res) {
  try {
    const exercise = getExercise(Number(req.params.id));
    if (!exercise) return res.status(404).json({ error: 'Training exercise not found' });
    return res.json(exercise);
  } catch (error) {
    console.error('Error getting training exercise:', error);
    return res.status(500).json({ error: 'Failed to fetch training exercise' });
  }
}

export function createTrainingExercise(req, res) {
  const validation = validatePayload(req.body);
  if (validation.errors) return res.status(400).json({ error: 'Invalid training exercise', fields: validation.errors });

  try {
    const now = Date.now();
    const { value } = validation;
    const statement = databaseService.getDb();
    statement.run(
      `INSERT INTO training_exercises
        (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        value.name,
        value.icon,
        value.category,
        value.scene,
        value.verificationMode,
        value.equipmentMode,
        value.equipment,
        JSON.stringify(value.metrics),
        value.purpose,
        now,
        now
      ]
    );
    const row = databaseService.query('SELECT last_insert_rowid() AS id');
    const id = Number(row[0].values[0][0]);
    return res.status(201).json(getExercise(id));
  } catch (error) {
    console.error('Error creating training exercise:', error);
    return res.status(500).json({ error: 'Failed to create training exercise' });
  }
}

export function updateTrainingExercise(req, res) {
  const validation = validatePayload(req.body);
  if (validation.errors) return res.status(400).json({ error: 'Invalid training exercise', fields: validation.errors });

  try {
    const id = Number(req.params.id);
    if (!getExercise(id)) return res.status(404).json({ error: 'Training exercise not found' });
    const now = Date.now();
    const { value } = validation;
    databaseService.getDb().run(
      `UPDATE training_exercises
       SET name = ?, icon = ?, category = ?, scene = ?, verification_mode = ?, equipment_mode = ?, equipment = ?, metrics = ?, purpose = ?, updated_at = ?
       WHERE id = ?`,
      [
        value.name,
        value.icon,
        value.category,
        value.scene,
        value.verificationMode,
        value.equipmentMode,
        value.equipment,
        JSON.stringify(value.metrics),
        value.purpose,
        now,
        id
      ]
    );
    return res.json(getExercise(id));
  } catch (error) {
    console.error('Error updating training exercise:', error);
    return res.status(500).json({ error: 'Failed to update training exercise' });
  }
}

export function updateTrainingExerciseEnabled(req, res) {
  const enabled = req.body?.enabled;
  if (!validateEnabled(enabled)) {
    return res.status(400).json({ error: 'Enabled must be a boolean' });
  }

  try {
    const id = Number(req.params.id);
    if (!getExercise(id)) return res.status(404).json({ error: 'Training exercise not found' });
    databaseService
      .getDb()
      .run('UPDATE training_exercises SET enabled = ?, updated_at = ? WHERE id = ?', [enabled ? 1 : 0, Date.now(), id]);
    return res.json(getExercise(id));
  } catch (error) {
    console.error('Error updating training exercise enabled state:', error);
    return res.status(500).json({ error: 'Failed to update training exercise enabled state' });
  }
}

export function updateTrainingExercisesEnabled(req, res) {
  const { ids, enabled } = req.body || {};
  if (!validateIds(ids) || !validateEnabled(enabled)) {
    return res.status(400).json({ error: 'Exercise ids and a boolean enabled value are required' });
  }

  try {
    const normalizedIds = normalizeIds(ids);
    const placeholders = normalizedIds.map(() => '?').join(', ');
    const existingIds = queryRows(`SELECT id FROM training_exercises WHERE id IN (${placeholders})`, normalizedIds).map(
      (row) => Number(row.id)
    );
    if (existingIds.length > 0) {
      const existingPlaceholders = existingIds.map(() => '?').join(', ');
      databaseService
        .getDb()
        .run(`UPDATE training_exercises SET enabled = ?, updated_at = ? WHERE id IN (${existingPlaceholders})`, [
          enabled ? 1 : 0,
          Date.now(),
          ...existingIds
        ]);
    }
    return res.json({ updatedIds: existingIds, enabled });
  } catch (error) {
    console.error('Error batch updating training exercise enabled state:', error);
    return res.status(500).json({ error: 'Failed to batch update training exercise enabled state' });
  }
}

export function deleteTrainingExercise(req, res) {
  try {
    const id = Number(req.params.id);
    if (!getExercise(id)) return res.status(404).json({ error: 'Training exercise not found' });

    const references = findExerciseReferences(id);
    if (references.length > 0) {
      return res.status(409).json({
        code: 'TRAINING_EXERCISE_IN_USE',
        message: 'Training exercise is in use',
        details: { references }
      });
    }

    databaseService.getDb().run('DELETE FROM training_exercises WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting training exercise:', error);
    return res.status(500).json({ error: 'Failed to delete training exercise' });
  }
}

export function deleteTrainingExercises(req, res) {
  const ids = req.body?.ids;
  if (!validateIds(ids)) return res.status(400).json({ error: 'Exercise ids are required' });

  const db = databaseService.getDb();
  let transactionOpen = false;
  try {
    const normalizedIds = normalizeIds(ids);
    const placeholders = normalizedIds.map(() => '?').join(', ');
    const existingIds = queryRows(`SELECT id FROM training_exercises WHERE id IN (${placeholders})`, normalizedIds).map(
      (row) => Number(row.id)
    );

    db.run('BEGIN IMMEDIATE');
    transactionOpen = true;
    const blocked = existingIds.flatMap((id) => {
      const references = findExerciseReferences(id);
      return references.length > 0 ? [{ id, references }] : [];
    });
    if (blocked.length > 0) {
      db.run('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({
        code: 'TRAINING_EXERCISE_IN_USE',
        message: 'One or more training exercises are in use',
        details: { blocked }
      });
    }

    if (existingIds.length > 0) {
      const existingPlaceholders = existingIds.map(() => '?').join(', ');
      db.run(`DELETE FROM training_exercises WHERE id IN (${existingPlaceholders})`, existingIds);
    }
    db.run('COMMIT');
    transactionOpen = false;
    return res.json({ deletedIds: existingIds });
  } catch (error) {
    if (transactionOpen) db.run('ROLLBACK');
    console.error('Error batch deleting training exercises:', error);
    return res.status(500).json({ error: 'Failed to batch delete training exercises' });
  }
}

export const trainingExerciseValidation = { validatePayload, validateEnabled, validateIds };
