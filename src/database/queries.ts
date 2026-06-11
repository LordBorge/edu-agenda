import { getDB } from './database';
import {
  Class, Lesson, LessonEntry, LessonActivityOption, Activity, Reminder, ActivityTypeOption,
  ScheduleSettings, SchedulePeriod, ProfessionalProfile,
} from '../types';
import { ACTIVITY_TYPE_CONFIG, CLASS_COLORS, hexToRgba } from '../utils/colors';
import type { ScheduleImportItem } from '../utils/scheduleImport';
import {
  DEFAULT_LESSON_ACTIVITY_LABELS,
  normalizeLessonActivityKey,
  parseLessonActivities,
  stringifyLessonActivities,
} from '../utils/lessonActivities';

const INITIAL_REGISTRATION_KEY = 'initial_registration_complete_v1';
const GUIDED_TOUR_KEY = 'guided_tour_complete_v1';
const INITIAL_SCHEDULE_SETUP_KEY = 'initial_schedule_setup_complete_v1';

export function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthKeyFromISO(date: string): string {
  return date.slice(0, 7);
}

function todayMonthKey(): string {
  return monthKeyFromDate(new Date());
}

function weekdayFromISO(date: string): number | null {
  const parsed = new Date(`${date}T00:00:00`);
  const day = parsed.getDay();
  if (day === 0 || day === 6) return null;
  return day - 1;
}

async function ensureScheduleForMonth(monthKey: string): Promise<void> {
  const database = getDB();
  const existing = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM lessons WHERE schedule_month = ?',
    [monthKey]
  );

  if ((existing?.count ?? 0) > 0) return;

  const source = await database.getFirstAsync<{ schedule_month: string }>(
    `SELECT schedule_month
     FROM lessons
     WHERE schedule_month IS NOT NULL AND schedule_month <> ''
     ORDER BY
       CASE WHEN schedule_month <= ? THEN 0 ELSE 1 END,
       ABS(CAST(substr(schedule_month, 1, 4) AS INTEGER) * 12 + CAST(substr(schedule_month, 6, 2) AS INTEGER)
         - (CAST(substr(?, 1, 4) AS INTEGER) * 12 + CAST(substr(?, 6, 2) AS INTEGER))) ASC
     LIMIT 1`,
    [monthKey, monthKey, monthKey]
  );

  if (!source?.schedule_month) return;

  const sourceLessons = await database.getAllAsync<Lesson>(
    `SELECT *
     FROM lessons
     WHERE schedule_month = ?
     ORDER BY weekday ASC, start_time ASC`,
    [source.schedule_month]
  );

  for (const lesson of sourceLessons) {
    await database.runAsync(
      `INSERT INTO lessons (
        class_id, kind, title, schedule_month, weekday, start_time, end_time,
        content, activity, methodology, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '', '', '')`,
      [
        lesson.class_id,
        lesson.kind ?? 'class',
        lesson.title ?? '',
        monthKey,
        lesson.weekday,
        lesson.start_time,
        lesson.end_time,
      ]
    );
  }
}

// ─── CLASSES ────────────────────────────────────────────────────────────────
export async function getClasses(): Promise<Class[]> {
  return await getDB().getAllAsync<Class>('SELECT * FROM classes ORDER BY name ASC');
}

export async function createClass(data: Omit<Class, 'id' | 'created_at'>): Promise<number> {
  const result = await getDB().runAsync(
    `INSERT INTO classes (name, grade, subject, color, student_count) VALUES (?, ?, ?, ?, ?)`,
    [data.name, data.grade, data.subject, data.color, data.student_count]
  );
  return result.lastInsertRowId;
}

export async function updateClass(id: number, data: Omit<Class, 'id' | 'created_at'>): Promise<void> {
  await getDB().runAsync(
    `UPDATE classes SET name=?, grade=?, subject=?, color=?, student_count=? WHERE id=?`,
    [data.name, data.grade, data.subject, data.color, data.student_count, id]
  );
}

