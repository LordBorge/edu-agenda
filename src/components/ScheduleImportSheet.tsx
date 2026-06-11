import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { importWeeklySchedule } from '../database/queries';
import {
  OcrLowConfidenceError,
  OcrOfflineUnavailableError,
  OcrPdfUnsupportedError,
  recognizeScheduleOcrFromSource,
  OcrSource,
  type OcrTextBlock,
} from '../services/scheduleOcr';
import { useAppTheme } from '../theme';
import { Weekday } from '../types';
import {
  parseScheduleTableFromOcr,
  ScheduleImportItem,
  summarizeScheduleImport,
} from '../utils/scheduleImport';
import { BottomSheetModal } from './BottomSheetModal';
import { TimeInput } from './TimeInput';
import { SheetScrollView } from './SheetScrollView';

type Props = {
  visible: boolean;
  monthKey: string;
  onClose: () => void;
  onImported: (message: string) => void;
};

const WEEKDAYS: Array<{ value: Weekday; label: string }> = [
  { value: 0, label: 'Seg' },
  { value: 1, label: 'Ter' },
  { value: 2, label: 'Qua' },
  { value: 3, label: 'Qui' },
  { value: 4, label: 'Sex' },
];

const OCR_PLACEHOLDER = 'O texto reconhecido aparecerá aqui. Você também pode colar ou digitar o texto manualmente.';
const OCR_CLARITY_ERROR = 'Não foi possível reconhecer o horário com clareza. Tente uma imagem mais nítida ou edite o texto manualmente.';
const OCR_TABLE_REVIEW_MESSAGE = 'O texto foi reconhecido, mas a estrutura da tabela precisa de revisão manual.';

function shortWeekday(weekday: Weekday): string {
  return WEEKDAYS.find(day => day.value === weekday)?.label ?? 'Seg';
}

function formatSummaryList(values: string[], emptyLabel: string): string {
  if (values.length === 0) return emptyLabel;
  if (values.length <= 4) return values.join(', ');
  return `${values.slice(0, 4).join(', ')} +${values.length - 4}`;
}

function updateImportItem(
  items: ScheduleImportItem[],
  itemId: string,
  updater: (item: ScheduleImportItem) => ScheduleImportItem
): ScheduleImportItem[] {
  return items.map(item => item.id === itemId ? updater(item) : item);
}

