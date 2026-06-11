import * as SQLite from 'expo-sqlite';
import { DEFAULT_LESSON_ACTIVITY_LABELS, normalizeLessonActivityKey } from '../utils/lessonActivities';

let db: SQLite.SQLiteDatabase | null = null;

export function getDB(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('edu_agenda.db');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = getDB();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schedule_settings (
      id INTEGER PRIMARY KEY NOT NULL,
      period TEXT NOT NULL DEFAULT 'integral',
      start_time TEXT NOT NULL DEFAULT '07:30',
      end_time TEXT NOT NULL DEFAULT '17:00',
      morning_start_time TEXT NOT NULL DEFAULT '07:30',
      morning_end_time TEXT NOT NULL DEFAULT '12:00',
      afternoon_start_time TEXT NOT NULL DEFAULT '13:00',
      afternoon_end_time TEXT NOT NULL DEFAULT '17:00',
      lesson_duration INTEGER NOT NULL DEFAULT 48,
      break_duration INTEGER NOT NULL DEFAULT 20,
      break_after_lesson INTEGER NOT NULL DEFAULT 2,
      lunch_start TEXT NOT NULL DEFAULT '12:00',
      lunch_duration INTEGER NOT NULL DEFAULT 60,
      afternoon_break_duration INTEGER NOT NULL DEFAULT 20,
      afternoon_break_after_lesson INTEGER NOT NULL DEFAULT 3
    );

    CREATE TABLE IF NOT EXISTS period_schedule_settings (
      period TEXT PRIMARY KEY NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      morning_start_time TEXT NOT NULL DEFAULT '07:30',
      morning_end_time TEXT NOT NULL DEFAULT '12:00',
      afternoon_start_time TEXT NOT NULL DEFAULT '13:00',
      afternoon_end_time TEXT NOT NULL DEFAULT '17:00',
      lesson_duration INTEGER NOT NULL,
      break_duration INTEGER NOT NULL,
      break_after_lesson INTEGER NOT NULL,
      lunch_start TEXT NOT NULL,
      lunch_duration INTEGER NOT NULL,
      afternoon_break_duration INTEGER NOT NULL,
      afternoon_break_after_lesson INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS professional_profile (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      subjects TEXT NOT NULL DEFAULT '',
      work_periods TEXT NOT NULL DEFAULT 'integral',
      theme_preference TEXT NOT NULL DEFAULT 'system',
      onboarded INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade TEXT NOT NULL,
      subject TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#0F4C81',
      student_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER,
      kind TEXT NOT NULL DEFAULT 'class',
      title TEXT NOT NULL DEFAULT '',
      schedule_month TEXT,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      activity TEXT NOT NULL DEFAULT '',
      methodology TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lesson_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      activity TEXT NOT NULL DEFAULT '',
      methodology TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(lesson_id, date),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER,
      class_id INTEGER,
      type TEXT NOT NULL DEFAULT 'atividade',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_types (
      key TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      bg TEXT NOT NULL,
      icon TEXT NOT NULL,
      is_custom INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lesson_activity_options (
      key TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      is_custom INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await ensureScheduleSettingsColumns(database);
  await ensurePeriodScheduleSettingsColumns(database);
  await ensureLessonsScheduleColumns(database);
  await ensureLessonsSupportReservedBlocks(database);
  await ensureLessonEntriesTable(database);
  await ensureLessonActivityOptions(database);
  await ensureProfessionalProfileColumns(database);
  await ensureActivityTypes(database);
  await migrateLegacyLessonStatus(database);

  const settings = await database.getFirstAsync<{ id: number }>('SELECT id FROM schedule_settings WHERE id = 1');
  if (!settings) {
    await database.runAsync(
      `INSERT INTO schedule_settings (
        id, period, start_time, end_time, morning_start_time, morning_end_time,
        afternoon_start_time, afternoon_end_time, lesson_duration, break_duration, break_after_lesson,
        lunch_start, lunch_duration, afternoon_break_duration, afternoon_break_after_lesson
      )
       VALUES (1, 'integral', '07:30', '17:00', '07:30', '12:00', '13:00', '17:00', 48, 20, 2, '12:00', 60, 20, 3)`
    );
  }

  await ensurePeriodScheduleSettings(database);
  await ensureProfessionalProfile(database);
  await resetLocalDataForFreshOnboarding(database);

  await ensureLegacyLessonsHaveScheduleMonth(database);
}

const FRESH_ONBOARDING_RESET_KEY = 'fresh_onboarding_without_demo_v1';

const DEFAULT_ACTIVITY_TYPES = [
  ['prova', 'Prova', '#C0392B', '#FDEDEC', 'PR', 0],
  ['trabalho', 'Trabalho', '#0F4C81', '#E6F0F8', 'TR', 0],
  ['atividade', 'Atividade', '#14B8A6', '#E0F7F4', 'AT', 0],
  ['entrega', 'Entrega', '#15803D', '#DCFCE7', 'EN', 0],
  ['aviso', 'Aviso', '#F59E0B', '#FEF3C7', 'IN', 0],
] as const;

async function ensureActivityTypes(database: SQLite.SQLiteDatabase): Promise<void> {
  for (const type of DEFAULT_ACTIVITY_TYPES) {
    await database.runAsync(
      `INSERT OR IGNORE INTO activity_types (key, label, color, bg, icon, is_custom)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [...type]
    );
  }
}

async function migrateLegacyLessonStatus(database: SQLite.SQLiteDatabase): Promise<void> {
  // Convert legacy status values in both tables to the new simplified set.
  // 'Iniciada' and 'Em andamento' → 'Pendente'
  // 'Concluído' → 'Concluída'
  const migrationSQL = `
    UPDATE %TABLE%
    SET status = CASE status
      WHEN 'Iniciada' THEN 'Pendente'
      WHEN 'Em andamento' THEN 'Pendente'
      WHEN 'Concluído' THEN 'Concluída'
      ELSE status
    END
    WHERE status IN ('Iniciada', 'Em andamento', 'Concluído')
  `;

  await database.execAsync(migrationSQL.replace('%TABLE%', 'lessons'));
  await database.execAsync(migrationSQL.replace('%TABLE%', 'lesson_entries'));
}

async function ensureScheduleSettingsColumns(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(schedule_settings)');
  const names = new Set(columns.map(column => column.name));

  const migrations = [
    { name: 'morning_start_time', sql: `ALTER TABLE schedule_settings ADD COLUMN morning_start_time TEXT NOT NULL DEFAULT '07:30'` },
    { name: 'morning_end_time', sql: `ALTER TABLE schedule_settings ADD COLUMN morning_end_time TEXT NOT NULL DEFAULT '12:00'` },
    { name: 'afternoon_start_time', sql: `ALTER TABLE schedule_settings ADD COLUMN afternoon_start_time TEXT NOT NULL DEFAULT '13:00'` },
    { name: 'afternoon_end_time', sql: `ALTER TABLE schedule_settings ADD COLUMN afternoon_end_time TEXT NOT NULL DEFAULT '17:00'` },
    { name: 'lunch_start', sql: `ALTER TABLE schedule_settings ADD COLUMN lunch_start TEXT NOT NULL DEFAULT '12:00'` },
    { name: 'lunch_duration', sql: `ALTER TABLE schedule_settings ADD COLUMN lunch_duration INTEGER NOT NULL DEFAULT 60` },
    { name: 'afternoon_break_duration', sql: `ALTER TABLE schedule_settings ADD COLUMN afternoon_break_duration INTEGER NOT NULL DEFAULT 20` },
    { name: 'afternoon_break_after_lesson', sql: `ALTER TABLE schedule_settings ADD COLUMN afternoon_break_after_lesson INTEGER NOT NULL DEFAULT 3` },
  ];

  for (const migration of migrations) {
    if (!names.has(migration.name)) {
      await database.execAsync(migration.sql);
    }
  }
}

async function ensurePeriodScheduleSettingsColumns(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(period_schedule_settings)');
  const names = new Set(columns.map(column => column.name));

  const migrations = [
    { name: 'morning_start_time', sql: `ALTER TABLE period_schedule_settings ADD COLUMN morning_start_time TEXT NOT NULL DEFAULT '07:30'` },
    { name: 'morning_end_time', sql: `ALTER TABLE period_schedule_settings ADD COLUMN morning_end_time TEXT NOT NULL DEFAULT '12:00'` },
    { name: 'afternoon_start_time', sql: `ALTER TABLE period_schedule_settings ADD COLUMN afternoon_start_time TEXT NOT NULL DEFAULT '13:00'` },
    { name: 'afternoon_end_time', sql: `ALTER TABLE period_schedule_settings ADD COLUMN afternoon_end_time TEXT NOT NULL DEFAULT '17:00'` },
  ];

  for (const migration of migrations) {
    if (!names.has(migration.name)) {
      await database.execAsync(migration.sql);
    }
  }
}

function currentMonthKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

async function ensureLessonsScheduleColumns(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(lessons)');
  const names = new Set(columns.map(column => column.name));

  if (!names.has('schedule_month')) {
    await database.execAsync('ALTER TABLE lessons ADD COLUMN schedule_month TEXT');
  }
  if (!names.has('status')) {
    await database.execAsync(`ALTER TABLE lessons ADD COLUMN status TEXT NOT NULL DEFAULT ''`);
  }
  if (!names.has('kind')) {
    await database.execAsync(`ALTER TABLE lessons ADD COLUMN kind TEXT NOT NULL DEFAULT 'class'`);
  }
  if (!names.has('title')) {
    await database.execAsync(`ALTER TABLE lessons ADD COLUMN title TEXT NOT NULL DEFAULT ''`);
  }
}

async function ensureLessonsSupportReservedBlocks(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string; notnull: number }>('PRAGMA table_info(lessons)');
  const classIdColumn = columns.find(column => column.name === 'class_id');

  if (!classIdColumn || classIdColumn.notnull === 0) return;

  await database.execAsync(`
    PRAGMA foreign_keys = OFF;

    CREATE TABLE IF NOT EXISTS lessons_migration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER,
      kind TEXT NOT NULL DEFAULT 'class',
      title TEXT NOT NULL DEFAULT '',
      schedule_month TEXT,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      activity TEXT NOT NULL DEFAULT '',
      methodology TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );

    INSERT INTO lessons_migration (
      id, class_id, kind, title, schedule_month, weekday, start_time, end_time,
      content, activity, methodology, status, notes, created_at
    )
    SELECT
      id,
      class_id,
      COALESCE(kind, 'class'),
      COALESCE(title, ''),
      schedule_month,
      weekday,
      start_time,
      end_time,
      content,
      activity,
      methodology,
      COALESCE(status, ''),
      notes,
      created_at
    FROM lessons;

    DROP TABLE lessons;
    ALTER TABLE lessons_migration RENAME TO lessons;
    PRAGMA foreign_keys = ON;
  `);
}

async function ensureLessonEntriesTable(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS lesson_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      activity TEXT NOT NULL DEFAULT '',
      methodology TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      conteudo_preparado INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(lesson_id, date),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    );
  `);

  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(lesson_entries)');
  const names = new Set(columns.map(column => column.name));

  if (!names.has('status')) {
    await database.execAsync(`ALTER TABLE lesson_entries ADD COLUMN status TEXT NOT NULL DEFAULT ''`);
  }
  if (!names.has('conteudo_preparado')) {
    await database.execAsync(`ALTER TABLE lesson_entries ADD COLUMN conteudo_preparado INTEGER NOT NULL DEFAULT 0`);
  }
}

async function ensureLessonActivityOptions(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS lesson_activity_options (
      key TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      is_custom INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  for (const label of DEFAULT_LESSON_ACTIVITY_LABELS) {
    await database.runAsync(
      `INSERT OR IGNORE INTO lesson_activity_options (key, label, is_custom)
       VALUES (?, ?, 0)`,
      [normalizeLessonActivityKey(label), label]
    );
  }
}

async function ensureLegacyLessonsHaveScheduleMonth(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.runAsync(
    'UPDATE lessons SET schedule_month = ? WHERE schedule_month IS NULL OR schedule_month = ?',
    [currentMonthKey(), '']
  );
}

const PERIOD_DEFAULTS = [
  {
    period: 'integral',
    start_time: '07:30',
    end_time: '17:00',
    morning_start_time: '07:30',
    morning_end_time: '12:00',
    afternoon_start_time: '13:00',
    afternoon_end_time: '17:00',
    lesson_duration: 48,
    break_duration: 20,
    break_after_lesson: 2,
    lunch_start: '12:00',
    lunch_duration: 60,
    afternoon_break_duration: 20,
    afternoon_break_after_lesson: 3,
  },
  {
    period: 'manha',
    start_time: '07:30',
    end_time: '12:00',
    morning_start_time: '07:30',
    morning_end_time: '12:00',
    afternoon_start_time: '13:00',
    afternoon_end_time: '17:00',
    lesson_duration: 48,
    break_duration: 20,
    break_after_lesson: 2,
    lunch_start: '12:00',
    lunch_duration: 60,
    afternoon_break_duration: 20,
    afternoon_break_after_lesson: 3,
  },
  {
    period: 'tarde',
    start_time: '14:00',
    end_time: '17:00',
    morning_start_time: '07:30',
    morning_end_time: '12:00',
    afternoon_start_time: '14:00',
    afternoon_end_time: '17:00',
    lesson_duration: 48,
    break_duration: 20,
    break_after_lesson: 2,
    lunch_start: '12:00',
    lunch_duration: 60,
    afternoon_break_duration: 20,
    afternoon_break_after_lesson: 3,
  },
] as const;

async function ensurePeriodScheduleSettings(database: SQLite.SQLiteDatabase): Promise<void> {
  const count = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM period_schedule_settings');

  for (const period of PERIOD_DEFAULTS) {
    await database.runAsync(
      `INSERT OR IGNORE INTO period_schedule_settings (
        period, start_time, end_time, morning_start_time, morning_end_time,
        afternoon_start_time, afternoon_end_time, lesson_duration, break_duration, break_after_lesson,
        lunch_start, lunch_duration, afternoon_break_duration, afternoon_break_after_lesson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        period.period,
        period.start_time,
        period.end_time,
        period.morning_start_time,
        period.morning_end_time,
        period.afternoon_start_time,
        period.afternoon_end_time,
        period.lesson_duration,
        period.break_duration,
        period.break_after_lesson,
        period.lunch_start,
        period.lunch_duration,
        period.afternoon_break_duration,
        period.afternoon_break_after_lesson,
      ]
    );
  }

  if (count?.count === 0) {
    const legacy = await database.getFirstAsync<{
      period: string;
      start_time: string;
      end_time: string;
      morning_start_time: string;
      morning_end_time: string;
      afternoon_start_time: string;
      afternoon_end_time: string;
      lesson_duration: number;
      break_duration: number;
      break_after_lesson: number;
      lunch_start: string;
      lunch_duration: number;
      afternoon_break_duration: number;
      afternoon_break_after_lesson: number;
    }>('SELECT * FROM schedule_settings WHERE id = 1');

    if (legacy) {
      await database.runAsync(
        `UPDATE period_schedule_settings
         SET start_time=?, end_time=?, morning_start_time=?, morning_end_time=?,
             afternoon_start_time=?, afternoon_end_time=?, lesson_duration=?, break_duration=?, break_after_lesson=?,
             lunch_start=?, lunch_duration=?, afternoon_break_duration=?, afternoon_break_after_lesson=?
         WHERE period=?`,
        [
          legacy.start_time,
          legacy.end_time,
          legacy.morning_start_time,
          legacy.morning_end_time,
          legacy.afternoon_start_time,
          legacy.afternoon_end_time,
          legacy.lesson_duration,
          legacy.break_duration,
          legacy.break_after_lesson,
          legacy.lunch_start,
          legacy.lunch_duration,
          legacy.afternoon_break_duration,
          legacy.afternoon_break_after_lesson,
          legacy.period,
        ]
      );
    }
  }
}

async function ensureProfessionalProfile(database: SQLite.SQLiteDatabase): Promise<void> {
  const profile = await database.getFirstAsync<{ id: number }>('SELECT id FROM professional_profile WHERE id = 1');
  if (!profile) {
    await database.runAsync(
      `INSERT INTO professional_profile (id, name, subjects, work_periods, theme_preference, onboarded)
       VALUES (1, '', '', 'integral', 'system', 0)`
    );
  }
}

async function resetLocalDataForFreshOnboarding(database: SQLite.SQLiteDatabase): Promise<void> {
  const resetDone = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_metadata WHERE key = ?',
    [FRESH_ONBOARDING_RESET_KEY]
  );
  if (resetDone?.value === 'done') return;

  await database.execAsync(`
    DELETE FROM lesson_entries;
    DELETE FROM activities;
    DELETE FROM reminders;
    DELETE FROM lessons;
    DELETE FROM classes;

    UPDATE professional_profile
    SET name = '',
        subjects = '',
        work_periods = 'integral',
        theme_preference = 'system',
        onboarded = 0
    WHERE id = 1;

    UPDATE schedule_settings
    SET period = 'integral',
        start_time = '07:30',
        end_time = '17:00',
        morning_start_time = '07:30',
        morning_end_time = '12:00',
        afternoon_start_time = '13:00',
        afternoon_end_time = '17:00',
        lesson_duration = 48,
        break_duration = 20,
        break_after_lesson = 2,
        lunch_start = '12:00',
        lunch_duration = 60,
        afternoon_break_duration = 20,
        afternoon_break_after_lesson = 3
    WHERE id = 1;
  `);

  for (const period of PERIOD_DEFAULTS) {
    await database.runAsync(
      `UPDATE period_schedule_settings
       SET start_time = ?,
           end_time = ?,
           morning_start_time = ?,
           morning_end_time = ?,
           afternoon_start_time = ?,
           afternoon_end_time = ?,
           lesson_duration = ?,
           break_duration = ?,
           break_after_lesson = ?,
           lunch_start = ?,
           lunch_duration = ?,
           afternoon_break_duration = ?,
           afternoon_break_after_lesson = ?
       WHERE period = ?`,
      [
        period.start_time,
        period.end_time,
        period.morning_start_time,
        period.morning_end_time,
        period.afternoon_start_time,
        period.afternoon_end_time,
        period.lesson_duration,
        period.break_duration,
        period.break_after_lesson,
        period.lunch_start,
        period.lunch_duration,
        period.afternoon_break_duration,
        period.afternoon_break_after_lesson,
        period.period,
      ]
    );
  }

  await database.runAsync(
    'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
    [FRESH_ONBOARDING_RESET_KEY, 'done']
  );
}

async function ensureProfessionalProfileColumns(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(professional_profile)');
  const names = new Set(columns.map(column => column.name));

  if (!names.has('theme_preference')) {
    await database.execAsync(`ALTER TABLE professional_profile ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system'`);
  }
}