export async function deleteClass(id: number): Promise<void> {
  await getDB().runAsync('DELETE FROM classes WHERE id=?', [id]);
}

// ─── LESSONS ────────────────────────────────────────────────────────────────
export async function getLessonsForWeek(monthKey = todayMonthKey()): Promise<Lesson[]> {
  await ensureScheduleForMonth(monthKey);
  return await getDB().getAllAsync<Lesson>(`
    SELECT l.*, c.name as class_name, c.color as class_color, c.subject
    FROM lessons l
    LEFT JOIN classes c ON l.class_id = c.id
    WHERE l.schedule_month = ?
    ORDER BY l.weekday ASC, l.start_time ASC
  `, [monthKey]);
}

export async function getLessonsForDay(weekday: number, monthKey = todayMonthKey()): Promise<Lesson[]> {
  await ensureScheduleForMonth(monthKey);
  return await getDB().getAllAsync<Lesson>(`
    SELECT l.*, c.name as class_name, c.color as class_color, c.subject
    FROM lessons l
    LEFT JOIN classes c ON l.class_id = c.id
    WHERE l.schedule_month = ? AND l.weekday = ?
    ORDER BY l.start_time ASC
  `, [monthKey, weekday]);
}

export async function getLessonsForDate(date: string): Promise<Lesson[]> {
  const weekday = weekdayFromISO(date);
  if (weekday === null) return [];

  const monthKey = monthKeyFromISO(date);
  await ensureScheduleForMonth(monthKey);

  return await getDB().getAllAsync<Lesson>(`
    SELECT
      l.*,
      c.name as class_name,
      c.color as class_color,
      c.subject,
      COALESCE(le.content, '') as content,
      COALESCE(le.activity, '') as activity,
      COALESCE(le.methodology, '') as methodology,
      COALESCE(le.status, '') as status,
      COALESCE(le.notes, '') as notes,
      COALESCE(le.conteudo_preparado, 0) as conteudo_preparado
    FROM lessons l
    LEFT JOIN classes c ON l.class_id = c.id
    LEFT JOIN lesson_entries le ON le.lesson_id = l.id AND le.date = ?
    WHERE l.schedule_month = ? AND l.weekday = ?
    ORDER BY l.start_time ASC
  `, [date, monthKey, weekday]);
}

