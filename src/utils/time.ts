export function getCurrentWeekday(): number {
  const day = new Date().getDay();
  if (day === 0 || day === 6) return 0;
  return day - 1;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function maskTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    if (digits.length === 2 && Number(digits) > 23) return '23';
    return digits;
  }

  const hour = Number(digits.slice(0, 2)) > 23 ? '23' : digits.slice(0, 2);
  const minuteDigits = digits.slice(2);
  const minute = minuteDigits.length === 2 && Number(minuteDigits) > 59
    ? '59'
    : minuteDigits;

  return `${hour}:${minute}`;
}

export function isCompleteTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type SchedulePeriod = 'integral' | 'manha' | 'tarde';

export interface ScheduleSlot {
  start: string;
  end: string;
  label: string;
  segment: 'manha' | 'tarde';
}

export interface ScheduleSlotOptions {
  period: SchedulePeriod;
  startTime: string;
  endTime: string;
  lessonDuration: number;
  breakDuration: number;
  breakAfterLesson: number;
  lunchStart: string;
  lunchDuration: number;
  afternoonBreakDuration: number;
  afternoonBreakAfterLesson: number;
}

type SlotWindowOptions = {
  start: number;
  end: number;
  lessonDuration: number;
  breakDuration: number;
  breakAfterLesson: number;
  segment: 'manha' | 'tarde';
  firstLessonNumber: number;
};

function generateSlotsForWindow({
  start,
  end,
  lessonDuration,
  breakDuration,
  breakAfterLesson,
  segment,
  firstLessonNumber,
}: SlotWindowOptions): { slots: ScheduleSlot[]; nextLessonNumber: number } {
  const slots: ScheduleSlot[] = [];
  let current = start;
  let lessonNumber = firstLessonNumber;
  let lessonsInWindow = 0;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return { slots, nextLessonNumber: lessonNumber };
  }

  while (current + lessonDuration <= end) {
    const slotEnd = current + lessonDuration;
    slots.push({
      start: minutesToTime(current),
      end: minutesToTime(slotEnd),
      label: `${lessonNumber}ª aula`,
      segment,
    });

    current = slotEnd;
    lessonNumber++;
    lessonsInWindow++;

    if (breakAfterLesson > 0 && lessonsInWindow === breakAfterLesson && current < end) {
      current += breakDuration;
    }
  }

  return { slots, nextLessonNumber: lessonNumber };
}

export function generateScheduleSlots(options: ScheduleSlotOptions): ScheduleSlot[] {
  const start = timeToMinutes(options.startTime);
  const end = timeToMinutes(options.endTime);
  const lessonDuration = Math.max(options.lessonDuration, 1);
  const morningBreakDuration = Math.max(options.breakDuration, 0);
  const morningBreakAfter = Math.max(options.breakAfterLesson, 0);
  const afternoonBreakDuration = Math.max(options.afternoonBreakDuration, 0);
  const afternoonBreakAfter = Math.max(options.afternoonBreakAfterLesson, 0);
  const lunchStartRaw = timeToMinutes(options.lunchStart);
  const lunchStart = Number.isFinite(lunchStartRaw) ? lunchStartRaw : end;
  const lunchEnd = lunchStart + Math.max(options.lunchDuration, 0);
  let lessonNumber = 1;
  const slots: ScheduleSlot[] = [];

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return slots;
  }

  const appendWindow = (windowOptions: Omit<SlotWindowOptions, 'firstLessonNumber' | 'lessonDuration'>) => {
    const result = generateSlotsForWindow({
      ...windowOptions,
      lessonDuration,
      firstLessonNumber: lessonNumber,
    });
    slots.push(...result.slots);
    lessonNumber = result.nextLessonNumber;
  };

  if (options.period === 'integral' && lunchStart > start && lunchStart < end) {
    appendWindow({
      start,
      end: lunchStart,
      breakDuration: morningBreakDuration,
      breakAfterLesson: morningBreakAfter,
      segment: 'manha',
    });

    appendWindow({
      start: Math.max(lunchEnd, lunchStart),
      end,
      breakDuration: afternoonBreakDuration,
      breakAfterLesson: afternoonBreakAfter,
      segment: 'tarde',
    });

    return slots;
  }

  appendWindow({
    start,
    end,
    breakDuration: options.period === 'tarde' ? afternoonBreakDuration : morningBreakDuration,
    breakAfterLesson: options.period === 'tarde' ? afternoonBreakAfter : morningBreakAfter,
    segment: options.period === 'tarde' ? 'tarde' : 'manha',
  });

  return slots;
}

export const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
export const WEEKDAY_FULL = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function dateToISO(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function daysFromNow(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function getCurrentWeekDates(): string[] {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.getDate().toString();
  });
}

export function getWeekdayFromDate(date: Date): number | null {
  const day = date.getDay();
  if (day === 0 || day === 6) return null;
  return day - 1;
}

export function getMonthCalendarWeeks(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = normalizeDate(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 6 }, (_, weekIndex) => (
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + weekIndex * 7 + dayIndex);
      return normalizeDate(date);
    })
  ));
}

export function getMonthCalendarDays(year: number, month: number): Date[] {
  return getMonthCalendarWeeks(year, month).flat();
}

export function normalizeDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}