export function ScheduleImportSheet({ visible, monthKey, onClose, onImported }: Props) {
  const { colors } = useAppTheme();
  const [source, setSource] = useState<OcrSource | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrBlocks, setOcrBlocks] = useState<OcrTextBlock[]>([]);
  const [items, setItems] = useState<ScheduleImportItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const summary = useMemo(() => summarizeScheduleImport(items), [items]);
  const timeRanges = useMemo(() => (
    Array.from(new Set(items.map(item => `${item.start_time}-${item.end_time}`)))
      .sort((a, b) => a.localeCompare(b))
  ), [items]);
  const inputTheme = { backgroundColor: colors.background, color: colors.text, borderColor: colors.border };
  const hasOcrText = ocrText.trim().length > 0;
  const sourceButtonStyle = [
    styles.sourceButton,
    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
    ocrBusy && styles.sourceButtonDisabled,
  ];

  const reset = () => {
    setSource(null);
    setOcrText('');
    setOcrBlocks([]);
    setItems([]);
    setWarnings([]);
    setEditingId(null);
    setOcrBusy(false);
    setStatus('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const handlePickedSource = async (nextSource: OcrSource) => {
    setSource(nextSource);
    setOcrText('');
    setOcrBlocks([]);
    setItems([]);
    setWarnings([]);
    setEditingId(null);
    setStatus('Lendo imagem...');
    setOcrBusy(true);

    try {
      const recognized = await recognizeScheduleOcrFromSource(nextSource);
      setOcrText(recognized.text);
      setOcrBlocks(recognized.blocks);
      setStatus('Texto reconhecido. Revise antes de analisar.');
    } catch (error) {
      if (error instanceof OcrOfflineUnavailableError) {
        setStatus('O OCR offline precisa de uma build nativa para funcionar.');
      } else if (error instanceof OcrPdfUnsupportedError) {
        setStatus('A leitura direta de PDF será adicionada depois. Use foto ou imagem por enquanto.');
      } else if (error instanceof OcrLowConfidenceError) {
        setStatus(OCR_CLARITY_ERROR);
      } else {
        setStatus(OCR_CLARITY_ERROR);
      }
    } finally {
      setOcrBusy(false);
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setStatus('Permita o acesso à câmera para tirar a foto do horário.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
      mediaTypes: ['images'],
    });

    if (result.canceled || !result.assets[0]) return;
    await handlePickedSource({
      uri: result.assets[0].uri,
      name: result.assets[0].fileName ?? 'foto-horario.jpg',
      mimeType: result.assets[0].mimeType,
      type: 'camera',
    });
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus('Permita o acesso à galeria para escolher a imagem do horário.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 1,
      mediaTypes: ['images'],
    });

    if (result.canceled || !result.assets[0]) return;
    await handlePickedSource({
      uri: result.assets[0].uri,
      name: result.assets[0].fileName ?? 'imagem-horario.jpg',
      mimeType: result.assets[0].mimeType,
      type: 'image',
    });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ['application/pdf', 'image/*'],
    });

    if (result.canceled || !result.assets[0]) return;
    await handlePickedSource({
      uri: result.assets[0].uri,
      name: result.assets[0].name,
      mimeType: result.assets[0].mimeType,
      type: 'document',
    });
  };

  const analyze = () => {
    if (!hasOcrText) {
      setStatus('O campo de texto está vazio. Escolha uma imagem ou digite o texto manualmente.');
      return;
    }

    const preview = parseScheduleTableFromOcr({ text: ocrText, blocks: ocrBlocks });
    setItems(preview.items);
    setWarnings(preview.warnings);
    setEditingId(null);
    setStatus(preview.items.length > 0 ? 'Prévia gerada. Revise antes de salvar.' : OCR_TABLE_REVIEW_MESSAGE);
  };

  const save = async () => {
    if (items.length === 0) {
      setStatus('Nenhum horário identificado para salvar.');
      return;
    }

    setBusy(true);
    try {
      const result = await importWeeklySchedule(items, monthKey);
      const message = `Importação concluída: ${result.createdLessons} aula(s), ${result.createdClasses} turma(s) criada(s), ${result.skippedLessons} duplicada(s) ignorada(s).`;
      close();
      onImported(message);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = (itemId: string) => {
    setItems(current => current.filter(item => item.id !== itemId));
    if (editingId === itemId) setEditingId(null);
  };

  const updateItem = (itemId: string, updater: (item: ScheduleImportItem) => ScheduleImportItem) => {
    setItems(current => updateImportItem(current, itemId, updater));
  };

  return (
    <BottomSheetModal visible={visible} onClose={close} maxHeight="92%">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Importar Horário</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Use foto, print ou imagem.</Text>
        </View>
        <TouchableOpacity onPress={save} disabled={busy || ocrBusy || items.length === 0}>
          <Text style={[styles.saveText, { color: items.length === 0 ? colors.textMuted : colors.primary }]}>
            {busy ? 'Salvando...' : 'Salvar'}
          </Text>
        </TouchableOpacity>
      </View>

      <SheetScrollView extraKeyboardSpace={240}>
        <View style={styles.sourceGrid}>
          <TouchableOpacity style={sourceButtonStyle} onPress={pickFromCamera} disabled={ocrBusy}>
            <Text style={[styles.sourceTitle, { color: colors.text }]}>Tirar foto</Text>
            <Text style={[styles.sourceText, { color: colors.textMuted }]}>Usar câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sourceButtonStyle} onPress={pickFromGallery} disabled={ocrBusy}>
            <Text style={[styles.sourceTitle, { color: colors.text }]}>Galeria</Text>
            <Text style={[styles.sourceText, { color: colors.textMuted }]}>Foto ou print</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sourceButtonStyle} onPress={pickDocument} disabled={ocrBusy}>
            <Text style={[styles.sourceTitle, { color: colors.text }]}>PDF/Imagem</Text>
            <Text style={[styles.sourceText, { color: colors.textMuted }]}>Selecionar arquivo</Text>
          </TouchableOpacity>
        </View>

        {source && (
          <View style={[styles.notice, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.noticeTitle, { color: colors.text }]}>Arquivo selecionado</Text>
            <Text style={[styles.noticeText, { color: colors.textMuted }]}>{source.name ?? source.uri}</Text>
          </View>
        )}

        {status ? (
          <View style={[styles.statusBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.status, { color: colors.textMuted }]}>{status}</Text>
          </View>
        ) : null}

        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Texto reconhecido pelo OCR</Text>
        <TextInput
          style={[styles.ocrInput, inputTheme]}
          value={ocrText}
          onChangeText={setOcrText}
          placeholder={OCR_PLACEHOLDER}
          placeholderTextColor={colors.textMuted}
          multiline
        />

        {source && !ocrBusy && !hasOcrText ? (
          <TouchableOpacity style={[styles.retryButton, { borderColor: colors.border }]} onPress={() => handlePickedSource(source)}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Tentar ler novamente</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.analyzeButton, { backgroundColor: hasOcrText && !ocrBusy ? colors.primary : colors.textMuted }]}
          onPress={analyze}
          disabled={ocrBusy || !hasOcrText}
        >
          <Text style={styles.analyzeText}>{ocrBusy ? 'Lendo imagem...' : 'Analisar horário'}</Text>
        </TouchableOpacity>

        {warnings.map(warning => (
          <View key={warning} style={[styles.warningBox, { backgroundColor: colors.mode === 'dark' ? '#3A2C12' : '#FEF3C7' }]}>
            <Text style={[styles.warningText, { color: colors.mode === 'dark' ? '#FDE68A' : '#92400E' }]}>{warning}</Text>
          </View>
        ))}

        {items.length > 0 && (
          <>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>{summary.classes.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Turmas</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>{summary.subjects.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Componentes</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>{summary.lessons}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Aulas</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>{summary.reserved}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Reservas</Text>
              </View>
            </View>

            <View style={[styles.summaryDetails, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryDetailsTitle, { color: colors.text }]}>Prévia encontrada</Text>
              <Text style={[styles.summaryDetailsText, { color: colors.textMuted }]}>
                Turmas: {formatSummaryList(summary.classes, 'nenhuma')}
              </Text>
              <Text style={[styles.summaryDetailsText, { color: colors.textMuted }]}>
                Componentes: {formatSummaryList(summary.subjects, 'nenhum')}
              </Text>
              <Text style={[styles.summaryDetailsText, { color: colors.textMuted }]}>
                Horários: {formatSummaryList(timeRanges, 'nenhum')}
              </Text>
            </View>
          </>
        )}

        {items.map(item => {
          const editing = editingId === item.id;
          return (
            <View key={item.id} style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.reviewHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reviewTitle, { color: colors.text }]}>
                    {item.kind === 'class' ? `${item.className} · ${item.subject}` : item.title || 'Horário reservado'}
                  </Text>
                  <Text style={[styles.reviewSub, { color: colors.textMuted }]}>
                    {shortWeekday(item.weekday)} · {item.start_time} - {item.end_time}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setEditingId(editing ? null : item.id)}>
                  <Text style={[styles.reviewAction, { color: colors.primary }]}>{editing ? 'Fechar' : 'Editar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeItem(item.id)}>
                  <Text style={[styles.removeAction, { color: '#C0392B' }]}>Remover</Text>
                </TouchableOpacity>
              </View>

              {editing && (
                <View style={styles.editBox}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Dia</Text>
                  <View style={styles.weekdayRow}>
                    {WEEKDAYS.map(day => (
                      <TouchableOpacity
                        key={day.value}
                        style={[
                          styles.weekdayChip,
                          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                          item.weekday === day.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => updateItem(item.id, current => ({ ...current, weekday: day.value }))}
                      >
                        <Text style={[styles.weekdayText, { color: item.weekday === day.value ? '#FFF' : colors.textMuted }]}>
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.timeRow}>
                    <View style={styles.timeBox}>
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Início</Text>
                      <TimeInput
                        style={[styles.timeInput, inputTheme]}
                        value={item.start_time}
                        onChangeText={value => updateItem(item.id, current => ({ ...current, start_time: value }))}
                      />
                    </View>
                    <View style={styles.timeBox}>
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Término</Text>
                      <TimeInput
                        style={[styles.timeInput, inputTheme]}
                        value={item.end_time}
                        onChangeText={value => updateItem(item.id, current => ({ ...current, end_time: value }))}
                      />
                    </View>
                  </View>

                  {item.kind === 'class' ? (
                    <>
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Turma</Text>
                      <TextInput
                        style={[styles.input, inputTheme]}
                        value={item.className}
                        onChangeText={value => updateItem(item.id, current => ({ ...current, className: value, grade: value }))}
                      />
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Componente Curricular</Text>
                      <TextInput
                        style={[styles.input, inputTheme]}
                        value={item.subject}
                        onChangeText={value => updateItem(item.id, current => ({ ...current, subject: value }))}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Título do bloco</Text>
                      <TextInput
                        style={[styles.input, inputTheme]}
                        value={item.title}
                        onChangeText={value => updateItem(item.id, current => ({ ...current, title: value }))}
                      />
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 36 }} />
      </SheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  saveText: { fontSize: 14, fontWeight: '800', paddingTop: 3 },
  sourceGrid: { alignItems: 'stretch', flexDirection: 'row', gap: 8, marginBottom: 12 },
  sourceButton: { flex: 1, justifyContent: 'center', minHeight: 86, borderRadius: 14, borderWidth: 1, padding: 12 },
  sourceButtonDisabled: { opacity: 0.55 },
  sourceTitle: { fontSize: 13, fontWeight: '800' },
  sourceText: { fontSize: 11, marginTop: 3 },
  notice: { borderRadius: 12, borderWidth: 1, marginBottom: 10, padding: 10 },
  noticeTitle: { fontSize: 12, fontWeight: '800' },
  noticeText: { fontSize: 12, marginTop: 3 },
  statusBox: { borderRadius: 12, borderWidth: 1, marginBottom: 10, padding: 10 },
  status: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  fieldLabel: { fontSize: 11, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase' },
  ocrInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 13,
    lineHeight: 18,
    minHeight: 130,
    padding: 12,
    textAlignVertical: 'top',
  },
  input: { borderRadius: 12, borderWidth: 1, fontSize: 14, marginBottom: 10, padding: 11 },
  retryButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, marginTop: 10, paddingVertical: 10 },
  retryText: { fontSize: 13, fontWeight: '800' },
  analyzeButton: { alignItems: 'center', borderRadius: 14, marginTop: 10, marginBottom: 14, paddingVertical: 13 },
  analyzeText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  warningBox: { borderRadius: 12, marginBottom: 10, padding: 10 },
  warningText: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  summaryCard: { borderRadius: 14, borderWidth: 1, flexBasis: '48%', flexGrow: 1, padding: 12 },
  summaryValue: { fontSize: 22, fontWeight: '900' },
  summaryLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  summaryDetails: { borderRadius: 14, borderWidth: 1, marginBottom: 14, padding: 12 },
  summaryDetailsTitle: { fontSize: 13, fontWeight: '900', marginBottom: 6 },
  summaryDetailsText: { fontSize: 12, fontWeight: '700', lineHeight: 18 },
  reviewCard: { borderRadius: 14, borderWidth: 1, marginBottom: 10, padding: 12 },
  reviewHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  reviewTitle: { fontSize: 14, fontWeight: '800' },
  reviewSub: { fontSize: 12, marginTop: 3 },
  reviewAction: { fontSize: 12, fontWeight: '800' },
  removeAction: { fontSize: 12, fontWeight: '800' },
  editBox: { marginTop: 12 },
  weekdayRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  weekdayChip: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 9 },
  weekdayText: { fontSize: 12, fontWeight: '800' },
  timeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  timeBox: { flex: 1 },
  timeInput: { borderRadius: 12, borderWidth: 1, fontSize: 18, fontWeight: '800', padding: 11, textAlign: 'center' },
});