export async function createLesson(
  data: Omit<Lesson, 'id' | 'created_at' | 'class_name' | 'class_color' | 'subject'>,
  monthKey = data.schedule_month ?? todayMonthKey()
): Promise<number> {
  const result = await getDB().runAsync(
    `INSERT INTO lessons (class_id, kind, title, schedule_month, weekday, start_time, end_time, content, activity, methodology, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.class_id,
      data.kind ?? 'class',
      data.title ?? '',
      monthKey,
      data.weekday,
      data.start_time,
      data.end_time,
      data.content,
      data.activity,
      data.methodology,
      data.status ?? '',
      data.notes,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateLesson(id: number, data: Omit<Lesson, 'id' | 'created_at' | 'class_name' | 'class_color' | 'subject'>): Promise<void> {
  await getDB().runAsync(
    `UPDATE lessons SET class_id=?, kind=?, title=?, weekday=?, start_time=?, end_time=?, content=?, activity=?, methodology=?, status=?, notes=? WHERE id=?`,
    [
      data.class_id,
      data.kind ?? 'class',
      data.title ?? '',
      data.weekday,
      data.start_time,
      data.end_time,
      data.content,
      data.activity,
      data.methodology,
      data.status ?? '',
      data.notes,
      id,
    ]
  );
}

export async function deleteLesson(id: number): Promise<void> {
  await getDB().runAsync('DELETE FROM lessons WHERE id=?', [id]);
}

async function findOrCreateImportedClass(item: ScheduleImportItem): Promise<{ classId: number; created: boolean }> {
  const existing = await getDB().getFirstAsync<Class>(
    'SELECT * FROM classes WHERE lower(name) = lower(?) AND lower(subject) = lower(?) LIMIT 1',
    [item.className, item.subject]
  );

  if (existing) return { classId: existing.id, created: false };

  const classCount = await getDB().getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM classes');
  const color = CLASS_COLORS[(classCount?.count ?? 0) % CLASS_COLORS.length]?.value ?? '#0F4C81';
  const classId = await createClass({
    name: item.className,
    grade: item.grade || item.className,
    subject: item.subject,
    color,
    student_count: 0,
  });

  return { classId, created: true };
}

async function lessonAlreadyExists(item: ScheduleImportItem, classId: number | null, monthKey: string): Promise<boolean> {
  const row = await getDB().getFirstAsync<{ id: number }>(
    `SELECT id
     FROM lessons
     WHERE schedule_month = ?
       AND weekday = ?
       AND start_time = ?
       AND end_time = ?
       AND kind = ?
       AND COALESCE(title, '') = ?
       AND (
         (? IS NULL AND class_id IS NULL)
         OR class_id = ?
       )
     LIMIT 1`,
    [
      monthKey,
      item.weekday,
      item.start_time,
      item.end_time,
      item.kind,
      item.title,
      classId,
      classId,
    ]
  );

  return !!row;
}

export async function importWeeklySchedule(
  items: ScheduleImportItem[],
  monthKey = todayMonthKey()
): Promise<{ createdClasses: number; createdLessons: number; skippedLessons: number }> {
  let createdClasses = 0;
  let createdLessons = 0;
  let skippedLessons = 0;

  for (const item of items) {
    let classId: number | null = null;

    if (item.kind === 'class') {
      const result = await findOrCreateImportedClass(item);
      classId = result.classId;
      if (result.created) createdClasses++;
    }

    if (await lessonAlreadyExists(item, classId, monthKey)) {
      skippedLessons++;
      continue;
    }

    await createLesson({
      class_id: classId,
      kind: item.kind,
      title: item.title,
      schedule_month: monthKey,
      weekday: item.weekday,
      start_time: item.start_time,
      end_time: item.end_time,
      content: '',
      activity: '',
      methodology: '',
      status: '',
      notes: '',
    }, monthKey);
    createdLessons++;
  }

  return { createdClasses, createdLessons, skippedLessons };
}

export async function upsertLessonEntry(
  lessonId: number,
  date: string,
  data: Pick<LessonEntry, 'content' | 'activity' | 'methodology' | 'status' | 'notes' | 'conteudo_preparado'>
): Promise<void> {
  await getDB().runAsync(
    `INSERT INTO lesson_entries (lesson_id, date, content, activity, methodology, status, notes, conteudo_preparado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(lesson_id, date) DO UPDATE SET
       content=excluded.content,
       activity=excluded.activity,
       methodology=excluded.methodology,
       status=excluded.status,
       notes=excluded.notes,
       conteudo_preparado=excluded.conteudo_preparado,
       updated_at=datetime('now')`,
    [lessonId, date, data.content, data.activity, data.methodology, data.status, data.notes, data.conteudo_preparado ?? 0]
  );
}

// ─── ACTIVITIES ──────────────────────────────────────────────────────────────
export async function getActivities(): Promise<Activity[]> {
  return await getDB().getAllAsync<Activity>(`
    SELECT a.*, c.name as class_name, c.color as class_color,
           at.label as type_label, at.color as type_color, at.bg as type_bg, at.icon as type_icon
    FROM activities a
    LEFT JOIN classes c ON a.class_id = c.id
    LEFT JOIN activity_types at ON a.type = at.key
    ORDER BY a.due_date ASC, a.done ASC
  `);
}

export async function getPendingActivities(): Promise<Activity[]> {
  return await getDB().getAllAsync<Activity>(`
    SELECT a.*, c.name as class_name, c.color as class_color,
           at.label as type_label, at.color as type_color, at.bg as type_bg, at.icon as type_icon
    FROM activities a
    LEFT JOIN classes c ON a.class_id = c.id
    LEFT JOIN activity_types at ON a.type = at.key
    WHERE a.done = 0
    ORDER BY a.due_date ASC
  `);
}

export async function getActivityTypes(): Promise<ActivityTypeOption[]> {
  return await getDB().getAllAsync<ActivityTypeOption>(
    'SELECT key, label, color, bg, icon, is_custom FROM activity_types ORDER BY is_custom ASC, label ASC'
  );
}

export async function getActivityTypeUsageCount(key: string): Promise<number> {
  const row = await getDB().getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM activities WHERE type = ?',
    [key]
  );
  return row?.count ?? 0;
}

function normalizeTypeKey(label: string): string {
  const normalized = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'tipo';
}

function initialsFromLabel(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'OT';
}

export async function createActivityType(label: string, color: string): Promise<ActivityTypeOption> {
  const trimmed = label.trim();
  const existingDefault = Object.entries(ACTIVITY_TYPE_CONFIG)
    .find(([, config]) => config.label.toLowerCase() === trimmed.toLowerCase());
  if (existingDefault) {
    const [key, config] = existingDefault;
    return { key, ...config, is_custom: 0 };
  }

  const existing = await getDB().getFirstAsync<ActivityTypeOption>(
    'SELECT key, label, color, bg, icon, is_custom FROM activity_types WHERE lower(label)=lower(?)',
    [trimmed]
  );
  if (existing) return existing;

  const base = normalizeTypeKey(trimmed);
  let key = base;
  let suffix = 2;
  while (await getDB().getFirstAsync<{ key: string }>('SELECT key FROM activity_types WHERE key=?', [key])) {
    key = `${base}_${suffix}`;
    suffix++;
  }

  const type: ActivityTypeOption = {
    key,
    label: trimmed,
    color,
    bg: hexToRgba(color, 0.14),
    icon: initialsFromLabel(trimmed),
    is_custom: 1,
  };

  await getDB().runAsync(
    'INSERT INTO activity_types (key, label, color, bg, icon, is_custom) VALUES (?, ?, ?, ?, ?, ?)',
    [type.key, type.label, type.color, type.bg, type.icon, type.is_custom]
  );
  return type;
}

export async function createActivity(data: Omit<Activity, 'id' | 'created_at' | 'class_name' | 'class_color'>): Promise<number> {
  const result = await getDB().runAsync(
    `INSERT INTO activities (lesson_id, class_id, type, title, description, due_date, done) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.lesson_id, data.class_id, data.type, data.title, data.description, data.due_date, data.done]
  );
  return result.lastInsertRowId;
}

