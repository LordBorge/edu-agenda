import React, { useState } from 'react';
import {
  Alert, Image, ScrollView, StatusBar, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProfessionalProfile } from '../../database/queries';
import { SchedulePeriod } from '../../types';

const PERIODS: Array<{ key: SchedulePeriod; label: string }> = [
  { key: 'integral', label: 'Integral' },
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
];

function togglePeriod(periods: SchedulePeriod[], period: SchedulePeriod): SchedulePeriod[] {
  if (periods.includes(period)) {
    return periods.length === 1 ? periods : periods.filter(item => item !== period);
  }
  return [...periods, period];
}

export function WelcomeScreen({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState('');
  const [subjects, setSubjects] = useState('');
  const [periods, setPeriods] = useState<SchedulePeriod[]>(['integral']);

  const handleStart = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Informe seu nome para configurar o app.');
      return;
    }

    await updateProfessionalProfile({
      name: name.trim(),
      subjects: subjects.trim(),
      work_periods: periods.join(','),
      theme_preference: 'system',
      onboarded: 1,
    });
    onComplete();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" translucent={false} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}>
          <Image source={require('../../../assets/splash-logo.png')} style={styles.brandImage} resizeMode="contain" />
        </View>
        <Text style={styles.title}>Bem-vindo ao Edu Agenda</Text>
        <Text style={styles.subtitle}>Configure seu perfil profissional para deixar a agenda com a sua rotina.</Text>

        <Text style={styles.fieldLabel}>Nome profissional</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex: Ana Paula"
          autoCapitalize="words"
        />

        <Text style={styles.fieldLabel}>Componentes Curriculares que trabalha</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={subjects}
          onChangeText={setSubjects}
          placeholder="Ex: Inglês, Projeto de Vida, Redação"
          multiline
        />

        <Text style={styles.fieldLabel}>Períodos de trabalho</Text>
        <View style={styles.periodRow}>
          {PERIODS.map(period => {
            const active = periods.includes(period.key);
            return (
              <TouchableOpacity
                key={period.key}
                style={[styles.periodChip, active && styles.periodChipActive]}
                onPress={() => setPeriods(current => togglePeriod(current, period.key))}
              >
                <Text style={[styles.periodText, active && styles.periodTextActive]}>{period.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
          <Text style={styles.primaryText}>Começar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  brandMark: {
    width: 150, height: 150, borderRadius: 24,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
    borderWidth: 1, borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  brandImage: { width: 138, height: 138 },
  title: { fontSize: 28, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', lineHeight: 20, marginBottom: 28 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#FFF', borderRadius: 10, padding: 13, fontSize: 15,
    color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16,
  },
  textArea: { minHeight: 76, textAlignVertical: 'top' },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 26 },
  periodChip: {
    flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10,
    backgroundColor: '#EEF6F8', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  periodChipActive: { backgroundColor: '#0F4C81', borderColor: '#0F4C81' },
  periodText: { fontSize: 13, color: '#64748B', fontWeight: '700' },
  periodTextActive: { color: '#FFF' },
  primaryBtn: {
    backgroundColor: '#0F4C81', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
