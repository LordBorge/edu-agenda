import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, Alert,
} from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getActivities, createActivity, toggleActivity, deleteActivity,
  updateActivity, getReminders, createReminder, toggleReminder, deleteReminder,
  updateReminder, getClasses, getActivityTypes, createActivityType,
  getActivityTypeUsageCount, deleteCustomActivityType,
} from '../../database/queries';
import { Activity, Reminder, Class, ActivityType, ActivityTypeOption } from '../../types';
import { ACTIVITY_TYPE_COLORS, getActivityTypeVisual } from '../../utils/colors';
import { formatDate, daysFromNow, todayISO } from '../../utils/time';
import { useAppTheme } from '../../theme';
import { DatePickerField } from '../../components/DatePickerField';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const TABS = ['Atividades', 'Lembretes'];
type ConfirmDialogState = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
};

const EMPTY_CONFIRM_DIALOG: ConfirmDialogState = {
  visible: false,
  title: '',
  message: '',
  onConfirm: () => undefined,
};

function formatActivityTypeUsageMessage(count: number): string {
  const usageText = count === 1 ? '1 atividade' : `${count} atividades`;
  return `Este tipo está sendo usado em ${usageText}. Ao excluir, essas atividades voltarão para "Atividade".`;
}

export function AtividadesScreen({ navigation, route }: any) {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeOption[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [customTypeMode, setCustomTypeMode] = useState(false);
  const [customTypeName, setCustomTypeName] = useState('');
  const [customTypeColor, setCustomTypeColor] = useState(ACTIVITY_TYPE_COLORS[0]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(EMPTY_CONFIRM_DIALOG);

  // Activity form
  const [aForm, setAForm] = useState({
    class_id: null as number | null,
    type: 'atividade' as ActivityType,
    title: '',
    description: '',
    due_date: todayISO(),
  });

  // Reminder form
  const [rForm, setRForm] = useState({ title: '', description: '', date: todayISO() });

  const resetActivityForm = () => {
    setAForm({ class_id: null, type: 'atividade', title: '', description: '', due_date: todayISO() });
    setCustomTypeMode(false);
    setCustomTypeName('');
    setCustomTypeColor(ACTIVITY_TYPE_COLORS[0]);
  };

  const resetReminderForm = () => {
    setRForm({ title: '', description: '', date: todayISO() });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingActivity(null);
    setEditingReminder(null);
  };

  const closeConfirmDialog = () => setConfirmDialog(EMPTY_CONFIRM_DIALOG);

  const confirmAndClose = async () => {
    const action = confirmDialog.onConfirm;
    closeConfirmDialog();
    await action();
  };

  const openAdd = () => {
    setEditingActivity(null);
    setEditingReminder(null);
    if (tab === 0) {
      resetActivityForm();
    } else {
      resetReminderForm();
    }
    setShowModal(true);
  };

  const openEditActivity = (activity: Activity) => {
    setTab(0);
    setEditingActivity(activity);
    setEditingReminder(null);
    setCustomTypeMode(false);
    setCustomTypeName('');
    setAForm({
      class_id: activity.class_id,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      due_date: activity.due_date,
    });
    setShowModal(true);
  };

  const openEditReminder = (reminder: Reminder) => {
    setTab(1);
    setEditingReminder(reminder);
    setEditingActivity(null);
    setRForm({
      title: reminder.title,
      description: reminder.description,
      date: reminder.date,
    });
    setShowModal(true);
  };

  const load = useCallback(async () => {
    const [a, r, c, t] = await Promise.all([getActivities(), getReminders(), getClasses(), getActivityTypes()]);
    setActivities(a);
    setReminders(r);
    setClasses(c);
    setActivityTypes(t);
  }, []);

  useFocusEffect(useCallback(() => {
    if (typeof route?.params?.initialTab === 'number') {
      setTab(route.params.initialTab === 1 ? 1 : 0);
      navigation.setParams?.({ initialTab: undefined });
    }
    load();
  }, [load, navigation, route?.params?.initialTab]));

  const handleSaveActivity = async () => {
    if (!aForm.title.trim()) { Alert.alert('Atenção', 'Informe o título'); return; }
    let type = aForm.type;
    if (customTypeMode) {
      if (!customTypeName.trim()) {
        Alert.alert('Atenção', 'Informe o nome do novo tipo.');
        return;
      }
      const customType = await createActivityType(customTypeName, customTypeColor);
      type = customType.key;
    }

    const data = {
      ...aForm,
      type,
      title: aForm.title.trim(),
      description: aForm.description.trim(),
      due_date: aForm.due_date.trim(),
      lesson_id: null,
      done: editingActivity?.done ?? 0,
    };
    if (editingActivity) {
      await updateActivity(editingActivity.id, data);
    } else {
      await createActivity(data);
    }
    closeModal();
    resetActivityForm();
    load();
  };

  const handleSaveReminder = async () => {
    if (!rForm.title.trim()) { Alert.alert('Atenção', 'Informe o título'); return; }
    const data = {
      title: rForm.title.trim(),
      description: rForm.description.trim(),
      date: rForm.date.trim(),
      done: editingReminder?.done ?? 0,
    };
    if (editingReminder) {
      await updateReminder(editingReminder.id, data);
    } else {
      await createReminder(data);
    }
    closeModal();
    resetReminderForm();
    load();
  };

  const handleDeleteCustomType = async (type: ActivityTypeOption) => {
    if (!type.is_custom) return;

    const usageCount = await getActivityTypeUsageCount(type.key);
    const message = usageCount > 0
      ? formatActivityTypeUsageMessage(usageCount)
      : 'Deseja excluir este tipo personalizado?';

    setConfirmDialog({
      visible: true,
      title: 'Excluir tipo',
      message,
      onConfirm: async () => {
        await deleteCustomActivityType(type.key);
        if (aForm.type === type.key) {
          setAForm(current => ({ ...current, type: 'atividade' }));
          setCustomTypeMode(false);
        }
        await load();
      },
    });
  };

  const confirmDeleteActivity = (activity: Activity) => {
    setConfirmDialog({
      visible: true,
      title: 'Excluir atividade',
      message: 'Deseja remover esta atividade?',
      onConfirm: async () => {
        await deleteActivity(activity.id);
        await load();
      },
    });
  };

  const confirmDeleteReminder = (reminder: Reminder) => {
    setConfirmDialog({
      visible: true,
      title: 'Excluir lembrete',
      message: 'Deseja remover este lembrete?',
      onConfirm: async () => {
        await deleteReminder(reminder.id);
        await load();
      },
    });
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
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{TABS[tab]}</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.secondary }]} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.tabItem, tab === i && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
            onPress={() => setTab(i)}
          >
            <Text style={[
              styles.tabText,
              { color: colors.textMuted },
              tab === i && { color: colors.primary, fontWeight: '700' },
            ]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {tab === 0 ? (
          activities.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted, color: colors.primary }]}>AT</Text>
              <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>Nenhuma atividade cadastrada</Text>
            </View>
          ) : (
            activities.map(a => {
              const cfg = getActivityTypeVisual(a);
              const days = daysFromNow(a.due_date);
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.actCard,
                    {
                      borderLeftColor: cfg.color,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      opacity: a.done ? 0.5 : 1,
                    },
                  ]}
                  onPress={() => openEditActivity(a)}
                  activeOpacity={0.75}
                >
                  <TouchableOpacity
                    style={[styles.checkbox, { borderColor: colors.border }, !!a.done && { backgroundColor: colors.secondary, borderColor: colors.secondary }]}
                    onPress={async () => { await toggleActivity(a.id, a.done ? 0 : 1); load(); }}
                  >
                    {!!a.done && <Text style={{ color: '#FFF', fontSize: 12 }}>✓</Text>}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <View style={styles.actTop}>
                      <View style={[styles.typeBadge, { backgroundColor: colors.mode === 'dark' ? `${cfg.color}22` : cfg.bg }]}>
                        <Text style={[styles.typeText, { color: cfg.color }]}>{cfg.icon} {cfg.label}</Text>
                      </View>
                      {a.class_name && (
                        <View style={[styles.classBadge, { backgroundColor: a.class_color + '22' }]}>
                          <Text style={[styles.classText, { color: a.class_color }]}>{a.class_name}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.actTitle, { color: colors.text }, !!a.done && { textDecorationLine: 'line-through' }]}>{a.title}</Text>
                    {a.description ? <Text style={[styles.actDesc, { color: colors.textMuted }]}>{a.description}</Text> : null}
                    <Text style={[styles.actDate, { color: days <= 1 && !a.done ? '#C0392B' : colors.textMuted }]}>
                      {days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : formatDate(a.due_date)}
                      {days < 0 ? ' · Atrasado!' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmDeleteActivity(a)}>
                    <Text style={[styles.deleteBtn, { color: colors.textMuted }]}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )
        ) : (
          reminders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted, color: colors.primary }]}>LE</Text>
              <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>Nenhum lembrete cadastrado</Text>
            </View>
          ) : (
            reminders.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.remCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: r.done ? 0.5 : 1,
                  },
                ]}
                onPress={() => openEditReminder(r)}
                activeOpacity={0.75}
              >
                <TouchableOpacity
                  style={[styles.checkbox, { borderColor: colors.border }, !!r.done && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={async () => { await toggleReminder(r.id, r.done ? 0 : 1); load(); }}
                >
                  {!!r.done && <Text style={{ color: '#FFF', fontSize: 12 }}>✓</Text>}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.remTitle, { color: colors.text }, !!r.done && { textDecorationLine: 'line-through' }]}>{r.title}</Text>
                  {r.description ? <Text style={[styles.remDesc, { color: colors.textMuted }]}>{r.description}</Text> : null}
                  <Text style={[styles.remDate, { color: colors.textMuted }]}>{formatDate(r.date)}</Text>
                </View>
                <TouchableOpacity onPress={() => confirmDeleteReminder(r)}>
                  <Text style={[styles.deleteBtn, { color: colors.textMuted }]}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom sheet */}
      <BottomSheetModal visible={showModal} onClose={closeModal} maxHeight="85%">
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {tab === 0
              ? editingActivity ? 'Editar Atividade' : 'Nova Atividade'
              : editingReminder ? 'Editar Lembrete' : 'Novo Lembrete'}
          </Text>
          <TouchableOpacity onPress={tab === 0 ? handleSaveActivity : handleSaveReminder}>
            <Text style={[styles.saveBtn, { color: colors.primary }]}>Salvar</Text>
          </TouchableOpacity>
        </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {tab === 0 ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Tipo</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 14 }}
                  contentContainerStyle={{ paddingRight: 16 }}
                >
                  {activityTypes.map(t => {
                    const cfg = t;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        style={[
                          styles.chip,
                          chipTheme,
                          !customTypeMode && aForm.type === t.key && { backgroundColor: cfg.color, borderColor: cfg.color },
                        ]}
                        onPress={() => {
                          setCustomTypeMode(false);
                          setAForm(f => ({ ...f, type: t.key }));
                        }}
                        onLongPress={() => handleDeleteCustomType(t)}
                      >
                        <Text style={[
                          styles.chipText,
                          { color: colors.text },
                          !customTypeMode && aForm.type === t.key && { color: '#FFF' },
                        ]}>{cfg.icon} {cfg.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      chipTheme,
                      customTypeMode && { backgroundColor: customTypeColor, borderColor: customTypeColor },
                    ]}
                    onPress={() => setCustomTypeMode(true)}
                  >
                    <Text style={[styles.chipText, { color: colors.text }, customTypeMode && { color: '#FFF' }]}>+ Outro</Text>
                  </TouchableOpacity>
                </ScrollView>

                {customTypeMode && (
                  <View style={[styles.customTypeBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Nome do tipo</Text>
                    <TextInput
                      style={[styles.input, inputTheme]}
                      value={customTypeName}
                      onChangeText={setCustomTypeName}
                      placeholder="Ex: Seminário, Recuperação..."
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Cor do tipo</Text>
                    <View style={styles.colorRow}>
                      {ACTIVITY_TYPE_COLORS.map(color => (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.colorDot,
                            { backgroundColor: color },
                            customTypeColor === color && { borderColor: colors.text, borderWidth: 3 },
                          ]}
                          onPress={() => setCustomTypeColor(color)}
                        />
                      ))}
                    </View>
                  </View>
                )}

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Turma (opcional)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 14 }}
                  contentContainerStyle={{ paddingRight: 16 }}
                >
                  <TouchableOpacity
                    style={[styles.chip, chipTheme, aForm.class_id === null && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => setAForm(f => ({ ...f, class_id: null }))}
                  >
                    <Text style={[styles.chipText, { color: colors.text }, aForm.class_id === null && { color: '#FFF' }]}>Geral</Text>
                  </TouchableOpacity>
                  {classes.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chip, chipTheme, aForm.class_id === c.id && { backgroundColor: c.color, borderColor: c.color }]}
                      onPress={() => setAForm(f => ({ ...f, class_id: c.id }))}
                    >
                      <Text style={[styles.chipText, { color: colors.text }, aForm.class_id === c.id && { color: '#FFF' }]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Título *</Text>
                <TextInput style={[styles.input, inputTheme]} value={aForm.title} onChangeText={v => setAForm(f => ({ ...f, title: v }))} placeholder="Ex: AVS de Inglês — 7º A" placeholderTextColor={colors.textMuted} />

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Descrição</Text>
                <TextInput style={[styles.input, inputTheme, { minHeight: 60 }]} value={aForm.description} onChangeText={v => setAForm(f => ({ ...f, description: v }))} placeholder="Detalhes..." placeholderTextColor={colors.textMuted} multiline />

                <DatePickerField
                  label="Data"
                  value={aForm.due_date}
                  onChange={v => setAForm(f => ({ ...f, due_date: v }))}
                />
              </>
            ) : (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Título *</Text>
                <TextInput style={[styles.input, inputTheme]} value={rForm.title} onChangeText={v => setRForm(f => ({ ...f, title: v }))} placeholder="Ex: Elaborar guias bimestrais" placeholderTextColor={colors.textMuted} />

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Descrição</Text>
                <TextInput style={[styles.input, inputTheme, { minHeight: 60 }]} value={rForm.description} onChangeText={v => setRForm(f => ({ ...f, description: v }))} placeholder="Detalhes..." placeholderTextColor={colors.textMuted} multiline />

                <DatePickerField
                  label="Data"
                  value={rForm.date}
                  onChange={v => setRForm(f => ({ ...f, date: v }))}
                />
              </>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
      </BottomSheetModal>

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onCancel={closeConfirmDialog}
        onConfirm={confirmAndClose}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#EFEFEF',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  addBtn: { backgroundColor: '#14B8A6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EFEFEF', backgroundColor: '#FFF' },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#0F4C81' },
  tabText: { fontSize: 14, color: '#888', fontWeight: '500' },
  tabTextActive: { color: '#0F4C81', fontWeight: '700' },
  body: { padding: 16 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 16,
    textAlign: 'center', textAlignVertical: 'center',
    backgroundColor: '#E0F7F4', color: '#0F4C81',
    fontSize: 15, fontWeight: '800', marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, color: '#888' },
  actCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderLeftWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: '#DDD', alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  actTop: { flexDirection: 'row', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  typeText: { fontSize: 11, fontWeight: '600' },
  classBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  classText: { fontSize: 11, fontWeight: '600' },
  actTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 3 },
  actDesc: { fontSize: 12, color: '#777', marginBottom: 4 },
  actDate: { fontSize: 11, fontWeight: '500' },
  deleteBtn: { fontSize: 14, color: '#CCC', padding: 4 },
  remCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderLeftWidth: 3, borderLeftColor: '#0F4C81',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  remTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 3 },
  remDesc: { fontSize: 12, color: '#777', marginBottom: 4 },
  remDate: { fontSize: 11, color: '#888', fontWeight: '500' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  saveBtn: { fontSize: 15, color: '#0F4C81', fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#FFF', borderRadius: 10, padding: 12, fontSize: 14,
    color: '#333', borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8,
    backgroundColor: '#F0F0F0', borderWidth: 1.5, borderColor: '#E0E0E0',
  },
  chipActive: { backgroundColor: '#0F4C81', borderColor: '#0F4C81' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#333' },
  customTypeBox: {
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  colorDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 0 },
});