export async function updateActivity(id: number, data: Omit<Activity, 'id' | 'created_at' | 'class_name' | 'class_color'>): Promise<void> {
  await getDB().runAsync(
    `UPDATE activities SET lesson_id=?, class_id=?, type=?, title=?, description=?, due_date=?, done=? WHERE id=?`,
    [data.lesson_id, data.class_id, data.type, data.title, data.description, data.due_date, data.done, id]
  );
}

export async function toggleActivity(id: number, done: number): Promise<void> {
  await getDB().runAsync('UPDATE activities SET done=? WHERE id=?', [done, id]);
}

export async function deleteActivity(id: number): Promise<void> {
  await getDB().runAsync('DELETE FROM activities WHERE id=?', [id]);
}

export async function deleteCustomActivityType(key: string): Promise<void> {
  const type = await getDB().getFirstAsync<ActivityTypeOption>(
    'SELECT key, label, color, bg, icon, is_custom FROM activity_types WHERE key = ?',
    [key]
  );

  if (!type || !type.is_custom) return;

  await getDB().runAsync('UPDATE activities SET type = ? WHERE type = ?', ['atividade', key]);
  await getDB().runAsync('DELETE FROM activity_types WHERE key = ? AND is_custom = 1', [key]);
}

// ─── REMINDERS ───────────────────────────────────────────────────────────────
export async function getReminders(): Promise<Reminder[]> {
  return await getDB().getAllAsync<Reminder>('SELECT * FROM reminders ORDER BY date ASC, done ASC');
}

