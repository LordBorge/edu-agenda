import { Lesson } from '../types';

type LessonContentState = Pick<Lesson, 'kind' | 'conteudo_preparado'>;

export function isReservedLesson(lesson: Pick<Lesson, 'kind'>): boolean {
  return lesson.kind === 'reserved';
}

export function isLessonContentPrepared(lesson: LessonContentState): boolean {
  if (isReservedLesson(lesson)) return true;
  return Number(lesson.conteudo_preparado ?? 0) === 1;
}

export function hasPendingLessonContent(lesson: LessonContentState): boolean {
  return !isReservedLesson(lesson) && !isLessonContentPrepared(lesson);
}
