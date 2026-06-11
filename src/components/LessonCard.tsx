import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Lesson } from '../types';
import { lightenColor } from '../utils/colors';
import { formatLessonActivities } from '../utils/lessonActivities';
import { hasPendingLessonContent, isLessonContentPrepared } from '../utils/lessonContent';
import { useAppTheme } from '../theme';

interface Props {
  lesson: Lesson;
  onPress?: () => void;
  compact?: boolean;
}

export function LessonCard({ lesson, onPress, compact = false }: Props) {
  const { colors } = useAppTheme();
  const color = lesson.class_color || colors.primary;
  const bg = colors.mode === 'dark' ? `${color}22` : lightenColor(color);
  const activities = formatLessonActivities(lesson.activity);
  const isReserved = lesson.kind === 'reserved';
  const hasPendingContent = hasPendingLessonContent(lesson);
  const title = isReserved
    ? lesson.title || 'Horário reservado'
    : `${lesson.class_name ?? 'Turma'} · ${lesson.subject ?? 'Componente Curricular'}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        { backgroundColor: bg, borderLeftColor: color, borderColor: colors.mode === 'dark' ? `${color}33` : 'transparent' },
        compact && styles.compact,
      ]}
    >
      <Text style={[styles.time, { color }]}>{lesson.start_time} – {lesson.end_time}</Text>
      <Text style={[styles.class, { color }]} numberOfLines={1}>{title}</Text>
      {!compact && (
        <Text style={[styles.content, { color: colors.text }]} numberOfLines={2}>
          {isReserved ? 'Evento institucional' : lesson.content || 'Sem conteúdo'}
        </Text>
      )}
      {activities && !compact && (
        <Text style={[styles.activity, { color: colors.textMuted }]} numberOfLines={1}>Atividade: {activities}</Text>
      )}
      {lesson.status && !compact && (
        <Text style={[styles.activity, { color: colors.textMuted }]} numberOfLines={1}>Status: {lesson.status}</Text>
      )}
      {!isReserved && !compact && (
        <View
          style={[
            styles.pendingChip,
            {
              backgroundColor: isLessonContentPrepared(lesson)
                ? (colors.mode === 'dark' ? '#114B3E' : '#E8F8F5')
                : (colors.mode === 'dark' ? '#4A3412' : '#FFF4D6')
            },
          ]}
        >
          <Text
            style={[
              styles.pendingChipText,
              {
                color: isLessonContentPrepared(lesson)
                  ? (colors.mode === 'dark' ? '#1ABC9C' : '#0E6251')
                  : (colors.mode === 'dark' ? '#FFB74D' : '#9A5B00')
              }
            ]}
          >
            {isLessonContentPrepared(lesson) ? 'Aula preparada' : 'Aula não preparada'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 3,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  compact: {
    padding: 6,
    marginBottom: 4,
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    opacity: 0.8,
  },
  class: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  content: {
    fontSize: 12,
    color: '#555',
    marginBottom: 3,
    lineHeight: 17,
  },
  activity: {
    fontSize: 11,
    color: '#777',
  },
  pendingChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingChipText: {
    color: '#9A5B00',
    fontSize: 10,
    fontWeight: '800',
  },
});
