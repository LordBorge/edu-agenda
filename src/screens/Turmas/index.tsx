import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getClasses, createClass, updateClass, deleteClass, getProfessionalProfile,
} from '../../database/queries';
import { Class, ProfessionalProfile } from '../../types';
import { CLASS_COLORS } from '../../utils/colors';
import { useAppTheme } from '../../theme';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { BottomSheetModal } from '../../components/BottomSheetModal';

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

function splitSubjects(subjects: string): string[] {
  return subjects
    .split(/[,;\n]/)
    .map(subject => subject.trim())
    .filter(Boolean)
    .filter(subject => !/planejamento/i.test(subject));
}

export function TurmasScreen() {
  const { colors } = useAppTheme();
  const [classes, setClasses] = useState<Class[]>([]);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [customSubject, setCustomSubject] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(EMPTY_CONFIRM_DIALOG);
  const [form, setForm] = useState({
    name: '', grade: '', subject: '', color: '#0F4C81', student_count: '0',
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
    setForm({
      name: '',
      grade: '',
      subject: subjectOptions[0] ?? '',
      color: '#0F4C81',
      student_count: '0',
    });
    setShowModal(true);
  };

  const openEdit = (c: Class) => {
    const subjectOptions = splitSubjects(profile?.subjects ?? '');
    setEditing(c);
    setCustomSubject(!subjectOptions.includes(c.subject));
    setForm({
      name: c.name,
      grade: c.grade,
      subject: c.subject,
      color: c.color,
      student_count: String(c.student_count),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Atenção', 'Informe o nome da turma'); return; }
    if (!form.subject.trim()) { Alert.alert('Atenção', 'Informe o componente curricular'); return; }
    const data = {
      name: form.name.trim(),
      grade: form.grade.trim() || form.name.trim(),
      subject: form.subject.trim(),
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

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
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
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.secondary }]} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Nova Turma</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {classes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted, color: colors.primary }]}>TU</Text>
            <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>Nenhuma turma cadastrada</Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.secondary }]} onPress={openAdd}>
              <Text style={styles.emptyBtnText}>+ Adicionar turma</Text>
            </TouchableOpacity>
          </View>
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
        <Text style={[styles.hint, { color: colors.textMuted }]}>Toque para editar</Text>
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

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Nome da turma *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={form.name}
            onChangeText={v => setForm(f => ({ ...f, name: v }))}
            placeholder="Ex: Primeiro ano B"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Série / Ano (opcional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={form.grade}
            onChangeText={v => setForm(f => ({ ...f, grade: v }))}
            placeholder="Ex: Ensino Médio"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Componente Curricular *</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {subjectOptions.map(subject => (
              <TouchableOpacity
                key={subject}
                style={[
                  styles.chip,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                  !customSubject && form.subject === subject && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => {
                  setCustomSubject(false);
                  setForm(f => ({ ...f, subject }));
                }}
              >
                <Text style={[styles.chipText, { color: colors.text }, !customSubject && form.subject === subject && { color: '#FFF' }]}>{subject}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                customSubject && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => {
                setCustomSubject(true);
                setForm(f => ({ ...f, subject: '' }));
              }}
            >
              <Text style={[styles.chipText, { color: colors.text }, customSubject && { color: '#FFF' }]}>Outra</Text>
            </TouchableOpacity>
          </ScrollView>
          {customSubject && (
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={form.subject}
              onChangeText={v => setForm(f => ({ ...f, subject: v }))}
              placeholder="Ex: História"
              placeholderTextColor={colors.textMuted}
            />
          )}

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
  body: { padding: 16 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 16,
    textAlign: 'center', textAlignVertical: 'center',
    backgroundColor: '#E0F7F4', color: '#0F4C81',
    fontSize: 15, fontWeight: '800', marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, color: '#888', marginBottom: 16 },
  emptyBtn: { backgroundColor: '#14B8A6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptyBtnText: { color: '#FFF', fontWeight: '600' },
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
