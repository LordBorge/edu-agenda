import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getProfessionalProfile,
  getScheduleSettingsForPeriod,
  markInitialScheduleSetupComplete,
  updateProfessionalProfile,
  updateScheduleSettings,
} from '../../database/queries';
import { SchedulePeriod, ScheduleSettings, ThemePreference } from '../../types';
import { generateScheduleSlots, isCompleteTime, minutesToTime, ScheduleSlot, timeToMinutes } from '../../utils/time';
import { useAppTheme } from '../../theme';
import { TimeInput } from '../../components/TimeInput';
import { ConfirmDialog, type ConfirmDialogVariant } from '../../components/ConfirmDialog';

type PersistedSettingsForm = Omit<ScheduleSettings, 'id'>;
type SchedulePreviewForm = PersistedSettingsForm & {
  lunch_end_time?: string;
};
type SettingsForm = PersistedSettingsForm & {
  lunch_end_time: string;
};
type ProfileForm = { name: string; subjects: string; work_periods: string; theme_preference: ThemePreference };
type SettingsFormErrors = {
  name?: string;
  subjects?: string;
  time?: string;
  lesson_duration?: string;
  lunch?: string;
  slots?: string;
};
type PerfilScreenProps = {
  setupLocked?: boolean;
  showSetupReminder?: boolean;
  onSetupComplete?: () => void;
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

const PERIODS: Array<{ key: SchedulePeriod; label: string }> = [
  { key: 'integral', label: 'Integral' },
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
];

const DEFAULT_FORM: SettingsForm = {
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
  lunch_end_time: '13:00',
  afternoon_break_duration: 20,
  afternoon_break_after_lesson: 3,
};

const DEFAULT_PROFILE: ProfileForm = {
  name: '',
  subjects: '',
  work_periods: 'integral',
  theme_preference: 'system',
};

const THEME_OPTIONS: Array<{ key: ThemePreference; label: string }> = [
  { key: 'system', label: 'Sistema' },
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Escuro' },
];

function getLunchEndTime(lunchStart: string, lunchDuration: number): string {
  const lunchStartMin = timeToMinutes(lunchStart);
  if (!Number.isFinite(lunchStartMin)) return '';
  return minutesToTime(lunchStartMin + Math.max(lunchDuration, 0));
}

function getLunchDurationFromForm(form: SchedulePreviewForm): number {
  if (!form.lunch_end_time) return form.lunch_duration;

  const lunchStartMin = timeToMinutes(form.lunch_start);
  const lunchEndMin = timeToMinutes(form.lunch_end_time);
  if (!Number.isFinite(lunchStartMin) || !Number.isFinite(lunchEndMin)) {
    return form.lunch_duration;
  }
  return Math.max(lunchEndMin - lunchStartMin, 0);
}

function settingsFromForm(form: SettingsForm): PersistedSettingsForm {
  const { lunch_end_time: _lunchEndTime, ...settings } = form;
  return settings;
}

function buildSlots(form: SchedulePreviewForm): ScheduleSlot[] {
  return generateScheduleSlots({
    period: form.period,
    startTime: form.start_time,
    endTime: form.end_time,
    morningStartTime: form.morning_start_time,
    morningEndTime: form.morning_end_time,
    afternoonStartTime: form.afternoon_start_time,
    afternoonEndTime: form.afternoon_end_time,
    lessonDuration: form.lesson_duration,
    breakDuration: form.break_duration,
    breakAfterLesson: form.break_after_lesson,
    lunchStart: form.lunch_start,
    lunchDuration: getLunchDurationFromForm(form),
    afternoonBreakDuration: form.afternoon_break_duration,
    afternoonBreakAfterLesson: form.afternoon_break_after_lesson,
  });
}

function formFromSettings(settings: ScheduleSettings): SettingsForm {
  return {
    period: settings.period,
    start_time: settings.start_time,
    end_time: settings.end_time,
    morning_start_time: settings.morning_start_time,
    morning_end_time: settings.morning_end_time,
    afternoon_start_time: settings.afternoon_start_time,
    afternoon_end_time: settings.afternoon_end_time,
    lesson_duration: settings.lesson_duration,
    break_duration: settings.break_duration,
    break_after_lesson: settings.break_after_lesson,
    lunch_start: settings.lunch_start,
    lunch_duration: settings.lunch_duration,
    lunch_end_time: getLunchEndTime(settings.lunch_start, settings.lunch_duration),
    afternoon_break_duration: settings.afternoon_break_duration,
    afternoon_break_after_lesson: settings.afternoon_break_after_lesson,
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ED';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalizeWorkPeriod(workPeriods: string): SchedulePeriod {
  const periods = workPeriods.split(',').filter(Boolean) as SchedulePeriod[];
  if (periods.includes('integral')) return 'integral';
  if (periods.includes('manha') && periods.includes('tarde')) return 'integral';
  return periods[0] ?? 'integral';
}

export function PerfilScreen({
  setupLocked = false,
  showSetupReminder = false,
  onSetupComplete,
}: PerfilScreenProps) {
  const { colors, setPreference } = useAppTheme();
  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM);
  const [profileForm, setProfileForm] = useState<ProfileForm>(DEFAULT_PROFILE);
  const [slots, setSlots] = useState<ScheduleSlot[]>(() => buildSlots(DEFAULT_FORM));
  const [saved, setSaved] = useState(false);
  const [setupReminderShown, setSetupReminderShown] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(EMPTY_CONFIRM_DIALOG);
  const [formErrors, setFormErrors] = useState<SettingsFormErrors>({});

  const closeConfirmDialog = () => setConfirmDialog(EMPTY_CONFIRM_DIALOG);

  const confirmAndClose = async () => {
    const action = confirmDialog.onConfirm;
    closeConfirmDialog();
    await action();
  };

  useEffect(() => {
    if (!showSetupReminder || setupReminderShown) return undefined;

    const timer = setTimeout(() => {
      setSetupReminderShown(true);
      setConfirmDialog({
        visible: true,
        title: 'Configure seus horários',
        message: 'Defina o horário de início e término das aulas, duração dos períodos, intervalos e almoço para que sua agenda fique correta.',
        confirmLabel: 'Entendi',
        cancelLabel: null,
        variant: 'info',
        onConfirm: () => undefined,
      });
    }, 450);

    return () => clearTimeout(timer);
  }, [setupReminderShown, showSetupReminder]);

  const commitForm = (next: SettingsForm) => {
    setForm(next);
    setSaved(false);
    setSlots(buildSlots(next));
  };

  const load = useCallback(async () => {
    const profile = await getProfessionalProfile();
    const period = normalizeWorkPeriod(profile.work_periods);
    const settings = await getScheduleSettingsForPeriod(period);
    const next = formFromSettings(settings);
    setForm(next);
    setProfileForm({
      name: profile.name,
      subjects: profile.subjects,
      work_periods: period,
      theme_preference: profile.theme_preference ?? 'system',
    });
    setSlots(buildSlots(next));
  }, []);


  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePeriodChange = async (period: SchedulePeriod) => {
    const settings = await getScheduleSettingsForPeriod(period);
    setProfileForm(current => ({ ...current, work_periods: period }));
    commitForm(formFromSettings(settings));
  };

  const updateField = (key: keyof SettingsForm, value: string | number) => {
    const next = { ...form, [key]: value } as SettingsForm;
    if (['start_time', 'end_time'].includes(String(key))) {
      setFormErrors(current => ({ ...current, time: undefined, slots: undefined }));
    }
    if (['lunch_start', 'lunch_end_time'].includes(String(key))) {
      setFormErrors(current => ({ ...current, lunch: undefined, slots: undefined }));
    }
    commitForm(next);
  };

  const updateNumberField = (
    key: 'lesson_duration' | 'break_duration' | 'break_after_lesson' |
      'afternoon_break_duration' | 'afternoon_break_after_lesson',
    value: string
  ) => {
    const parsed = parseInt(value, 10);
    setFormErrors(current => ({
      ...current,
      lesson_duration: key === 'lesson_duration' ? undefined : current.lesson_duration,
      slots: undefined,
    }));
    updateField(key, Number.isNaN(parsed) ? 0 : parsed);
  };

  const handleSave = async () => {
    const nextErrors: SettingsFormErrors = {};

    if (!profileForm.name.trim()) {
      nextErrors.name = 'Informe seu nome';
    }

    if (!profileForm.subjects.trim()) {
      nextErrors.subjects = 'Informe pelo menos um componente curricular';
    }

    const settingsToSave: PersistedSettingsForm = {
      ...settingsFromForm(form),
      lunch_duration: getLunchDurationFromForm(form),
    };

    if (form.period === 'integral') {
      settingsToSave.morning_start_time = form.start_time;
      settingsToSave.morning_end_time = form.lunch_start;
      settingsToSave.afternoon_start_time = form.lunch_end_time;
      settingsToSave.afternoon_end_time = form.end_time;
    } else if (form.period === 'manha') {
      settingsToSave.morning_start_time = form.start_time;
      settingsToSave.morning_end_time = form.end_time;
    } else {
      settingsToSave.afternoon_start_time = form.start_time;
      settingsToSave.afternoon_end_time = form.end_time;
    }

    const timeFields = [
      { label: 'horário de início', value: settingsToSave.start_time },
      { label: 'horário de término', value: settingsToSave.end_time },
      ...(settingsToSave.period === 'integral' ? [
        { label: 'saída para o almoço', value: settingsToSave.lunch_start },
        { label: 'retorno do almoço', value: form.lunch_end_time },
      ] : []),
    ];
    const invalidTime = timeFields.find(field => !isCompleteTime(field.value));

    if (invalidTime) {
      if (invalidTime.label.includes('almoço')) {
        nextErrors.lunch = `Informe o ${invalidTime.label} no formato HH:MM`;
      } else {
        nextErrors.time = `Informe o ${invalidTime.label} no formato HH:MM`;
      }
    }

    const startMin = timeToMinutes(settingsToSave.start_time);
    const endMin = timeToMinutes(settingsToSave.end_time);

    if (startMin >= endMin) {
      nextErrors.time = 'O horário de início precisa ser menor que o horário de término';
    }

    if (settingsToSave.lesson_duration <= 0) {
      nextErrors.lesson_duration = 'Informe uma duração de aula maior que zero';
    }

    if (settingsToSave.period === 'integral') {
      const lunchStartMin = timeToMinutes(settingsToSave.lunch_start);
      const lunchEndMin = timeToMinutes(form.lunch_end_time);

      if (lunchStartMin <= startMin) {
        nextErrors.lunch = 'A saída para o almoço deve ser após o início das aulas';
      }

      if (lunchEndMin <= lunchStartMin) {
        nextErrors.lunch = 'O retorno do almoço deve ser após a saída para o almoço';
      }

      if (lunchEndMin >= endMin) {
        nextErrors.lunch = 'O retorno do almoço deve ser anterior ao término do dia';
      }
    }

    if (buildSlots(settingsToSave).length === 0) {
      nextErrors.slots = 'A configuração atual não gerou nenhum horário. Revise a duração das aulas e os horários de trabalho';
    }

    if (
      nextErrors.name || nextErrors.subjects || nextErrors.time ||
      nextErrors.lesson_duration || nextErrors.lunch || nextErrors.slots
    ) {
      setFormErrors(nextErrors);
      return;
    }

    await Promise.all([
      updateScheduleSettings(settingsToSave),
      updateProfessionalProfile({
        name: profileForm.name.trim(),
        subjects: profileForm.subjects.trim(),
        work_periods: normalizeWorkPeriod(profileForm.work_periods),
        theme_preference: profileForm.theme_preference,
        onboarded: 1,
      }),
      markInitialScheduleSetupComplete(),
    ]);
    const [persistedSettings, persistedProfile] = await Promise.all([
      getScheduleSettingsForPeriod(settingsToSave.period),
      getProfessionalProfile(),
    ]);
    const persisted = formFromSettings(persistedSettings);
    setForm(persisted);
    setProfileForm({
      name: persistedProfile.name,
      subjects: persistedProfile.subjects,
      work_periods: normalizeWorkPeriod(persistedProfile.work_periods),
      theme_preference: persistedProfile.theme_preference ?? 'system',
    });
    setSlots(buildSlots(persisted));
    setPreference(persistedProfile.theme_preference ?? 'system');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSetupComplete?.();
  };

  const handleThemeChange = async (themePreference: ThemePreference) => {
    setSaved(false);
    setPreference(themePreference);
    setProfileForm(current => ({ ...current, theme_preference: themePreference }));

    const persistedProfile = await getProfessionalProfile();
    await updateProfessionalProfile({
      name: persistedProfile.name,
      subjects: persistedProfile.subjects,
      work_periods: persistedProfile.work_periods,
      theme_preference: themePreference,
      onboarded: persistedProfile.onboarded,
    });
  };

  const workPeriod = normalizeWorkPeriod(profileForm.work_periods);
  const inputTheme = { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border };
  const fieldLabelTheme = { color: colors.textMuted };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={colors.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent={false}
      />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Configurações</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saved ? colors.secondary : colors.primary }]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>{saved ? 'Salvo' : setupLocked ? 'Concluir' : 'Salvar'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.profileAvatarText}>{initials(profileForm.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: colors.text }]}>{profileForm.name.trim() || 'Seus dados'}</Text>
            <Text style={[styles.profileSub, { color: colors.textMuted }]}>{profileForm.subjects.trim() || 'Componentes Curriculares não informados'}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Seus dados</Text>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Nome</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          value={profileForm.name}
          onChangeText={value => {
            setSaved(false);
            setProfileForm(current => ({ ...current, name: value }));
            if (formErrors.name) setFormErrors(current => ({ ...current, name: undefined }));
          }}
          placeholder="Ex.: Ana Paula"
          autoCapitalize="words"
        />
        {formErrors.name ? <Text style={styles.errorText}>{formErrors.name}</Text> : null}

        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Componentes Curriculares</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          value={profileForm.subjects}
          onChangeText={value => {
            setSaved(false);
            setProfileForm(current => ({ ...current, subjects: value }));
            if (formErrors.subjects) setFormErrors(current => ({ ...current, subjects: undefined }));
          }}
          placeholder="Ex.: Inglês, Projeto de Vida, Redação"
          multiline
        />
        {formErrors.subjects ? <Text style={styles.errorText}>{formErrors.subjects}</Text> : null}

        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Período em que trabalha</Text>
        <View style={styles.periodRow}>
          {PERIODS.map(period => {
            const active = workPeriod === period.key;
            return (
              <TouchableOpacity
                key={period.key}
                style={[
                  styles.periodBtn,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => handlePeriodChange(period.key)}
              >
                <Text style={[styles.periodText, { color: colors.textMuted }, active && styles.periodTextActive]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tema do aplicativo</Text>
        <View style={styles.periodRow}>
          {THEME_OPTIONS.map(option => {
            const active = profileForm.theme_preference === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.periodBtn,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => {
                  handleThemeChange(option.key);
                }}
              >
                <Text style={[styles.periodText, { color: colors.textMuted }, active && styles.periodTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Horários</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeBox}>
            <Text style={[styles.fieldLabel, fieldLabelTheme]}>Início</Text>
            <TimeInput
              style={[styles.timeInput, inputTheme, { color: colors.primary, borderColor: colors.primary }]}
              value={form.start_time}
              onChangeText={value => updateField('start_time', value)}
              placeholder="07:30"
            />
          </View>
          <View style={styles.timeBox}>
            <Text style={[styles.fieldLabel, fieldLabelTheme]}>Término</Text>
            <TimeInput
              style={[styles.timeInput, inputTheme, { color: colors.primary, borderColor: colors.primary }]}
              value={form.end_time}
              onChangeText={value => updateField('end_time', value)}
              placeholder="17:00"
            />
          </View>
        </View>
        {formErrors.time ? <Text style={styles.errorText}>{formErrors.time}</Text> : null}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Duração das aulas</Text>
        <View style={styles.durationRow}>
          {[40, 45, 48, 50, 60].map(duration => (
            <TouchableOpacity
              key={duration}
              style={[
                styles.durationChip,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                form.lesson_duration === duration && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => updateField('lesson_duration', duration)}
            >
              <Text style={[styles.durationText, { color: colors.textMuted }, form.lesson_duration === duration && styles.durationTextActive]}>
                {duration}min
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {formErrors.lesson_duration ? <Text style={styles.errorText}>{formErrors.lesson_duration}</Text> : null}

        {/* Intervalo da manhã (Integral) ou Intervalo (Manhã) */}
        {(form.period === 'integral' || form.period === 'manha') && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {form.period === 'integral' ? 'Intervalo da manhã' : 'Intervalo'}
            </Text>
            <View style={styles.timeRow}>
              <View style={styles.timeBox}>
                <Text style={[styles.fieldLabel, fieldLabelTheme]}>Duração (min)</Text>
                <TextInput
                  style={[styles.smallInput, inputTheme]}
                  value={String(form.break_duration)}
                  onChangeText={value => updateNumberField('break_duration', value)}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.timeBox}>
                <Text style={[styles.fieldLabel, fieldLabelTheme]}>Após qual aula</Text>
                <TextInput
                  style={[styles.smallInput, inputTheme]}
                  value={String(form.break_after_lesson)}
                  onChangeText={value => updateNumberField('break_after_lesson', value)}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </>
        )}
        {form.period === 'integral' && formErrors.lunch ? <Text style={styles.errorText}>{formErrors.lunch}</Text> : null}

        {form.period === 'integral' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Almoço</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeBox}>
                <Text style={[styles.fieldLabel, fieldLabelTheme]}>Saída para o almoço</Text>
                <TimeInput
                  style={[styles.timeInput, inputTheme, { color: colors.primary, borderColor: colors.primary }]}
                  value={form.lunch_start}
                  onChangeText={value => updateField('lunch_start', value)}
                  placeholder="11:50"
                />
              </View>
              <View style={styles.timeBox}>
                <Text style={[styles.fieldLabel, fieldLabelTheme]}>Retorno do almoço</Text>
                <TimeInput
                  style={[styles.timeInput, inputTheme, { color: colors.primary, borderColor: colors.primary }]}
                  value={form.lunch_end_time}
                  onChangeText={value => updateField('lunch_end_time', value)}
                  placeholder="13:28"
                />
              </View>
            </View>
          </>
        )}

        {(form.period === 'integral' || form.period === 'tarde') && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {form.period === 'integral' ? 'Intervalo da tarde' : 'Intervalo'}
            </Text>
            <View style={styles.timeRow}>
              <View style={styles.timeBox}>
                <Text style={[styles.fieldLabel, fieldLabelTheme]}>Duração (min)</Text>
                <TextInput
                  style={[styles.smallInput, inputTheme]}
                  value={String(form.afternoon_break_duration)}
                  onChangeText={value => updateNumberField('afternoon_break_duration', value)}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.timeBox}>
                <Text style={[styles.fieldLabel, fieldLabelTheme]}>Após qual aula</Text>
                <TextInput
                  style={[styles.smallInput, inputTheme]}
                  value={String(form.afternoon_break_after_lesson)}
                  onChangeText={value => updateNumberField('afternoon_break_after_lesson', value)}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Prévia dos horários ({slots.length} aulas por dia)</Text>
        {formErrors.slots ? <Text style={styles.errorText}>{formErrors.slots}</Text> : null}
        <View style={[styles.previewBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {slots.length === 0 ? (
            <Text style={[styles.previewEmpty, { color: colors.textMuted }]}>Ajuste os horários para gerar a prévia.</Text>
          ) : (
            slots.map((slot, index) => (
              <View key={`${slot.start}-${index}`} style={styles.previewRow}>
                <View style={styles.previewTime}>
                  <Text style={[styles.previewTimeText, { color: colors.textMuted }]}>{slot.start}</Text>
                </View>
                <View style={[
                  styles.previewBar,
                  {
                    backgroundColor: colors.mode === 'dark' ? `${colors.primary}22` : '#E6F0F8',
                    borderLeftColor: colors.primary,
                  },
                  slot.segment === 'tarde' && {
                    backgroundColor: colors.mode === 'dark' ? `${colors.secondary}22` : '#E0F7F4',
                    borderLeftColor: colors.secondary,
                  },
                ]}>
                  <Text style={[
                    styles.previewLabel,
                    { color: colors.primary },
                    slot.segment === 'tarde' && { color: colors.secondary },
                  ]}>
                    {slot.label}
                  </Text>
                  <Text style={[styles.previewSegment, { color: colors.textMuted }]}>{slot.segment === 'manha' ? 'Manhã' : 'Tarde'}</Text>
                </View>
                <Text style={[styles.previewEnd, { color: colors.textMuted }]}>{slot.end}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
      </KeyboardAvoidingView>

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
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  keyboard: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#EFEFEF',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  saveBtn: { backgroundColor: '#0F4C81', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnDone: { backgroundColor: '#14B8A6' },
  saveBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  body: { padding: 16 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#0F4C81', alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { color: '#E0F7F4', fontWeight: '700', fontSize: 18 },
  profileName: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  profileSub: { fontSize: 12, color: '#888', marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', marginBottom: 10, marginTop: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#888', marginBottom: 6, textTransform: 'uppercase' },
  errorText: { color: '#C0392B', fontSize: 12, fontWeight: '700', marginTop: -6, marginBottom: 12 },
  input: {
    backgroundColor: '#FFF', borderRadius: 10, padding: 12, fontSize: 14,
    color: '#333', borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 14,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  periodBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#F0F0F0', borderWidth: 1.5, borderColor: '#E0E0E0',
  },
  periodBtnActive: { backgroundColor: '#0F4C81', borderColor: '#0F4C81' },
  periodText: { fontSize: 13, fontWeight: '600', color: '#666' },
  periodTextActive: { color: '#FFF' },
  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  timeBox: { flex: 1 },
  timeInput: {
    backgroundColor: '#FFF', borderRadius: 10, padding: 12, fontSize: 20,
    fontWeight: '700', color: '#0F4C81', borderWidth: 1.5, borderColor: '#0F4C81',
    textAlign: 'center',
  },
  smallInput: {
    backgroundColor: '#FFF', borderRadius: 10, padding: 12, fontSize: 18,
    fontWeight: '600', color: '#333', borderWidth: 1, borderColor: '#DDD',
    textAlign: 'center',
  },
  durationRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  durationChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#F0F0F0', borderWidth: 1.5, borderColor: '#E0E0E0',
  },
  durationChipActive: { backgroundColor: '#0F4C81', borderColor: '#0F4C81' },
  durationText: { fontSize: 12, fontWeight: '600', color: '#666' },
  durationTextActive: { color: '#FFF' },
  previewBox: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#EFEFEF',
  },
  previewEmpty: { fontSize: 12, color: '#888', textAlign: 'center', paddingVertical: 18 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  previewTime: { width: 42, alignItems: 'flex-end' },
  previewTimeText: { fontSize: 11, color: '#888', fontWeight: '500' },
  previewBar: {
    flex: 1, backgroundColor: '#E6F0F8', borderRadius: 6, paddingVertical: 5,
    paddingHorizontal: 10, borderLeftWidth: 3, borderLeftColor: '#0F4C81',
  },
  previewBarAfternoon: { backgroundColor: '#E0F7F4', borderLeftColor: '#14B8A6' },
  previewLabel: { fontSize: 11, color: '#0F4C81', fontWeight: '600' },
  previewLabelAfternoon: { color: '#14B8A6' },
  previewSegment: { fontSize: 10, color: '#888', marginTop: 1 },
  previewEnd: { fontSize: 10, color: '#AAA', width: 36 },
});