export async function createReminder(data: Omit<Reminder, 'id' | 'created_at'>): Promise<number> {
  const result = await getDB().runAsync(
    `INSERT INTO reminders (title, description, date, done) VALUES (?, ?, ?, ?)`,
    [data.title, data.description, data.date, data.done]
  );
  return result.lastInsertRowId;
}

export async function updateReminder(id: number, data: Omit<Reminder, 'id' | 'created_at'>): Promise<void> {
  await getDB().runAsync(
    `UPDATE reminders SET title=?, description=?, date=?, done=? WHERE id=?`,
    [data.title, data.description, data.date, data.done, id]
  );
}

export async function toggleReminder(id: number, done: number): Promise<void> {
  await getDB().runAsync('UPDATE reminders SET done=? WHERE id=?', [done, id]);
}

export async function deleteReminder(id: number): Promise<void> {
  await getDB().runAsync('DELETE FROM reminders WHERE id=?', [id]);
}

// ─── PROFILE ────────────────────────────────────────────────────────────────
export async function getProfessionalProfile(): Promise<ProfessionalProfile> {
  const profile = await getDB().getFirstAsync<ProfessionalProfile>('SELECT * FROM professional_profile WHERE id=1');
  return profile ?? {
    id: 1,
    name: '',
    subjects: '',
    work_periods: 'integral',
    theme_preference: 'system',
    onboarded: 0,
  };
}

