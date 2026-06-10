import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LessonActivityOption } from '../types';
import { useAppTheme } from '../theme';

type Props = {
  options: LessonActivityOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  onCreateCustom: (label: string) => Promise<string | null>;
  onDeleteCustom: (option: LessonActivityOption) => void;
};

const OTHER_LABEL = 'Outros';

export function LessonActivitySelector({
  options,
  selected,
  onChange,
  onCreateCustom,
  onDeleteCustom,
}: Props) {
  const { colors } = useAppTheme();
  const [customLabel, setCustomLabel] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);
  const showCustomInput = selected.includes(OTHER_LABEL);

  const toggle = (label: string) => {
    if (selected.includes(label)) {
      onChange(selected.filter(item => item !== label));
      return;
    }

    onChange([...selected, label]);
  };

  const addCustom = async () => {
    const label = customLabel.trim();
    if (!label) return;

    setSavingCustom(true);
    const createdLabel = await onCreateCustom(label);
    setSavingCustom(false);

    if (createdLabel) {
      setCustomLabel('');
      onChange(Array.from(new Set([...selected.filter(item => item !== OTHER_LABEL), createdLabel])));
    }
  };

  return (
    <View>
      <View style={styles.grid}>
        {options.map(option => {
          const active = selected.includes(option.label);

          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.chip,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => toggle(option.label)}
              onLongPress={() => {
                if (option.is_custom) onDeleteCustom(option);
              }}
              activeOpacity={0.78}
            >
              <Text style={[
                styles.chipText,
                { color: colors.text },
                active && { color: '#FFF', fontWeight: '800' },
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showCustomInput && (
        <View style={styles.customRow}>
          <TextInput
            style={[styles.customInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={customLabel}
            onChangeText={setCustomLabel}
            placeholder="Nova atividade"
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.customBtn, { backgroundColor: colors.secondary }, savingCustom && { opacity: 0.6 }]}
            onPress={addCustom}
            disabled={savingCustom}
          >
            <Text style={styles.customBtnText}>Adicionar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  customInput: {
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customBtn: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  customBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
