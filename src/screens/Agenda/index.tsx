import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getLessonsForWeek, getLessonsForDate, getClasses, createLesson, updateLesson, deleteLesson,
  getScheduleSettings, monthKeyFromDate, upsertLessonEntry,
  getLessonActivityOptions, createLessonActivityOption,
  getLessonActivityOptionUsageCount, deleteCustomLessonActivityOption,
} from '../../database/queries';
import { Lesson, Class, LessonActivityOption, Weekday } from '../../types';
import {
  getCurrentWeekday, getCurrentWeekDates, WEEKDAY_LABELS,
  generateScheduleSlots, getMonthCalendarWeeks, getWeekdayFromDate,
  dateToISO, isCompleteTime, isSameDate, normalizeDate,
} from '../../utils/time';
import { LessonCard } from '../../components/LessonCard';
import { useAppTheme } from '../../theme';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { LessonDetailSheet } from '../../components/LessonDetailSheet';
import { TimeInput } from '../../components/TimeInput';
import { LessonActivitySelector } from '../../components/LessonActivitySelector';
import { ConfirmDialog, type ConfirmDialogVariant } from '../../components/ConfirmDialog';
import { PreparedContentToggle } from '../../components/PreparedContentToggle';
import { LESSON_STATUS_OPTIONS, normalizeLessonStatus, parseLessonActivities, stringifyLessonActivities } from '../../utils/lessonActivities';
import { SheetScrollView } from '../../components/SheetScrollView';
import { ScheduleImportSheet } from '../../components/ScheduleImportSheet';

type LessonForm = {
  class_id: number;
  weekday: Weekday;
  start_time: string;
  end_time: string;
  content: string;
  activity: string;
  methodology: string;
  status: string;
  notes: string;
  conteudo_preparado: number;
};

type LessonSlot = { start: string; end: string; label: string };
type AgendaViewMode = 'week' | 'month';
type LessonFormErrors = {
  class_id?: string;
  slots?: string;
  time?: string;
};
type ConfirmDialogState = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
  variant?: ConfirmDialogVariant;
  onConfirm: () => void | Promise<void>;
};

const EMPTY_CONFIRM_DIALOG: ConfirmDialogState = {
  visible: false,
  title: '',
  message: '',
  onConfirm: () => undefined,
};

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const CALENDAR_WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function normalizeWeekday(day: number): Weekday {
  return Math.min(Math.max(day, 0), 4) as Weekday;
}

function emptyLessonForm(weekday: number, classId = 0): LessonForm {
  return {
    class_id: classId,
    weekday: normalizeWeekday(weekday),
    start_time: '07:30',
    end_time: '08:18',
    content: '',
    activity: '',
    methodology: '',
    status: 'Pendente',
    notes: '',
    conteudo_preparado: 0,
  };
}

function lessonMatchesWeekday(lesson: Lesson, weekday: number): boolean {
  return Number(lesson.weekday) === weekday;
}

function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getCurrentWeekDateForWeekday(weekday: number): Date {
  const today = normalizeDate(new Date());
  const currentDay = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

  const date = new Date(monday);
  date.setDate(monday.getDate() + weekday);
  return normalizeDate(date);
}

