import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getClasses, createClass, updateClass, deleteClass, getProfessionalProfile,
} from '../../database/queries';
import { Class, ProfessionalProfile } from '../../types';
import { CLASS_COLORS } from '../../utils/colors';
import { useAppTheme } from '../../theme';
import { ConfirmDialog, type ConfirmDialogVariant } from '../../components/ConfirmDialog';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { ActionButton } from '../../components/ActionButton';
import { EmptyState } from '../../components/EmptyState';
import { SheetScrollView } from '../../components/SheetScrollView';

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

function splitSubjects(subjects: string): string[] {
  return subjects
    .split(/[,;\n]/)
    .map(subject => subject.trim())
    .filter(Boolean)
    .filter(subject => !/planejamento/i.test(subject));
}

function joinSubjects(subjects: string[]): string {
  const seen = new Set<string>();
  return subjects
    .map(subject => subject.trim())
    .filter(Boolean)
    .filter(subject => {
      const key = subject.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}

export function TurmasScreen() {
  const { colors } = useAppTheme();
  const [classes, setClasses] = useState<Class[]>([]);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [customSubject, setCustomSubject] = useState(false);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(EMPTY_CONFIRM_DIALOG);
  const [formErrors, setFormErrors] = useState<{ name?: string; subject?: string }>({});
  const [form, setForm] = useState({
    name: '', subject: '', color: '#0F4C81', student_count: '0',
  });

  const load = useCallback(async () => {
    const [classRows, professionalProfile] = await Promise.all([
      getClasses(),
      getProfessionalProfile(),
    ]);
    setClasses(classRows);
    setProfile(professionalProfile);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    const subjectOptions = splitSubjects(profile?.subjects ?? '');
    setEditing(null);
    setCustomSubject(subjectOptions.length === 0);
    setCustomSubjectInput('');
    setForm({
      name: '',
      subject: subjectOptions[0] ?? '',
      color: '#0F4C81',
      student_count: '0',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (c: Class) => {
    const subjectOptions = splitSubjects(profile?.subjects ?? '');
    const selectedSubjects = splitSubjects(c.subject);
    const customSubjects = selectedSubjects.filter(subject => !subjectOptions.includes(subject));
    setEditing(c);
    setCustomSubject(customSubjects.length > 0);
    setCustomSubjectInput(customSubjects.join(', '));
    setForm({
      name: c.name,
      subject: joinSubjects(selectedSubjects.filter(subject => subjectOptions.includes(subject))),
      color: c.color,
      student_count: String(c.student_count),
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSave = async () => {
    const finalSubjects = joinSubjects([
      ...splitSubjects(form.subject),
      ...(customSubject ? splitSubjects(customSubjectInput) : []),
    ]);
    const nextErrors = {
      name: form.name.trim() ? undefined : 'Informe o nome da turma',
      subject: finalSubjects ? undefined : 'Informe ao menos um componente curricular',
    };

    if (nextErrors.name || nextErrors.subject) {
      setFormErrors(nextErrors);
      return;
    }

    const data = {
      name: form.name.trim(),
      grade: form.name.trim(),
      subject: finalSubjects,
      color: form.color,
      student_count: parseInt(form.student_count) || 0,
    };
    if (editing) {
      await updateClass(editing.id, data);
    } else {
      await createClass(data);
    }
    closeModal();
    load();
  };

  const subjectOptions = splitSubjects(profile?.subjects ?? '');
  const selectedSubjects = splitSubjects(form.subject);

  const toggleSubject = (subject: string) => {
    const selected = selectedSubjects.includes(subject)
      ? selectedSubjects.filter(item => item !== subject)
      : [...selectedSubjects, subject];
    setForm(current => ({ ...current, subject: joinSubjects(selected) }));
    if (formErrors.subject) setFormErrors(current => ({ ...current, subject: undefined }));
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setCustomSubjectInput('');
    setFormErrors({});
  };

  const closeConfirmDialog = () => setConfirmDialog(EMPTY_CONFIRM_DIALOG);

  const confirmAndClose = async () => {
    const action = confirmDialog.onConfirm;
    closeConfirmDialog();
    await action();
  };

  const handleDelete = (c: Class) => {
    setConfirmDialog({
      visible: true,
      title: 'Excluir turma',
      message: 'Deseja excluir esta turma? Todas as aulas vinculadas a ela serão removidas.',
      onConfirm: async () => {
        await deleteClass(c.id);
        setShowModal(false);
        setEditing(null);
        await load();
      },
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={colors.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent={false}
      />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Turmas</Text>
        {classes.length > 0 ? (
          <ActionButton label="Nova turma" compact onPress={openAdd} />
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {classes.length === 0 ? (
          <EmptyState
            title="Nenhuma turma cadastrada"
            description="Cadastre suas turmas para organizar a agenda e identificar suas aulas com mais facilidade."
            actionLabel="Adicionar turma"
            onAction={openAdd}
          />
        ) : (
          classes.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.classCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => openEdit(c)}
              onLongPress={() => handleDelete(c)}
              activeOpacity={0.75}
            >
              <View style={[styles.classColorBar, { backgroundColor: c.color }]} />
              <View style={styles.classInfo}>
                <View style={styles.classTop}>
                  <Text style={[styles.className, { color: colors.text }]}>{c.name}</Text>
                  <View style={[styles.subjectBadge, { backgroundColor: c.color + '22' }]}>
                    <Text style={[styles.subjectText, { color: c.color }]}>{c.subject}</Text>
                  </View>
                </View>
                <Text style={[styles.classGrade, { color: colors.textMuted }]}>{c.grade}</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNum, { color: colors.primary }]}>{c.student_count}</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>Alunos</Text>
                  </View>
                </View>
              </View>
              <View style={styles.editHint}>
                <Text style={[styles.editHintText, { color: colors.textMuted }]}>✎</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        {classes.length > 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>Toque para editar</Text>
        ) : null}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom sheet */}
      <BottomSheetModal visible={showModal} onClose={closeModal} maxHeight="85%">
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{editing ? 'Editar Turma' : 'Nova Turma'}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.saveBtn, { color: colors.primary }]}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <SheetScrollView>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Nome da turma *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={form.name}
            onChangeText={v => {
              setForm(f => ({ ...f, name: v }));
              if (formErrors.name) setFormErrors(current => ({ ...current, name: undefined }));
            }}
            placeholder="Ex: Primeiro ano B"
            placeholderTextColor={colors.textMuted}
          />
          {formErrors.name ? <Text style={styles.errorText}>{formErrors.name}</Text> : null}

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Componente Curricular *</Text>
          <Text style={[styles.formHint, { color: colors.textMuted }]}>Selecione um ou mais componentes para esta turma.</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {subjectOptions.map(subject => {
              const active = selectedSubjects.includes(subject);
              return (
                <TouchableOpacity
                  key={subject}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => toggleSubject(subject)}
                >
                  <Text style={[styles.chipText, { color: colors.text }, active && { color: '#FFF' }]}>{subject}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                customSubject && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => {
                setCustomSubject(current => !current);
                setFormErrors(current => ({ ...current, subject: undefined }));
              }}
            >
              <Text style={[styles.chipText, { color: colors.text }, customSubject && { color: '#FFF' }]}>Outra</Text>
            </TouchableOpacity>
          </ScrollView>
          {customSubject && (
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={customSubjectInput}
              onChangeText={v => {
                setCustomSubjectInput(v);
                if (formErrors.subject) setFormErrors(current => ({ ...current, subject: undefined }));
              }}
              placeholder="Ex: Física, Química"
              placeholderTextColor={colors.textMuted}
            />
          )}
          {formErrors.subject ? <Text style={styles.errorText}>{formErrors.subject}</Text> : null}

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Quantidade de alunos</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={form.student_count}
            onChangeText={v => setForm(f => ({ ...f, student_count: v }))}
            placeholder="Ex: 28"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Cor da turma</Text>
          <View style={styles.colorPicker}>
            {CLASS_COLORS.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[styles.colorDot, { backgroundColor: c.value }, form.color === c.value && [styles.colorDotSelected, { borderColor: colors.text }]]}
                onPress={() => setForm(f => ({ ...f, color: c.value }))}
              />
            ))}
          </View>
          {editing && (
            <TouchableOpacity
              style={[styles.deleteFullBtn, { backgroundColor: colors.mode === 'dark' ? '#3A1F24' : '#FDEDEC' }]}
              onPress={() => handleDelete(editing)}
            >
              <Text style={styles.deleteFullBtnText}>Excluir turma</Text>
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
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#EFEFEF',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  body: { padding: 16 },
  classCard: {
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 14, marginBottom: 12,
    borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  classColorBar: { width: 6 },
  classInfo: { flex: 1, padding: 14 },
  classTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  className: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  subjectBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  subjectText: { fontSize: 11, fontWeight: '600' },
  classGrade: { fontSize: 12, color: '#888', marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 16 },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: '#0F4C81' },
  statLabel: { fontSize: 10, color: '#888' },
  editHint: { justifyContent: 'center', paddingRight: 14 },
  editHintText: { fontSize: 16, color: '#CCC' },
  hint: { fontSize: 11, color: '#BBB', textAlign: 'center', marginTop: 4 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  saveBtn: { fontSize: 15, color: '#0F4C81', fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  formHint: { fontSize: 12, marginBottom: 10 },
  errorText: { color: '#C0392B', fontSize: 12, fontWeight: '700', marginTop: -8, marginBottom: 12 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  optionChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#F0F0F0', borderWidth: 1.5, borderColor: '#E0E0E0',
  },
  optionChipActive: { backgroundColor: '#0F4C81', borderColor: '#0F4C81' },
  optionText: { fontSize: 12, fontWeight: '600', color: '#555' },
  optionTextActive: { color: '#FFF' },
  letterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  letterChip: {
    width: 42, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#F0F0F0', borderWidth: 1.5, borderColor: '#E0E0E0',
  },
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
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotSelected: { borderWidth: 3, borderColor: '#1A1A2E' },
  deleteFullBtn: {
    alignItems: 'center', paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#FDEDEC', marginTop: 2,
  },
  deleteFullBtnText: { color: '#C0392B', fontWeight: '700', fontSize: 14 },
});
