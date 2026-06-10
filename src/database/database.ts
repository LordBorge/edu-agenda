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
      class_id INTEGER NOT NULL,
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
  await ensureLessonsScheduleColumns(database);
  await ensureLessonEntriesTable(database);
  await ensureLessonActivityOptions(database);
  await ensureProfessionalProfileColumns(database);
  await ensureActivityTypes(database);
  await migrateLegacyLessonStatus(database);

  const settings = await database.getFirstAsync<{ id: number }>('SELECT id FROM schedule_settings WHERE id = 1');
  if (!settings) {
    await database.runAsync(
      `INSERT INTO schedule_settings (
        id, period, start_time, end_time, lesson_duration, break_duration, break_after_lesson,
        lunch_start, lunch_duration, afternoon_break_duration, afternoon_break_after_lesson
      )
       VALUES (1, 'integral', '07:30', '17:00', 48, 20, 2, '12:00', 60, 20, 3)`
    );
  }

  await ensurePeriodScheduleSettings(database);
  await ensureProfessionalProfile(database);

  const classCount = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM classes');
  if (classCount?.count === 0) {
    await seedDemoData(database);
  }

  await ensureLegacyLessonsHaveScheduleMonth(database);
}

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
  ['integral', '07:30', '17:00', 48, 20, 2, '12:00', 60, 20, 3],
  ['manha', '07:30', '12:00', 48, 20, 2, '12:00', 60, 20, 3],
  ['tarde', '14:00', '17:00', 48, 20, 2, '12:00', 60, 20, 3],
] as const;