export function AgendaScreen({ navigation, route }: any) {
  const { colors } = useAppTheme();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [dateLessons, setDateLessons] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [lessonActivityOptions, setLessonActivityOptions] = useState<LessonActivityOption[]>([]);
  const [slots, setSlots] = useState<LessonSlot[]>([]);
  const [viewMode, setViewMode] = useState<AgendaViewMode>('week');
  const [selectedDay, setSelectedDay] = useState<number>(getCurrentWeekday());
  const [selectedMonthDate, setSelectedMonthDate] = useState(() => normalizeDate(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [showModal, setShowModal] = useState(false);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [detailLesson, setDetailLesson] = useState<Lesson | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  // Slots selecionados para cadastro múltiplo (Set de 'start_time')
  const [selectedSlotKeys, setSelectedSlotKeys] = useState<Set<string>>(new Set());
  const [multiSlotEnabled, setMultiSlotEnabled] = useState(false);
  const [form, setForm] = useState<LessonForm>(() => emptyLessonForm(getCurrentWeekday()));
  const [formErrors, setFormErrors] = useState<LessonFormErrors>({});
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(EMPTY_CONFIRM_DIALOG);
  const weekDates = getCurrentWeekDates();
  const selectedWeekDate = useMemo(() => getCurrentWeekDateForWeekday(selectedDay), [selectedDay]);
  const activeDate = viewMode === 'month' ? selectedMonthDate : selectedWeekDate;
  const activeDateISO = dateToISO(activeDate);
  const activeMonthKey = monthKeyFromDate(activeDate);

  const load = useCallback(async () => {
    const [lessonRows, dayRows, classRows, activityOptions, settings] = await Promise.all([
      getLessonsForWeek(activeDateISO),
      getLessonsForDate(activeDateISO),
      getClasses(),
      getLessonActivityOptions(),
      getScheduleSettings(),
    ]);

    setLessons(lessonRows);
    setDateLessons(dayRows);
    setClasses(classRows);
    setLessonActivityOptions(activityOptions);
    setSlots(generateScheduleSlots({
      period: settings.period,
      startTime: settings.start_time,
      endTime: settings.end_time,
      lessonDuration: settings.lesson_duration,
      breakDuration: settings.break_duration,
      breakAfterLesson: settings.break_after_lesson,
      lunchStart: settings.lunch_start,
      lunchDuration: settings.lunch_duration,
      afternoonBreakDuration: settings.afternoon_break_duration,
      afternoonBreakAfterLesson: settings.afternoon_break_after_lesson,
    }));

    setForm(current => {
      if (current.class_id !== 0 || classRows.length === 0) return current;
      return { ...current, class_id: classRows[0].id };
    });
  }, [activeDateISO, activeMonthKey]);

  useFocusEffect(useCallback(() => {
    const hasLessonParam = !!route?.params?.lessonId;
    if (!hasLessonParam) {
      const today = normalizeDate(new Date());
      setSelectedDay(getCurrentWeekday());
      setSelectedMonthDate(today);
      setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    }
  }, [route?.params?.lessonId]));

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const lessonId = route?.params?.lessonId;
    if (!lessonId) return;

    const lesson = lessons.find(item => item.id === lessonId);
    const weekday = typeof route?.params?.weekday === 'number'
      ? normalizeWeekday(route.params.weekday)
      : lesson?.weekday;

    if (weekday !== undefined) {
      setSelectedDay(weekday);
      setViewMode('week');
    }

    if (lesson) {
      setDetailLesson(lesson);
      navigation.setParams?.({ lessonId: undefined, weekday: undefined });
    }
  }, [lessons, navigation, route?.params?.lessonId, route?.params?.weekday]);

  const selectedMonthWeekday = useMemo(
    () => getWeekdayFromDate(selectedMonthDate),
    [selectedMonthDate]
  );
  const activeWeekday = viewMode === 'month' ? selectedMonthWeekday : selectedDay;

  const dayLessons = useMemo(
    () => activeWeekday === null ? [] : dateLessons.filter(lesson => lessonMatchesWeekday(lesson, activeWeekday)),
    [activeWeekday, dateLessons]
  );

  const selectedMonthLessons = useMemo(
    () => selectedMonthWeekday === null ? [] : dateLessons.filter(lesson => lessonMatchesWeekday(lesson, selectedMonthWeekday)),
    [dateLessons, selectedMonthWeekday]
  );

  const monthWeeks = useMemo(
    () => getMonthCalendarWeeks(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth]
  );

  const lessonCountByWeekday = useMemo(() => {
    const counts = new Map<number, number>();
    lessons.forEach(lesson => {
      const weekday = Number(lesson.weekday);
      if (Number.isInteger(weekday) && weekday >= 0 && weekday <= 4) {
        counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
      }
    });
    return counts;
  }, [lessons]);

  const slotStartTimes = useMemo(
    () => new Set(slots.map(slot => slot.start)),
    [slots]
  );

  const extraLessons = useMemo(
    () => dayLessons.filter(lesson => !slotStartTimes.has(lesson.start_time)),
    [dayLessons, slotStartTimes]
  );

  const resetForm = (weekday = activeWeekday ?? selectedDay) => {
    setForm(emptyLessonForm(weekday, classes[0]?.id ?? form.class_id));
    setFormErrors({});
  };

  const selectMonthDay = (date: Date) => {
    // Always normalize to local midnight to avoid any timezone-induced day shifts
    const nextDate = normalizeDate(date);
    const weekday = getWeekdayFromDate(nextDate);
    setSelectedMonthDate(nextDate);
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    if (weekday !== null) {
      setSelectedDay(weekday);
    }
  };

  const moveMonth = (direction: -1 | 1) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + direction, 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    const nextSelected = new Date(
      next.getFullYear(),
      next.getMonth(),
      Math.min(selectedMonthDate.getDate(), lastDay)
    );
    setVisibleMonth(next);
    selectMonthDay(nextSelected);
  };

  const openAdd = (slot?: LessonSlot) => {
    if (activeWeekday === null) {
      showInfoDialog('Dia sem aulas', 'Selecione um dia útil para cadastrar aulas.');
      return;
    }

    const next = emptyLessonForm(activeWeekday, classes[0]?.id ?? form.class_id);
    setEditingLesson(null);
    setDetailLesson(null);
    setMultiSlotEnabled(false);
    // Pré-selecionar o slot tocado, se houver
    setSelectedSlotKeys(slot ? new Set([slot.start]) : new Set());
    setFormErrors({});
    setForm({
      ...next,
      start_time: slot?.start ?? next.start_time,
      end_time: slot?.end ?? next.end_time,
    });
    setShowModal(true);
  };

  const openEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setDetailLesson(null);
    setMultiSlotEnabled(false);
    setSelectedSlotKeys(new Set([lesson.start_time]));
    setFormErrors({});
    setForm({
      class_id: lesson.class_id ?? 0,
      weekday: lesson.weekday,
      start_time: lesson.start_time,
      end_time: lesson.end_time,
      content: lesson.content,
      activity: lesson.activity,
      methodology: lesson.methodology,
      status: normalizeLessonStatus(lesson.status),
      notes: lesson.notes,
      conteudo_preparado: lesson.conteudo_preparado ?? 0,
    });
    setShowModal(true);
  };

  const openImport = () => {
    setDetailLesson(null);
    setEditingLesson(null);
    setShowModal(false);
    setShowImportSheet(true);
  };

  const closeForm = () => {
    setShowModal(false);
    setEditingLesson(null);
    setFormErrors({});
  };

  const closeDetail = () => {
    setDetailLesson(null);
  };

  const closeConfirmDialog = () => setConfirmDialog(EMPTY_CONFIRM_DIALOG);

  const confirmAndClose = async () => {
    const action = confirmDialog.onConfirm;
    closeConfirmDialog();
    await action();
  };

  const showInfoDialog = (title: string, message: string) => {
    setConfirmDialog({
      visible: true,
      title,
      message,
      confirmLabel: 'OK',
      cancelLabel: null,
      variant: 'info',
      onConfirm: () => undefined,
    });
  };

  const getLessonBlocks = (): LessonSlot[] | null => {
    const start = form.start_time.trim();
    const end = form.end_time.trim();

    // Modo edição: apenas um bloco
    if (editingLesson) {
      return [{ start, end, label: '' }];
    }

    // Modo múltiplos horários: usar os slots selecionados
    if (multiSlotEnabled && selectedSlotKeys.size > 0) {
      const selected = slots.filter(slot => selectedSlotKeys.has(slot.start));
      if (selected.length === 0) return null;
      return selected;
    }

    // Modo padrão: bloco único baseado no horário do form
    const startIndex = slots.findIndex(slot => slot.start === start);
    if (startIndex < 0) {
      return [{ start, end, label: '' }];
    }
    return [slots[startIndex]];
  };

  const handleSave = async () => {
    const nextErrors: LessonFormErrors = {};

    if (form.class_id === 0) {
      nextErrors.class_id = 'Cadastre ou selecione uma turma para a aula';
    }

    if (multiSlotEnabled && !editingLesson && selectedSlotKeys.size === 0) {
      nextErrors.slots = 'Selecione ao menos um horário';
    }

    if (!multiSlotEnabled || editingLesson) {
      if (!form.start_time.trim() || !form.end_time.trim()) {
        nextErrors.time = 'Informe o horário de início e término';
      } else if (!isCompleteTime(form.start_time.trim()) || !isCompleteTime(form.end_time.trim())) {
        nextErrors.time = 'Use o formato HH:MM para os horários';
      }
    }

    if (nextErrors.class_id || nextErrors.slots || nextErrors.time) {
      setFormErrors(nextErrors);
      return;
    }

    const blocks = getLessonBlocks();
    if (!blocks) {
      setFormErrors(current => ({ ...current, slots: 'Selecione ao menos um horário' }));
      return;
    }

    const data = {
      ...form,
      start_time: form.start_time.trim(),
      end_time: form.end_time.trim(),
      content: form.content.trim(),
      activity: form.activity.trim(),
      methodology: form.methodology.trim(),
      status: form.status,
      notes: form.notes.trim(),
    };
    const scheduleData = {
      ...data,
      content: '',
      activity: '',
      methodology: '',
      status: '',
      notes: '',
    };
    const entryData = {
      content: data.content,
      activity: data.activity,
      methodology: data.methodology,
      status: data.status,
      notes: data.notes,
      conteudo_preparado: data.conteudo_preparado,
    };

    if (editingLesson) {
      const lessonId = await updateLesson(editingLesson.id, {
        ...scheduleData,
        schedule_month: activeMonthKey,
        effective_from: activeDateISO,
      });
      await upsertLessonEntry(lessonId, activeDateISO, entryData);
    } else {
      for (const block of blocks) {
        const lessonId = await createLesson({
          ...scheduleData,
          start_time: block.start,
          end_time: block.end,
          schedule_month: activeMonthKey,
          effective_from: activeDateISO,
        }, activeDateISO);
        await upsertLessonEntry(lessonId, activeDateISO, entryData);
      }
    }

    setSelectedDay(data.weekday);
    closeForm();
    resetForm(data.weekday);
    await load();
  };

  const handleDelete = (lesson: Lesson) => {
    setConfirmDialog({
      visible: true,
      title: 'Excluir aula',
      message: 'Deseja remover esta aula da agenda semanal?',
      onConfirm: async () => {
        await deleteLesson(lesson.id);
        setDetailLesson(null);
        closeForm();
        await load();
      },
    });
  };

  const createCustomLessonActivity = async (label: string): Promise<string | null> => {
    const option = await createLessonActivityOption(label);
    const options = await getLessonActivityOptions();
    setLessonActivityOptions(options);
    return option.label;
  };

  const handleDeleteCustomLessonActivity = async (option: LessonActivityOption) => {
    if (!option.is_custom) return;

    const usageCount = await getLessonActivityOptionUsageCount(option.label);
    const message = usageCount > 0
      ? `Esta atividade está sendo usada em ${usageCount} ${usageCount === 1 ? 'registro' : 'registros'}. Ao excluir, ela será removida ${usageCount === 1 ? 'desse registro' : 'desses registros'}.`
      : 'Deseja excluir esta atividade personalizada?';

    setConfirmDialog({
      visible: true,
      title: 'Excluir atividade',
      message,
      onConfirm: async () => {
        await deleteCustomLessonActivityOption(option.key);
        setForm(current => ({
          ...current,
          activity: stringifyLessonActivities(
            parseLessonActivities(current.activity).filter(activity => activity !== option.label)
          ),
        }));
        const options = await getLessonActivityOptions();
        setLessonActivityOptions(options);
        await load();
      },
    });
  };

  const today = new Date();

  // ── Segment Control ──────────────────────────────────────────────────────────
  const renderSegmentControl = () => (
    <View style={[styles.segmentWrap, {
      backgroundColor: colors.mode === 'dark' ? colors.surfaceMuted : '#EEF2F7',
    }]}>
      {(['week', 'month'] as AgendaViewMode[]).map(mode => {
        const active = viewMode === mode;
        return (
          <TouchableOpacity
            key={mode}
            style={[
              styles.segmentBtn,
              active && {
                backgroundColor: colors.mode === 'dark' ? colors.primary : '#0F4C81',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3,
              },
            ]}
            onPress={() => setViewMode(mode)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.segmentText,
              { color: colors.textMuted },
              active && { color: '#FFF', fontWeight: '700' },
            ]}>
              {mode === 'week' ? 'Semana' : 'Mês'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Month Calendar ───────────────────────────────────────────────────────────
  const renderMonthCalendar = () => (
    <View style={[styles.monthPanel, {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    }]}>
      {/* Month nav */}
      <View style={styles.monthHeader}>
        <TouchableOpacity
          style={[styles.monthNavBtn, { backgroundColor: colors.surfaceMuted }]}
          onPress={() => moveMonth(-1)}
        >
          <Text style={[styles.monthNavText, { color: colors.primary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.text }]}>
          {MONTHS_PT[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
        </Text>
        <TouchableOpacity
          style={[styles.monthNavBtn, { backgroundColor: colors.surfaceMuted }]}
          onPress={() => moveMonth(1)}
        >
          <Text style={[styles.monthNavText, { color: colors.primary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={styles.calendarWeekRow}>
        {CALENDAR_WEEKDAYS.map((weekday, index) => (
          <View key={`${weekday}-${index}`} style={styles.calendarWeekCell}>
            <Text style={[styles.calendarWeekText, {
              color: index === 0 || index === 6 ? colors.secondary : colors.textMuted,
            }]}>
              {weekday}
            </Text>
          </View>
        ))}
      </View>

      {/* Days grid */}
      <View style={styles.monthGrid}>
        {monthWeeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}-${getLocalDateKey(week[0])}`} style={styles.monthWeekRow}>
            {week.map(date => {
              const weekday = getWeekdayFromDate(date);
              const isSelected = isSameDate(date, selectedMonthDate);
              const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
              const isToday = isSameDate(date, today);
              const lessonCount = isCurrentMonth && weekday !== null
                ? lessonCountByWeekday.get(weekday) ?? 0
                : 0;
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;

              return (
                <TouchableOpacity
                  key={getLocalDateKey(date)}
                  style={styles.monthCell}
                  onPress={() => selectMonthDay(date)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.monthDayMarker,
                    isToday && !isSelected && {
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                    },
                    isSelected && {
                      backgroundColor: colors.primary,
                    },
                  ]}>
                    <Text style={[
                      styles.monthDayText,
                      { color: isCurrentMonth ? colors.text : colors.textMuted },
                      isWeekend && isCurrentMonth && { color: colors.mode === 'dark' ? '#8ECDF5' : '#3B82F6' },
                      !isCurrentMonth && { opacity: 0.35 },
                      isToday && !isSelected && { fontWeight: '700', color: colors.primary },
                      isSelected && { color: '#FFF', fontWeight: '800', opacity: 1 },
                    ]}>
                      {date.getDate()}
                    </Text>
                  </View>

                  {/* Lesson dots */}
                  {lessonCount > 0 && (
                    <View style={styles.monthDotsRow}>
                      {Array.from({ length: Math.min(lessonCount, 3) }).map((_, dotIdx) => (
                        <View
                          key={dotIdx}
                          style={[
                            styles.monthLessonDot,
                            {
                              backgroundColor: colors.secondary,
                              opacity: isSelected ? 1 : 0.7,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );

  // ── Day lessons (month view) ─────────────────────────────────────────────────
  const renderMonthDayLessons = () => {
    const dayLabel = selectedMonthDate.toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const capitalLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

    return (
      <View style={styles.monthDaySection}>
        <View style={styles.monthDaySectionHeader}>
          <Text style={[styles.monthDaySectionTitle, { color: colors.text }]}>
            {capitalLabel}
          </Text>
          <TouchableOpacity
            style={[styles.monthAddBtn, { backgroundColor: colors.primary }]}
            onPress={() => openAdd()}
          >
            <Text style={styles.monthAddBtnText}>+ Aula</Text>
          </TouchableOpacity>
        </View>

        {selectedMonthWeekday === null ? (
          // Sábado ou domingo
          <View style={[styles.monthEmptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.monthEmptyIcon}>🌅</Text>
            <Text style={[styles.monthEmptyText, { color: colors.textMuted }]}>
              Final de semana
            </Text>
            <Text style={[styles.monthEmptySubtext, { color: colors.textMuted }]}>
              Sem aulas neste dia
            </Text>
          </View>
        ) : selectedMonthLessons.length === 0 ? (
          // Dia útil sem aulas cadastradas
          <View style={[styles.monthEmptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.monthEmptyIcon}>📋</Text>
            <Text style={[styles.monthEmptyText, { color: colors.textMuted }]}>
              Nenhuma aula neste dia
            </Text>
            <Text style={[styles.monthEmptySubtext, { color: colors.textMuted }]}>
              Toque em "+ Aula" para adicionar
            </Text>
          </View>
        ) : (
          // Dia útil com aulas — repete para todas as semanas do mês
          selectedMonthLessons.map(lesson => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onPress={() => setDetailLesson(lesson)}
            />
          ))
        )}
      </View>
    );
  };

  const inputTheme = { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border };
  const chipTheme = { backgroundColor: colors.surfaceMuted, borderColor: colors.border };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={colors.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent={false}
      />

      {/* ── HEADER ── */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Agenda
          </Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            {viewMode === 'week' ? 'Horários fixos semanais' : 'Visão geral do mês'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.importButton,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
            onPress={openImport}
            activeOpacity={0.8}
          >
            <Text style={[styles.importButtonText, { color: colors.primary }]}>Importar</Text>
          </TouchableOpacity>

          {/* Segment control – compacto, no canto direito do header */}
          {renderSegmentControl()}
        </View>
      </View>

      {/* ── WEEK DAY TABS ── */}
      {viewMode === 'week' && (
        <View style={[styles.dayTabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {WEEKDAY_LABELS.map((label, i) => {
            const active = selectedDay === i;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.dayTab, active && { borderBottomWidth: 2.5, borderBottomColor: colors.primary }]}
                onPress={() => {
                  setSelectedDay(i);
                  setSelectedMonthDate(current => {
                    const next = new Date(current);
                    const currentWeekday = getWeekdayFromDate(next);
                    const delta = currentWeekday === null ? i : i - currentWeekday;
                    next.setDate(next.getDate() + delta);
                    return next;
                  });
                }}
              >
                <Text style={[
                  styles.dayTabLabel,
                  { color: colors.textMuted },
                  active && { color: colors.primary, fontWeight: '700' },
                ]}>{label}</Text>
                <Text style={[
                  styles.dayTabNum,
                  { color: colors.text },
                  active && { color: colors.primary, fontWeight: '700' },
                ]}>{weekDates[i]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── CONTENT ── */}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Month view */}
        {viewMode === 'month' && (
          <>
            {renderMonthCalendar()}
            {renderMonthDayLessons()}
          </>
        )}

        {/* Week view */}
        {viewMode === 'week' && (
          <>
            {activeWeekday === null ? (
              <View style={styles.emptyBox}>
                <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>Dia sem aulas cadastradas</Text>
              </View>
            ) : slots.length > 0 ? (
              slots.map(slot => {
                const slotLessons = dayLessons.filter(lesson => lesson.start_time === slot.start);

                return (
                  <View key={`${selectedDay}-${slot.start}`} style={styles.slotRow}>
                    <View style={styles.timeRail}>
                      <Text style={[styles.slotLabel, { color: colors.textMuted }]}>{slot.label}</Text>
                      <Text style={[styles.slotStart, { color: colors.text }]}>{slot.start}</Text>
                      <Text style={[styles.slotEnd, { color: colors.textMuted }]}>{slot.end}</Text>
                    </View>
                    <View style={styles.slotContent}>
                      {slotLessons.length > 0 ? (
                        slotLessons.map(lesson => (
                          <LessonCard
                            key={lesson.id}
                            lesson={lesson}
                            onPress={() => setDetailLesson(lesson)}
                          />
                        ))
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.emptySlot,
                            {
                              backgroundColor: colors.mode === 'dark' ? colors.surface : '#F7F6FF',
                              borderColor: colors.mode === 'dark' ? colors.border : '#C9C5F3',
                            },
                          ]}
                          onPress={() => openAdd(slot)}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.emptySlotTitle, { color: colors.secondary }]}>+ Aula</Text>
                          <Text style={[styles.emptySlotText, { color: colors.textMuted }]}>Adicionar turma neste horário</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyBox}>
                <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>Configure seus horários em Configurações</Text>
              </View>
            )}

            {extraLessons.length > 0 && (
              <View style={styles.extraSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Outros horários</Text>
                {extraLessons.map(lesson => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    onPress={() => setDetailLesson(lesson)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── LESSON DETAIL ── */}
      <LessonDetailSheet
        lesson={detailLesson}
        onClose={closeDetail}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <ScheduleImportSheet
        visible={showImportSheet}
        monthKey={activeDateISO}
        onClose={() => setShowImportSheet(false)}
        onImported={async message => {
          await load();
          showInfoDialog('Importação concluída', message);
        }}
      />

      {/* ── ADD / EDIT FORM ── */}
      <BottomSheetModal visible={showModal} onClose={closeForm} maxHeight="88%">
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{editingLesson ? 'Editar aula' : 'Nova aula'}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.saveBtn, { color: colors.primary }]}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <SheetScrollView>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Dia da semana</Text>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <TouchableOpacity
                key={label}
                style={[
                  styles.weekdayChip,
                  chipTheme,
                  form.weekday === i && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setForm(current => ({ ...current, weekday: i as Weekday }))}
              >
                <Text style={[styles.weekdayText, { color: colors.textMuted }, form.weekday === i && { color: '#FFF' }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Turma</Text>
          {classes.length === 0 ? (
            <Text style={[styles.formHint, { color: colors.textMuted }]}>Cadastre uma turma antes de adicionar aulas.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 14 }}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              {classes.map(classItem => (
                <TouchableOpacity
                  key={classItem.id}
                  style={[
                    styles.chip,
                    chipTheme,
                    form.class_id === classItem.id && {
                      backgroundColor: classItem.color,
                      borderColor: classItem.color,
                    },
                  ]}
                  onPress={() => {
                    setForm(current => ({ ...current, class_id: classItem.id }));
                    if (formErrors.class_id) setFormErrors(current => ({ ...current, class_id: undefined }));
                  }}
                >
                  <Text style={[styles.chipText, { color: colors.text }, form.class_id === classItem.id && { color: '#FFF' }]}>
                    {classItem.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {formErrors.class_id ? <Text style={styles.errorText}>{formErrors.class_id}</Text> : null}

          {!editingLesson && (
            <>
              <TouchableOpacity
                style={[styles.multiSlotToggle, {
                  backgroundColor: multiSlotEnabled
                    ? (colors.mode === 'dark' ? `${colors.primary}22` : '#E6F0F8')
                    : colors.surfaceMuted,
                  borderColor: multiSlotEnabled ? colors.primary : colors.border,
                }]}
                onPress={() => {
                  const next = !multiSlotEnabled;
                  setMultiSlotEnabled(next);
                  setFormErrors(current => ({ ...current, slots: undefined, time: undefined }));
                  if (next) {
                    const currentSlot = slots.find(s => s.start === form.start_time);
                    if (currentSlot) {
                      setSelectedSlotKeys(new Set([currentSlot.start]));
                      if (formErrors.slots) setFormErrors(current => ({ ...current, slots: undefined }));
                    }
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={styles.multiSlotToggleRow}>
                  <View style={[styles.multiSlotCheckbox, {
                    backgroundColor: multiSlotEnabled ? colors.primary : 'transparent',
                    borderColor: multiSlotEnabled ? colors.primary : colors.textMuted,
                  }]}>
                    {multiSlotEnabled && <Text style={styles.multiSlotCheckMark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.multiSlotToggleLabel, { color: colors.text }]}>
                      Esta turma ocupa mais de um horário
                    </Text>
                    <Text style={[styles.multiSlotToggleSub, { color: colors.textMuted }]}>
                      Selecione todos os horários do mesmo dia
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {multiSlotEnabled ? (
                <View style={styles.multiSlotGrid}>
                  {slots.map(slot => {
                    const checked = selectedSlotKeys.has(slot.start);
                    return (
                      <TouchableOpacity
                        key={slot.start}
                        style={[styles.multiSlotChip, {
                          backgroundColor: checked
                            ? (colors.mode === 'dark' ? `${colors.primary}28` : '#E6F0F8')
                            : colors.surface,
                          borderColor: checked ? colors.primary : colors.border,
                        }]}
                        onPress={() => {
                          setSelectedSlotKeys(prev => {
                            const next = new Set(prev);
                            if (next.has(slot.start)) next.delete(slot.start);
                            else next.add(slot.start);
                            return next;
                          });
                          if (formErrors.slots) setFormErrors(current => ({ ...current, slots: undefined }));
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.multiSlotChipCheck, {
                          backgroundColor: checked ? colors.primary : 'transparent',
                          borderColor: checked ? colors.primary : colors.border,
                        }]}>
                          {checked && <Text style={styles.multiSlotCheckMark}>✓</Text>}
                        </View>
                        <View>
                          <Text style={[styles.timeChipLabel, { color: checked ? colors.primary : colors.textMuted }]}>
                            {slot.label}
                          </Text>
                          <Text style={[styles.timeChipText, { color: checked ? colors.primary : colors.text }]}>
                            {slot.start}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 14 }}
                  contentContainerStyle={{ paddingRight: 16 }}
                >
                  {slots.map(slot => {
                    const active = form.start_time === slot.start;
                    return (
                      <TouchableOpacity
                        key={`${slot.start}-${slot.end}`}
                        style={[
                          styles.timeChip,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                          active && {
                            backgroundColor: colors.mode === 'dark' ? `${colors.primary}22` : '#E6F0F8',
                            borderColor: colors.primary,
                          },
                        ]}
                        onPress={() => {
                          setForm(current => ({
                            ...current,
                            start_time: slot.start,
                            end_time: slot.end,
                          }));
                          if (formErrors.time) setFormErrors(current => ({ ...current, time: undefined }));
                        }}
                      >
                        <Text style={[styles.timeChipLabel, { color: colors.textMuted }, active && { color: colors.primary }]}>{slot.label}</Text>
                        <Text style={[styles.timeChipText, { color: colors.text }, active && { color: colors.primary }]}>
                          {slot.start}-{slot.end}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              {formErrors.slots ? <Text style={styles.errorText}>{formErrors.slots}</Text> : null}
            </>
          )}

          {(!multiSlotEnabled || editingLesson) && (
          <View style={styles.timeRow}>
            <View style={styles.timeBox}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Início</Text>
              <TimeInput
                style={[styles.timeInput, inputTheme, { color: colors.primary, borderColor: colors.primary }]}
                value={form.start_time}
                onChangeText={value => {
                  setForm(current => ({ ...current, start_time: value }));
                  if (formErrors.time) setFormErrors(current => ({ ...current, time: undefined }));
                }}
                placeholder="07:30"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.timeBox}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Término</Text>
              <TimeInput
                style={[styles.timeInput, inputTheme, { color: colors.primary, borderColor: colors.primary }]}
                value={form.end_time}
                onChangeText={value => {
                  setForm(current => ({ ...current, end_time: value }));
                  if (formErrors.time) setFormErrors(current => ({ ...current, time: undefined }));
                }}
                placeholder="08:18"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
          )}
          {formErrors.time ? <Text style={styles.errorText}>{formErrors.time}</Text> : null}

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Conteúdo</Text>
          <TextInput
            style={[styles.input, inputTheme]}
            value={form.content}
            onChangeText={value => setForm(current => ({ ...current, content: value }))}
            placeholder="Ex: Verbo To Be - afirmativo e negativo"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <PreparedContentToggle
            value={form.conteudo_preparado === 1}
            onChange={value => setForm(current => ({
              ...current,
              conteudo_preparado: value ? 1 : 0,
            }))}
          />

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Atividade</Text>
          <LessonActivitySelector
            options={lessonActivityOptions}
            selected={parseLessonActivities(form.activity)}
            onChange={values => setForm(current => ({ ...current, activity: stringifyLessonActivities(values) }))}
            onCreateCustom={createCustomLessonActivity}
            onDeleteCustom={handleDeleteCustomLessonActivity}
          />

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Status</Text>
          <View style={styles.statusRow}>
            {LESSON_STATUS_OPTIONS.map(status => {
              const active = form.status === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusChip,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setForm(current => ({ ...current, status }))}
                >
                  <Text style={[
                    styles.statusText,
                    { color: colors.text },
                    active && { color: '#FFF', fontWeight: '800' },
                  ]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Observações</Text>
          <TextInput
            style={[styles.input, inputTheme, { minHeight: 64 }]}
            value={form.notes}
            onChangeText={value => setForm(current => ({ ...current, notes: value }))}
            placeholder="Observações opcionais"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          {editingLesson && (
            <TouchableOpacity
              style={[styles.deleteFullBtn, { backgroundColor: colors.mode === 'dark' ? '#3A1F24' : '#FDEDEC' }]}
              onPress={() => handleDelete(editingLesson)}
            >
              <Text style={styles.deleteFullBtnText}>Excluir aula</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </SheetScrollView>
      </BottomSheetModal>

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        variant={confirmDialog.variant}
        onCancel={closeConfirmDialog}
        onConfirm={confirmAndClose}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  importButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  importButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },

  // ── Segment Control ──
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginLeft: 12,
  },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Day tabs (week view) ──
  dayTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  dayTab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  dayTabLabel: { fontSize: 11, fontWeight: '500' },
  dayTabNum: { fontSize: 15, fontWeight: '500', marginTop: 2 },

  // ── Body ──
  body: { padding: 16 },

  // ── Slot row (week view) ──
  slotRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  timeRail: { width: 58, alignItems: 'flex-end', paddingTop: 8 },
  slotLabel: { fontSize: 10, fontWeight: '700', marginBottom: 3 },
  slotStart: { fontSize: 13, fontWeight: '700' },
  slotEnd: { fontSize: 11, marginTop: 2 },
  slotContent: { flex: 1 },
  emptySlot: {
    minHeight: 74, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', padding: 10,
  },
  emptySlotTitle: { fontSize: 13, fontWeight: '700' },
  emptySlotText: { fontSize: 11, marginTop: 2 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, marginBottom: 16, textAlign: 'center' },
  extraSection: { marginTop: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },

  // ── Month calendar ──
  monthPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavText: { fontSize: 22, fontWeight: '700', lineHeight: 26 },
  monthTitle: { fontSize: 16, fontWeight: '700' },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekCell: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 4,
  },
  calendarWeekText: {
    fontSize: 12,
    fontWeight: '600',
  },
  monthGrid: {
    gap: 2,
  },
  monthWeekRow: {
    flexDirection: 'row',
  },
  monthCell: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    paddingVertical: 3,
  },
  monthDayMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  monthDotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    height: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLessonDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // ── Month day lessons section ──
  monthDaySection: {
    marginBottom: 10,
  },
  monthDaySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthDaySectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    textTransform: 'capitalize',
  },
  monthAddBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginLeft: 12,
  },
  monthAddBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  monthEmptyBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  monthEmptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  monthEmptyText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  monthEmptySubtext: {
    fontSize: 13,
  },

  // ── Form / Sheet ──
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  saveBtn: { fontSize: 15, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  errorText: { color: '#C0392B', fontSize: 12, fontWeight: '700', marginTop: -6, marginBottom: 12 },
  weekdayRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  weekdayChip: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5,
  },
  weekdayText: { fontSize: 12, fontWeight: '700' },
  formHint: { fontSize: 12, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  timeChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8,
    borderWidth: 1.5,
  },
  timeChipLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  timeChipText: { fontSize: 12, fontWeight: '700' },
  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  timeBox: { flex: 1 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statusChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 9,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  timeInput: {
    borderRadius: 10, padding: 12, fontSize: 18,
    fontWeight: '600', borderWidth: 1.5, textAlign: 'center',
  },
  input: {
    borderRadius: 10, padding: 12, fontSize: 14,
    borderWidth: 1, marginBottom: 14, minHeight: 44,
  },
  deleteFullBtn: {
    alignItems: 'center', paddingVertical: 12, borderRadius: 10, marginTop: 2,
  },
  deleteFullBtnText: { color: '#C0392B', fontWeight: '700', fontSize: 14 },

  // ── Legacy (kept for compat) ──
  floatingModalRoot: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 18 },
  floatingBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.34)' },
  detailSheet: { borderRadius: 22, borderWidth: 1, padding: 20, paddingBottom: 22 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  detailTime: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  detailTitle: { fontSize: 18, fontWeight: '700' },
  colorDot: { width: 16, height: 16, borderRadius: 8 },
  detailBlock: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 10 },
  detailGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  detailItem: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, minHeight: 82 },
  detailLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  detailText: { fontSize: 13, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  primaryBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10 },
  primaryBtnText: { fontSize: 13, color: '#FFF', fontWeight: '700' },
  dangerBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10 },
  dangerBtnText: { fontSize: 13, color: '#C0392B', fontWeight: '700' },

  // ── Multi-slot ──
  multiSlotToggle: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 14,
  },
  multiSlotToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  multiSlotToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  multiSlotToggleSub: {
    fontSize: 12,
    marginTop: 2,
  },
  multiSlotCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  multiSlotCheckMark: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '800',
    lineHeight: 16,
  },
  multiSlotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  multiSlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: '30%',
  },
  multiSlotChipCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
