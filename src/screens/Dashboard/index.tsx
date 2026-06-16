/**
 * Arquivo: src/screens/Dashboard/index.tsx
 * Descrição: Tela Inicial / Dashboard (Início) do EduAgenda.
 * Esta tela renderiza as estatísticas rápidas do dia atual do professor (total de aulas,
 * status de conclusão das aulas e quantidade de aulas com material não preparado),
 * a listagem das aulas de hoje (usando o LessonCard), as tarefas pendentes de maior prioridade,
 * os próximos lembretes do calendário e fornece o modal de edição de diário de classe.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getLessonsForDate, getPendingActivities, getReminders, getProfessionalProfile,
  upsertLessonEntry, getLessonActivityOptions, createLessonActivityOption,
  getLessonActivityOptionUsageCount, deleteCustomLessonActivityOption,
} from '../../database/queries';
import { Lesson, LessonActivityOption, Activity, Reminder, ProfessionalProfile } from '../../types';
import { dateToISO, WEEKDAY_FULL, daysFromNow, formatDate } from '../../utils/time';
import { LessonCard } from '../../components/LessonCard';
import { LessonDetailSheet } from '../../components/LessonDetailSheet';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { LessonActivitySelector } from '../../components/LessonActivitySelector';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PreparedContentToggle } from '../../components/PreparedContentToggle';
import { getActivityTypeVisual } from '../../utils/colors';
import { useAppTheme } from '../../theme';
import { LESSON_STATUS_OPTIONS, normalizeLessonStatus, parseLessonActivities, stringifyLessonActivities } from '../../utils/lessonActivities';
import { hasPendingLessonContent, isReservedLesson } from '../../utils/lessonContent';
import { SheetScrollView } from '../../components/SheetScrollView';

// Vetores de nomes para dias da semana e meses em português para exibição formatada da data do cabeçalho.
const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Estrutura de tipo para controle do estado do modal genérico de confirmação.
type ConfirmDialogState = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
};

// Estado padrão zerado para o modal de confirmação.
const EMPTY_CONFIRM_DIALOG: ConfirmDialogState = {
  visible: false,
  title: '',
  message: '',
  onConfirm: () => undefined,
};

// Retorna uma saudação apropriada ("Bom dia", "Boa tarde" ou "Boa noite") com base no horário local do aparelho.
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Retorna uma string formatada representando a data de hoje, ex: "Segunda, 10 de jun".
function todayLabel(): string {
  const d = new Date();
  return `${DAYS_PT[d.getDay()]}, ${d.getDate()} de ${MONTHS_PT[d.getMonth()]}`;
}

// Extrai as iniciais do nome do usuário para renderizar no avatar circular da barra superior.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ED';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// Utilitário de pluralização simples em português do Brasil.
function plural(value: number, singular: string, pluralValue: string): string {
  return value === 1 ? singular : pluralValue;
}

export function DashboardScreen({ navigation }: any) {
  // Carrega as cores do tema ativo do EduAgenda.
  const { colors } = useAppTheme();

  // Estados locais para listas de dados carregadas do SQLite.
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [lessonActivityOptions, setLessonActivityOptions] = useState<LessonActivityOption[]>([]);
  
  // Controle de recarregamento por gesto puxar-para-baixo (Pull to Refresh).
  const [refreshing, setRefreshing] = useState(false);

  // Estados para controle de modais e folhas inferiores abertas.
  const [detailLesson, setDetailLesson] = useState<Lesson | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(EMPTY_CONFIRM_DIALOG);

  // Formulário do diário da aula a ser editada no modal.
  const [lessonEntryForm, setLessonEntryForm] = useState({
    content: '',
    activity: '',
    methodology: '',
    status: 'Pendente',
    notes: '',
    conteudo_preparado: 0,
  });

  // Função assíncrona responsável por carregar todas as informações do dia atual no SQLite.
  const load = useCallback(async () => {
    const [l, a, r, p, activityOptions] = await Promise.all([
      getLessonsForDate(dateToISO(new Date())),
      getPendingActivities(),
      getReminders(),
      getProfessionalProfile(),
      getLessonActivityOptions(),
    ]);
    setLessons(l);
    setProfile(p);
    setLessonActivityOptions(activityOptions);
    setActivities(a.slice(0, 4)); // Limita a visualização rápida de atividades em no máximo 4
    setReminders(r.filter(x => !x.done).slice(0, 3)); // Limita a visualização rápida de lembretes ativos em no máximo 3
  }, []);

  // Garante que os dados do Dashboard serão recarregados toda vez que a tela ganhar o foco de navegação.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Disparado ao puxar a ScrollView para atualizar os dados manualmente.
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Fecha o modal de confirmação restaurando seu estado vazio.
  const closeConfirmDialog = () => setConfirmDialog(EMPTY_CONFIRM_DIALOG);

  // Confirma a ação pendente do modal de confirmação e fecha o modal.
  const confirmAndClose = async () => {
    const action = confirmDialog.onConfirm;
    closeConfirmDialog();
    await action();
  };

  // Abre a folha de edição preenchendo o formulário com os dados da aula selecionada.
  const openEditLessonEntry = (lesson: Lesson) => {
    setDetailLesson(null);
    setEditingLesson(lesson);
    setLessonEntryForm({
      content: lesson.content ?? '',
      activity: lesson.activity ?? '',
      methodology: lesson.methodology ?? '',
      status: normalizeLessonStatus(lesson.status),
      notes: lesson.notes ?? '',
      conteudo_preparado: lesson.conteudo_preparado ?? 0,
    });
  };

  // Salva no SQLite as edições realizadas no formulário da aula editada.
  const saveLessonEntry = async () => {
    if (!editingLesson) return;

    await upsertLessonEntry(editingLesson.id, dateToISO(new Date()), {
      content: lessonEntryForm.content.trim(),
      activity: lessonEntryForm.activity.trim(),
      methodology: lessonEntryForm.methodology.trim(),
      status: lessonEntryForm.status,
      notes: lessonEntryForm.notes.trim(),
      conteudo_preparado: lessonEntryForm.conteudo_preparado,
    });

    setEditingLesson(null);
    await load();
  };

  // Cria uma nova opção de atividade personalizada para associar às aulas.
  const createCustomLessonActivity = async (label: string): Promise<string | null> => {
    const option = await createLessonActivityOption(label);
    const options = await getLessonActivityOptions();
    setLessonActivityOptions(options);
    return option.label;
  };

  // Trata a exclusão de uma atividade personalizada, alertando o usuário caso ela esteja em uso.
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
        setLessonEntryForm(current => ({
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

  // Cálculos dinâmicos memorizados (useMemo) baseados na lista de aulas do dia.
  const realTodayWeekday = new Date().getDay();
  const todayName = realTodayWeekday >= 1 && realTodayWeekday <= 5
    ? WEEKDAY_FULL[realTodayWeekday - 1]
    : 'Fim de semana';

  // Filtra as aulas de hoje removendo horários reservados apenas.
  const classLessonsToday = useMemo(
    () => lessons.filter(lesson => !isReservedLesson(lesson)),
    [lessons]
  );

  // Calcula o somatório de aulas pendentes, concluídas e canceladas para o mini-resumo de hoje.
  const dailyStatus = useMemo(() => {
    return classLessonsToday.reduce(
      (acc, lesson) => {
        const status = normalizeLessonStatus(lesson.status);
        if (status === LESSON_STATUS_OPTIONS[1]) acc.done += 1;
        else if (status === LESSON_STATUS_OPTIONS[2]) acc.canceled += 1;
        else acc.pending += 1;
        return acc;
      },
      { pending: 0, done: 0, canceled: 0 }
    );
  }, [classLessonsToday]);

  // Conta a quantidade de aulas cujos materiais ainda não foram preparados.
  const pendingContentCount = useMemo(
    () => classLessonsToday.filter(hasPendingLessonContent).length,
    [classLessonsToday]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Configura o comportamento visual da barra de status conforme o tema (claro/escuro) */}
      <StatusBar
        barStyle={colors.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent={false}
      />

      {/* Barra de cabeçalho: exibe a data formatada, saudação e avatar do professor */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.dateLabel, { color: colors.textMuted }]}>{todayLabel()}</Text>
          <Text style={[styles.greeting, { color: colors.text }]}>{getGreeting()}</Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initials(profile?.name ?? '')}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Seção superior de Estatísticas Rápidas (3 cards lado a lado) */}
        <View style={styles.statsRow}>
          {/* Card 1: Quantidade de aulas de hoje (com pluralização dinâmica) */}
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{classLessonsToday.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              {plural(classLessonsToday.length, 'aula hoje', 'aulas hoje')}
            </Text>
          </View>
          
          {/* Card 2: Mini-resumo de status (quantidade de pendentes, concluídas e canceladas) */}
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Status de hoje</Text>
            <View style={styles.statusSummary}>
              <Text style={[styles.statusSummaryText, { color: colors.text }]}>
                <Text style={{ color: colors.primary }}>{dailyStatus.pending}</Text> {plural(dailyStatus.pending, 'pendente', 'pendentes')}
              </Text>
              <Text style={[styles.statusSummaryText, { color: colors.text }]}>
                <Text style={{ color: colors.secondary }}>{dailyStatus.done}</Text> {plural(dailyStatus.done, 'concluída', 'concluídas')}
              </Text>
              <Text style={[styles.statusSummaryText, { color: colors.text }]}>
                <Text style={{ color: '#C0392B' }}>{dailyStatus.canceled}</Text> {plural(dailyStatus.canceled, 'cancelada', 'canceladas')}
              </Text>
            </View>
          </View>
          
          {/* Card 3: Quantidade de aulas não preparadas (com pluralização dinâmica e centralizado) */}
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: pendingContentCount > 0 ? '#B7791F' : colors.secondary }]}>
              {pendingContentCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              {plural(pendingContentCount, 'aula não preparada', 'aulas não preparadas')}
            </Text>
          </View>
        </View>

        {/* Seção contendo a Listagem de Aulas de Hoje */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Aulas de hoje · {todayName}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Agenda')}>
              <Text style={[styles.seeAll, { color: colors.secondary }]}>Ver agenda</Text>
            </TouchableOpacity>
          </View>
          {lessons.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Sem aulas hoje</Text>
            </View>
          ) : (
            lessons.map(l => (
              <LessonCard
                key={l.id}
                lesson={l}
                onPress={() => setDetailLesson(l)}
              />
            ))
          )}
        </View>

        {/* Seção contendo as Atividades Pendentes (limite visual de 4) */}
        {activities.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Atividades pendentes</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Atividades', { initialTab: 0 })}>
                <Text style={[styles.seeAll, { color: colors.secondary }]}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            {activities.map(a => {
              const cfg = getActivityTypeVisual(a);
              const days = daysFromNow(a.due_date);
              return (
                <View
                  key={a.id}
                  style={[
                    styles.actCard,
                    {
                      borderLeftColor: cfg.color,
                      backgroundColor: colors.mode === 'dark' ? `${cfg.color}22` : cfg.bg,
                    },
                  ]}
                >
                  <View style={styles.actTop}>
                    <Text style={[styles.actIcon, { color: cfg.color, borderColor: cfg.color, backgroundColor: colors.surface }]}>{cfg.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.actTitle, { color: cfg.color }]}>{a.title}</Text>
                      {a.class_name && <Text style={[styles.actClass, { color: colors.textMuted }]}>{a.class_name}</Text>}
                    </View>
                    <View style={[styles.actBadge, { backgroundColor: days <= 1 ? '#FDEDEC' : colors.surfaceMuted }]}>
                      <Text style={[styles.actBadgeText, { color: days <= 1 ? '#C0392B' : colors.textMuted }]}>
                        {days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `${days}d`}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Seção contendo os Próximos Lembretes do Calendário (limite de 3) */}
        {reminders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Próximos lembretes</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Atividades', { initialTab: 1 })}>
                <Text style={[styles.seeAll, { color: colors.secondary }]}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            {reminders.map(r => (
              <View key={r.id} style={[styles.remCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.remDot, { backgroundColor: colors.secondary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.remTitle, { color: colors.text }]}>{r.title}</Text>
                  {r.description ? <Text style={[styles.remSub, { color: colors.textMuted }]}>{r.description}</Text> : null}
                </View>
                <Text style={[styles.remDate, { color: colors.textMuted }]}>{formatDate(r.date)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Componente Folha de Detalhes da Aula */}
      <LessonDetailSheet
        lesson={detailLesson}
        onClose={() => setDetailLesson(null)}
        onEdit={openEditLessonEntry}
      />

      {/* Modal inferior para Edição do Diário de Classe de uma aula */}
      <BottomSheetModal visible={!!editingLesson} onClose={() => setEditingLesson(null)} maxHeight="82%">
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Editar aula de hoje</Text>
          <TouchableOpacity onPress={saveLessonEntry}>
            <Text style={[styles.saveBtn, { color: colors.primary }]}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <SheetScrollView>
          {/* Edição de Conteúdo */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Conteúdo</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={lessonEntryForm.content}
            onChangeText={value => setLessonEntryForm(current => ({ ...current, content: value }))}
            placeholder="Conteúdo trabalhado hoje"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          {/* Toggle de Material Preparado (Sim / Não) */}
          <PreparedContentToggle
            value={lessonEntryForm.conteudo_preparado === 1}
            onChange={value => setLessonEntryForm(current => ({
              ...current,
              conteudo_preparado: value ? 1 : 0,
            }))}
          />

          {/* Selecionador de Atividades Associadas */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Atividade</Text>
          <LessonActivitySelector
            options={lessonActivityOptions}
            selected={parseLessonActivities(lessonEntryForm.activity)}
            onChange={values => setLessonEntryForm(current => ({ ...current, activity: stringifyLessonActivities(values) }))}
            onCreateCustom={createCustomLessonActivity}
            onDeleteCustom={handleDeleteCustomLessonActivity}
          />

          {/* Seleção do Status da Aula (Pendente, Concluída, Cancelada) */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Status</Text>
          <View style={styles.statusRow}>
            {LESSON_STATUS_OPTIONS.map(status => {
              const active = lessonEntryForm.status === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusChip,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setLessonEntryForm(current => ({ ...current, status }))}
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

          {/* Campo para Observações do Professor */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Observações</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={lessonEntryForm.notes}
            onChangeText={value => setLessonEntryForm(current => ({ ...current, notes: value }))}
            placeholder="Anotações do professor"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <View style={{ height: 40 }} />
        </SheetScrollView>
      </BottomSheetModal>

      {/* Caixa de diálogo para confirmações gerais do sistema (ex: excluir atividade) */}
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
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10,
    backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#EFEFEF',
  },
  dateLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  greeting: { fontSize: 21, fontWeight: '700', color: '#1A1A2E' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#0F4C81', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#E0F7F4', fontWeight: '700', fontSize: 14 },
  body: { padding: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 14,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  statNum: { fontSize: 28, fontWeight: '700', color: '#0F4C81' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2, textAlign: 'center' },
  statusSummary: { gap: 2, marginTop: 6, width: '100%' },
  statusSummaryText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  seeAll: { fontSize: 12, color: '#14B8A6', fontWeight: '600' },
  emptyBox: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#EFEFEF',
  },
  emptyText: { fontSize: 14, color: '#888' },
  actCard: {
    borderLeftWidth: 3, borderRadius: 10, padding: 12, marginBottom: 8,
  },
  actTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actIcon: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1,
    textAlign: 'center', textAlignVertical: 'center',
    fontSize: 11, fontWeight: '800', backgroundColor: '#FFF',
  },
  actTitle: { fontSize: 13, fontWeight: '600' },
  actClass: { fontSize: 11, color: '#777', marginTop: 1 },
  actBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  actBadgeText: { fontSize: 11, fontWeight: '600' },
  remCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#EFEFEF',
  },
  remDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#14B8A6', marginTop: 4 },
  remTitle: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  remSub: { fontSize: 11, color: '#888', marginTop: 2 },
  remDate: { fontSize: 11, color: '#888' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  saveBtn: { fontSize: 15, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statusChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 9,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    marginBottom: 14,
    minHeight: 48,
    padding: 12,
  },
  textArea: { minHeight: 76, textAlignVertical: 'top' },
});
