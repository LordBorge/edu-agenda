import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { markInitialRegistrationComplete, updateProfessionalProfile } from '../../database/queries';
import { SchedulePeriod } from '../../types';

const PERIODS: Array<{ key: SchedulePeriod; label: string }> = [
  { key: 'integral', label: 'Integral' },
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
];

export function WelcomeScreen({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState('');
  const [subjects, setSubjects] = useState('');
  const [period, setPeriod] = useState<SchedulePeriod>('integral');
  const [formErrors, setFormErrors] = useState<{ name?: string; subjects?: string }>({});

  const handleStart = async () => {
    const nextErrors = {
      name: name.trim() ? undefined : 'Informe seu nome para configurar o app',
      subjects: subjects.trim() ? undefined : 'Informe pelo menos um componente curricular',
    };

    if (nextErrors.name || nextErrors.subjects) {
      setFormErrors(nextErrors);
      return;
    }

    await Promise.all([
      updateProfessionalProfile({
        name: name.trim(),
        subjects: subjects.trim(),
        work_periods: period,
        theme_preference: 'system',
        onboarded: 0,
      }),
      markInitialRegistrationComplete(),
    ]);

    onComplete();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" translucent={false} />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandMark}>
            <Image source={require('../../../assets/icon.png')} style={styles.brandImage} resizeMode="contain" />
          </View>

          <Text style={styles.title}>Bem-vindo ao EduAgenda</Text>
          <Text style={styles.subtitle}>Configure seus dados para deixar a agenda com a sua rotina.</Text>

          <Text style={styles.fieldLabel}>Nome</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={value => {
              setName(value);
              if (formErrors.name) setFormErrors(current => ({ ...current, name: undefined }));
            }}
            placeholder="Ex.: Ana Paula"
            autoCapitalize="words"
            returnKeyType="next"
          />
          {formErrors.name ? <Text style={styles.errorText}>{formErrors.name}</Text> : null}

          <Text style={styles.fieldLabel}>Componentes curriculares</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={subjects}
            onChangeText={value => {
              setSubjects(value);
              if (formErrors.subjects) setFormErrors(current => ({ ...current, subjects: undefined }));
            }}
            placeholder="Ex.: Inglês, Projeto de Vida, Redação"
            multiline
            textAlignVertical="top"
          />
          {formErrors.subjects ? <Text style={styles.errorText}>{formErrors.subjects}</Text> : null}

          <Text style={styles.fieldLabel}>Período de trabalho</Text>
          <View style={styles.periodRow}>
            {PERIODS.map(item => {
              const active = period === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.periodChip, active && styles.periodChipActive]}
                  onPress={() => setPeriod(item.key)}
                >
                  <Text style={[styles.periodText, active && styles.periodTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
            <Text style={styles.primaryText}>Começar</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  keyboard: { flex: 1 },
  body: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  brandMark: {
    alignSelf: 'center',
    width: 122,
    height: 122,
    borderRadius: 28,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  brandImage: { width: 104, height: 104 },
  title: { fontSize: 28, fontWeight: '800', color: '#1E293B', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', lineHeight: 20, marginBottom: 28, textAlign: 'center' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, textTransform: 'uppercase' },
  errorText: { color: '#C0392B', fontSize: 12, fontWeight: '700', marginTop: -8, marginBottom: 12 },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  textArea: { minHeight: 94 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 26 },
  periodChip: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#EEF6F8',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  periodChipActive: { backgroundColor: '#0F4C81', borderColor: '#0F4C81' },
  periodText: { fontSize: 14, color: '#1E293B', fontWeight: '800', textAlign: 'center' },
  periodTextActive: { color: '#FFF' },
  primaryBtn: {
    backgroundColor: '#0F4C81',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
