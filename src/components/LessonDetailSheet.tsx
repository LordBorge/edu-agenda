import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lesson } from '../types';
import { useAppTheme } from '../theme';
import { formatLessonActivities } from '../utils/lessonActivities';
import { hasPendingLessonContent, isLessonContentPrepared } from '../utils/lessonContent';
import { BottomSheetModal } from './BottomSheetModal';

type Props = {
  lesson: Lesson | null;
  onClose: () => void;
  onEdit?: (lesson: Lesson) => void;
  onDelete?: (lesson: Lesson) => void;
};

export function LessonDetailSheet({ lesson, onClose, onEdit, onDelete }: Props) {
  const { colors } = useAppTheme();

  if (!lesson) return null;
  const activities = formatLessonActivities(lesson.activity);
  const isReserved = lesson.kind === 'reserved';
  const hasPendingContent = hasPendingLessonContent(lesson);
  const title = isReserved
    ? lesson.title || 'Horário reservado'
    : `${lesson.class_name ?? 'Turma'} · ${lesson.subject ?? 'Componente Curricular'}`;

  return (
    <BottomSheetModal
      visible={!!lesson}
      onClose={onClose}
      maxHeight="84%"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.detailHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailTime, { color: colors.primary }]}>
              {lesson.start_time} - {lesson.end_time}
            </Text>
            <Text style={[styles.detailTitle, { color: colors.text }]}>
              {title}
            </Text>
          </View>
          <View style={[styles.colorDot, { backgroundColor: lesson.class_color || colors.primary }]} />
        </View>

        {!isReserved && (
          <View
            style={[
              styles.pendingBanner,
              {
                backgroundColor: isLessonContentPrepared(lesson)
                  ? (colors.mode === 'dark' ? '#114B3E' : '#E8F8F5')
                  : (colors.mode === 'dark' ? '#4A3412' : '#FFF4D6')
              },
            ]}
          >
            <Text
              style={[
                styles.pendingBannerText,
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

        <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
            {isReserved ? 'Tipo' : 'Conteúdo'}
          </Text>
          <Text style={[styles.detailText, { color: colors.text }]}>
            {isReserved ? 'Evento institucional' : lesson.content || 'Sem conteúdo definido'}
          </Text>
        </View>

        {!isReserved && (
          <View style={styles.detailGrid}>
            <View style={[styles.detailItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Atividade</Text>
              <Text style={[styles.detailText, { color: colors.text }]}>{activities || 'Sem atividade'}</Text>
            </View>
            <View style={[styles.detailItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Status</Text>
              <Text style={[styles.detailText, { color: colors.text }]}>{lesson.status || 'Sem status'}</Text>
            </View>
          </View>
        )}

        {!isReserved && (
          <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Observações</Text>
            <Text style={[styles.detailText, { color: colors.text }]}>{lesson.notes || 'Sem observações'}</Text>
          </View>
        )}

        {(onEdit || onDelete) && (
          <View style={styles.actionRow}>
            {onEdit && !isReserved && (
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => onEdit(lesson)}>
                <Text style={styles.primaryBtnText}>Editar</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.dangerBtn, { backgroundColor: colors.mode === 'dark' ? '#3A1F24' : '#FDEDEC' }]}
                onPress={() => onDelete(lesson)}
              >
                <Text style={styles.dangerBtnText}>Excluir</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  detailTime: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  detailTitle: { fontSize: 18, fontWeight: '700' },
  colorDot: { width: 16, height: 16, borderRadius: 8 },
  pendingBanner: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pendingBannerText: {
    color: '#9A5B00',
    fontSize: 11,
    fontWeight: '800',
  },
  detailBlock: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  detailGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  detailItem: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    minHeight: 82,
  },
  detailLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  detailText: { fontSize: 13, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  primaryBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  primaryBtnText: { fontSize: 13, color: '#FFF', fontWeight: '700' },
  dangerBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  dangerBtnText: { fontSize: 13, color: '#C0392B', fontWeight: '700' },
});