async function ensurePeriodScheduleSettings(database: SQLite.SQLiteDatabase): Promise<void> {
  const count = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM period_schedule_settings');

  for (const period of PERIOD_DEFAULTS) {
    await database.runAsync(
      `INSERT OR IGNORE INTO period_schedule_settings (
        period, start_time, end_time, lesson_duration, break_duration, break_after_lesson,
        lunch_start, lunch_duration, afternoon_break_duration, afternoon_break_after_lesson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...period]
    );
  }

  if (count?.count === 0) {
    const legacy = await database.getFirstAsync<{
      period: string;
      start_time: string;
      end_time: string;
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
         SET start_time=?, end_time=?, lesson_duration=?, break_duration=?, break_after_lesson=?,
             lunch_start=?, lunch_duration=?, afternoon_break_duration=?, afternoon_break_after_lesson=?
         WHERE period=?`,
        [
          legacy.start_time,
          legacy.end_time,
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

async function ensureProfessionalProfileColumns(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(professional_profile)');
  const names = new Set(columns.map(column => column.name));

  if (!names.has('theme_preference')) {
    await database.execAsync(`ALTER TABLE professional_profile ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system'`);
  }
}

const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const fmt = (d: Date): string => d.toISOString().split('T')[0];

async function seedDemoData(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.runAsync(`INSERT INTO classes (name, grade, subject, color, student_count) VALUES (?, ?, ?, ?, ?)`, ['7º Ano A', '7º Ano', 'Inglês', '#0F4C81', 28]);
  await database.runAsync(`INSERT INTO classes (name, grade, subject, color, student_count) VALUES (?, ?, ?, ?, ?)`, ['8º Ano A', '8º Ano', 'Inglês', '#14B8A6', 31]);
  await database.runAsync(`INSERT INTO classes (name, grade, subject, color, student_count) VALUES (?, ?, ?, ?, ?)`, ['6º Ano A', '6º Ano', 'Inglês', '#EF9F27', 25]);
  await database.runAsync(`INSERT INTO classes (name, grade, subject, color, student_count) VALUES (?, ?, ?, ?, ?)`, ['3º EM A', '3º EM', 'Inglês', '#D4537E', 30]);

  const lessons = [
    [1, 0, '07:30', '08:18', 'Verbo To Be — Afirmativo e Negativo', 'Exercícios no quadro + caderno', 'Expositiva dialogada', ''],
    [2, 0, '09:26', '10:14', 'Present Continuous — Introdução', 'Atividade escrita', 'Indutiva', ''],
    [3, 0, '11:02', '11:50', 'Classroom Objects', 'Vocabulário com flashcards', 'Lúdica', ''],
    [1, 1, '07:30', '08:18', 'Vocabulário — cores, números e objetos', 'Quadro interativo', 'Colaborativa', ''],
    [2, 1, '09:26', '10:14', 'Present Continuous — Prática', 'Role-play em duplas', 'Comunicativa', ''],
    [4, 1, '10:14', '11:02', 'Slides 37-43 + Palestra no auditório', 'Leitura e interpretação', 'Expositiva', ''],
    [2, 2, '07:30', '08:18', 'Present Continuous — Atividade', 'Vistar cadernos + slides 59-62', 'Revisão', ''],
    [1, 2, '09:26', '10:14', 'Matemática — revisão integrada', 'Exercícios', 'Revisão', 'Aula conjunta'],
    [1, 3, '07:30', '08:18', 'Atividades com o verbo To Be', 'Quadro + apostila', 'Fixação', ''],
    [2, 3, '08:18', '09:06', 'Present Continuous', 'Exercício oral', 'Comunicativa', ''],
    [3, 3, '10:14', '11:02', 'Quadro — Funções orgânicas', 'Brincando com balões', 'Lúdica', ''],
    [1, 4, '07:30', '08:18', 'Revisão Verbo To Be', 'Vistar cadernos + Slides 37-40', 'Revisão', ''],
    [2, 4, '09:26', '10:14', 'Vocabulary Day — School Objects', 'Apresentação oral', 'Comunicativa', ''],
    [3, 4, '11:02', '11:50', 'Funções orgânicas oxigenadas', 'Exercícios em duplas', 'Colaborativa', ''],
  ];

  for (const l of lessons) {
    await database.runAsync(
      `INSERT INTO lessons (class_id, weekday, start_time, end_time, content, activity, methodology, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      l as any[]
    );
  }

  const today = new Date();
  await database.runAsync(`INSERT INTO activities (class_id, type, title, description, due_date, done) VALUES (?, ?, ?, ?, ?, ?)`, [1, 'prova', 'AVS de LI — 7º A', 'Avaliação semestral de Língua Inglesa', fmt(addDays(today, 10)), 0]);
  await database.runAsync(`INSERT INTO activities (class_id, type, title, description, due_date, done) VALUES (?, ?, ?, ?, ?, ?)`, [2, 'trabalho', 'Trabalho Present Continuous', 'Entrega dos trabalhos escritos', fmt(addDays(today, 3)), 0]);
  await database.runAsync(`INSERT INTO activities (class_id, type, title, description, due_date, done) VALUES (?, ?, ?, ?, ?, ?)`, [3, 'atividade', 'Vocabulário School Objects', 'Lista de vocabulário ilustrada', fmt(addDays(today, 1)), 0]);
  await database.runAsync(`INSERT INTO activities (class_id, type, title, description, due_date, done) VALUES (?, ?, ?, ?, ?, ?)`, [1, 'entrega', 'Guias Bimestrais', 'Elaborar e entregar guias do 2º bimestre', fmt(addDays(today, 5)), 0]);

  await database.runAsync(`INSERT INTO reminders (title, description, date, done) VALUES (?, ?, ?, ?)`, ['Elaborar guias bimestrais', 'Preparar guias do 2º bimestre para todas as turmas', fmt(addDays(today, 5)), 0]);
  await database.runAsync(`INSERT INTO reminders (title, description, date, done) VALUES (?, ?, ?, ?)`, ['AVS de LI — 13/05', 'Aplicar prova 7º e 8º anos', fmt(addDays(today, 10)), 0]);
  await database.runAsync(`INSERT INTO reminders (title, description, date, done) VALUES (?, ?, ?, ?)`, ['Lançar notas no sistema', 'Notas do 1º bimestre vencem sexta', fmt(addDays(today, 2)), 0]);
}