export async function updateProfessionalProfile(data: Omit<ProfessionalProfile, 'id'>): Promise<void> {
  await getDB().runAsync(
    `INSERT INTO professional_profile (id, name, subjects, work_periods, theme_preference, onboarded)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       subjects=excluded.subjects,
       work_periods=excluded.work_periods,
       theme_preference=excluded.theme_preference,
       onboarded=excluded.onboarded`,
    [data.name, data.subjects, data.work_periods, data.theme_preference, data.onboarded]
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
async function hasMetadataFlag(key: string): Promise<boolean> {
  const row = await getDB().getFirstAsync<{ value: string }>(
    'SELECT value FROM app_metadata WHERE key = ?',
    [key]
  );
  return row?.value === 'done';
}

async function markMetadataFlag(key: string): Promise<void> {
  await getDB().runAsync(
    'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
    [key, 'done']
  );
}

export async function hasCompletedInitialRegistration(): Promise<boolean> {
  return hasMetadataFlag(INITIAL_REGISTRATION_KEY);
}

export async function markInitialRegistrationComplete(): Promise<void> {
  await markMetadataFlag(INITIAL_REGISTRATION_KEY);
}

export async function hasCompletedGuidedTour(): Promise<boolean> {
  return hasMetadataFlag(GUIDED_TOUR_KEY);
}

export async function markGuidedTourComplete(): Promise<void> {
  await markMetadataFlag(GUIDED_TOUR_KEY);
}

export async function hasCompletedInitialScheduleSetup(): Promise<boolean> {
  return hasMetadataFlag(INITIAL_SCHEDULE_SETUP_KEY);
}

export async function markInitialScheduleSetupComplete(): Promise<void> {
  await markMetadataFlag(INITIAL_SCHEDULE_SETUP_KEY);
}

export async function getActiveSchedulePeriod(): Promise<SchedulePeriod> {
  const row = await getDB().getFirstAsync<{ period: SchedulePeriod }>('SELECT period FROM schedule_settings WHERE id=1');
  return row?.period ?? 'integral';
}

export async function getScheduleSettingsForPeriod(period: SchedulePeriod): Promise<ScheduleSettings> {
  const s = await getDB().getFirstAsync<Omit<ScheduleSettings, 'id'>>(
    `SELECT
       ? as period,
       start_time,
       end_time,
       morning_start_time,
       morning_end_time,
       afternoon_start_time,
       afternoon_end_time,
       lesson_duration,
       break_duration,
       break_after_lesson,
       lunch_start,
       lunch_duration,
       afternoon_break_duration,
       afternoon_break_after_lesson
     FROM period_schedule_settings
     WHERE period=?`,
    [period, period]
  );

  if (s) {
    return { id: 1, ...s };
  }

  return {
    id: 1,
    period,
    start_time: period === 'tarde' ? '14:00' : '07:30',
    end_time: period === 'integral' ? '17:00' : period === 'manha' ? '12:00' : '17:00',
    morning_start_time: '07:30',
    morning_end_time: '12:00',
    afternoon_start_time: period === 'tarde' ? '14:00' : '13:00',
    afternoon_end_time: '17:00',
    lesson_duration: 48,
    break_duration: 20,
    break_after_lesson: 2,
    lunch_start: '12:00',
    lunch_duration: 60,
    afternoon_break_duration: 20,
    afternoon_break_after_lesson: 3,
  };
}

export async function getScheduleSettings(): Promise<ScheduleSettings> {
  const period = await getActiveSchedulePeriod();
  return await getScheduleSettingsForPeriod(period);
}

export async function updateScheduleSettings(data: Omit<ScheduleSettings, 'id'>): Promise<void> {
  await getDB().runAsync(
    `INSERT INTO period_schedule_settings (
       period, start_time, end_time, morning_start_time, morning_end_time,
       afternoon_start_time, afternoon_end_time, lesson_duration, break_duration, break_after_lesson,
       lunch_start, lunch_duration, afternoon_break_duration, afternoon_break_after_lesson
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(period) DO UPDATE SET
       start_time=excluded.start_time,
       end_time=excluded.end_time,
       morning_start_time=excluded.morning_start_time,
       morning_end_time=excluded.morning_end_time,
       afternoon_start_time=excluded.afternoon_start_time,
       afternoon_end_time=excluded.afternoon_end_time,
       lesson_duration=excluded.lesson_duration,
       break_duration=excluded.break_duration,
       break_after_lesson=excluded.break_after_lesson,
       lunch_start=excluded.lunch_start,
       lunch_duration=excluded.lunch_duration,
       afternoon_break_duration=excluded.afternoon_break_duration,
       afternoon_break_after_lesson=excluded.afternoon_break_after_lesson`,
    [
      data.period,
      data.start_time,
      data.end_time,
      data.morning_start_time,
      data.morning_end_time,
      data.afternoon_start_time,
      data.afternoon_end_time,
      data.lesson_duration,
      data.break_duration,
      data.break_after_lesson,
      data.lunch_start,
      data.lunch_duration,
      data.afternoon_break_duration,
      data.afternoon_break_after_lesson,
    ]
  );

  await getDB().runAsync(
    `UPDATE schedule_settings
     SET period=?, start_time=?, end_time=?, morning_start_time=?, morning_end_time=?,
         afternoon_start_time=?, afternoon_end_time=?, lesson_duration=?, break_duration=?, break_after_lesson=?,
         lunch_start=?, lunch_duration=?, afternoon_break_duration=?, afternoon_break_after_lesson=?
     WHERE id=1`,
    [
      data.period,
      data.start_time,
      data.end_time,
      data.morning_start_time,
      data.morning_end_time,
      data.afternoon_start_time,
      data.afternoon_end_time,
      data.lesson_duration,
      data.break_duration,
      data.break_after_lesson,
      data.lunch_start,
      data.lunch_duration,
      data.afternoon_break_duration,
      data.afternoon_break_after_lesson,
    ]
  );
}

async function ensureDefaultLessonActivityOptions(): Promise<void> {
  for (const label of DEFAULT_LESSON_ACTIVITY_LABELS) {
    await getDB().runAsync(
      `INSERT OR IGNORE INTO lesson_activity_options (key, label, is_custom)
       VALUES (?, ?, 0)`,
      [normalizeLessonActivityKey(label), label]
    );
  }
}

export async function getLessonActivityOptions(): Promise<LessonActivityOption[]> {
  await ensureDefaultLessonActivityOptions();
  const rows = await getDB().getAllAsync<LessonActivityOption>(
    'SELECT key, label, is_custom FROM lesson_activity_options ORDER BY is_custom ASC, label ASC'
  );
  const defaultOrder = new Map(
    DEFAULT_LESSON_ACTIVITY_LABELS.map((label, index) => [normalizeLessonActivityKey(label), index])
  );

  return rows.sort((a, b) => {
    if (a.is_custom !== b.is_custom) return a.is_custom - b.is_custom;
    if (!a.is_custom && !b.is_custom) {
      return (defaultOrder.get(a.key) ?? 99) - (defaultOrder.get(b.key) ?? 99);
    }
    return a.label.localeCompare(b.label, 'pt-BR');
  });
}

export async function createLessonActivityOption(label: string): Promise<LessonActivityOption> {
  await ensureDefaultLessonActivityOptions();

  const trimmed = label.trim();
  const existing = await getDB().getFirstAsync<LessonActivityOption>(
    'SELECT key, label, is_custom FROM lesson_activity_options WHERE lower(label) = lower(?)',
    [trimmed]
  );

  if (existing) return existing;

  const base = normalizeLessonActivityKey(trimmed);
  let key = base;
  let suffix = 2;

  while (await getDB().getFirstAsync<{ key: string }>('SELECT key FROM lesson_activity_options WHERE key = ?', [key])) {
    key = `${base}_${suffix}`;
    suffix++;
  }

  await getDB().runAsync(
    'INSERT INTO lesson_activity_options (key, label, is_custom) VALUES (?, ?, 1)',
    [key, trimmed]
  );

  return { key, label: trimmed, is_custom: 1 };
}

export async function getLessonActivityOptionUsageCount(label: string): Promise<number> {
  const rows = await getDB().getAllAsync<{ activity: string }>(`
    SELECT activity FROM lessons WHERE activity <> ''
    UNION ALL
    SELECT activity FROM lesson_entries WHERE activity <> ''
  `);

  return rows.filter(row => parseLessonActivities(row.activity).includes(label)).length;
}

export async function deleteCustomLessonActivityOption(key: string): Promise<void> {
  const option = await getDB().getFirstAsync<LessonActivityOption>(
    'SELECT key, label, is_custom FROM lesson_activity_options WHERE key = ?',
    [key]
  );

  if (!option || !option.is_custom) return;

  const lessonRows = await getDB().getAllAsync<{ id: number; activity: string }>(
    'SELECT id, activity FROM lessons WHERE activity <> ?',
    ['']
  );
  for (const row of lessonRows) {
    const next = parseLessonActivities(row.activity).filter(activity => activity !== option.label);
    await getDB().runAsync('UPDATE lessons SET activity = ? WHERE id = ?', [stringifyLessonActivities(next), row.id]);
  }

  const entryRows = await getDB().getAllAsync<{ id: number; activity: string }>(
    'SELECT id, activity FROM lesson_entries WHERE activity <> ?',
    ['']
  );
  for (const row of entryRows) {
    const next = parseLessonActivities(row.activity).filter(activity => activity !== option.label);
    await getDB().runAsync("UPDATE lesson_entries SET activity = ?, updated_at = datetime('now') WHERE id = ?", [
      stringifyLessonActivities(next),
      row.id,
    ]);
  }

  await getDB().runAsync('DELETE FROM lesson_activity_options WHERE key = ? AND is_custom = 1', [key]);
}
