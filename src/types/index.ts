export type SchedulePeriod = 'integral' | 'manha' | 'tarde';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Class {
  id: number;
  name: string;
  grade: string;
  subject: string;
  color: string;
  student_count: number;
  created_at: string;
}

export type Weekday = 0 | 1 | 2 | 3 | 4;
export type LessonKind = 'class' | 'reserved';

export interface Lesson {
  id: number;
  class_id: number | null;
  class_name?: string;
  class_color?: string;
  subject?: string;
  kind?: LessonKind;
  title?: string;
  schedule_month?: string;
  effective_from?: string;
  effective_until?: string | null;
  weekday: Weekday;
  start_time: string;
  end_time: string;
  content: string;
  activity: string;
  methodology: string;
  status?: string;
  notes: string;
  conteudo_preparado?: number;
  created_at: string;
}

export interface LessonEntry {
  id: number;
  lesson_id: number;
  date: string;
  content: string;
  activity: string;
  methodology: string;
  status: string;
  notes: string;
  conteudo_preparado: number;
  created_at: string;
  updated_at: string;
}

export interface LessonActivityOption {
  key: string;
  label: string;
  is_custom: number;
}

export type ActivityType = string;

export interface ActivityTypeOption {
  key: string;
  label: string;
  color: string;
  bg: string;
  icon: string;
  is_custom: number;
}

export interface Activity {
  id: number;
  lesson_id: number | null;
  class_id: number | null;
  class_name?: string;
  class_color?: string;
  type_label?: string;
  type_color?: string;
  type_bg?: string;
  type_icon?: string;
  type: ActivityType;
  title: string;
  description: string;
  due_date: string;
  done: number;
  created_at: string;
}

export interface Reminder {
  id: number;
  title: string;
  description: string;
  date: string;
  done: number;
  created_at: string;
}

export interface ScheduleSettings {
  id: number;
  period: SchedulePeriod;
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
}

export interface ProfessionalProfile {
  id: number;
  name: string;
  subjects: string;
  work_periods: string;
  theme_preference: ThemePreference;
  onboarded: number;
}
