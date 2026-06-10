export const DEFAULT_LESSON_ACTIVITY_LABELS = [
  'Aula expositiva no quadro',
  'Aula expositiva com slide',
  'Avaliação',
  'Apresentação de trabalho',
  'Intervenção pedagógica',
  'Dinâmica',
  'Exercícios',
  'Atividade impressa',
  'Filme',
  'Outros',
];

export const LESSON_STATUS_OPTIONS = ['Pendente', 'Concluída', 'Cancelada'] as const;
export type LessonStatus = typeof LESSON_STATUS_OPTIONS[number];

/** Map legacy status values to the new simplified set. */
const LEGACY_STATUS_MAP: Record<string, LessonStatus> = {
  'Iniciada': 'Pendente',
  'Em andamento': 'Pendente',
  'Concluído': 'Concluída',
  'Concluída': 'Concluída',
};

/**
 * Normalise a status value coming from the database.
 * Legacy values are converted to the new set; unknown values default to 'Pendente'.
 */
export function normalizeLessonStatus(raw: string | null | undefined): LessonStatus {
  const value = (raw ?? '').trim();
  if (!value) return 'Pendente';
  if ((LESSON_STATUS_OPTIONS as readonly string[]).includes(value)) return value as LessonStatus;
  return LEGACY_STATUS_MAP[value] ?? 'Pendente';
}

export function normalizeLessonActivityKey(label: string): string {
  const normalized = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'atividade';
}

export function parseLessonActivities(value: string | null | undefined): string[] {
  const raw = (value ?? '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean);
    }
  } catch {
    // Older records used free text. Keep that text as one selected activity.
  }

  return raw
    .split(/\s*(?:\||;)\s*/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function stringifyLessonActivities(values: string[]): string {
  const unique = Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
  return JSON.stringify(unique);
}

export function formatLessonActivities(value: string | null | undefined): string {
  return parseLessonActivities(value).join(', ');
}
