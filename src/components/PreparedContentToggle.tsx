import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../theme';

type Props = {
  value: boolean;
  onChange: (value: boolean) => void;
};

export function PreparedContentToggle({ value, onChange }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textMuted }]}>Material preparado</Text>
      <View style={styles.row}>
        {[
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ].map(option => {
          const active = value === option.value;
          return (
            <TouchableOpacity
              key={option.label}
              activeOpacity={0.78}
              style={[
                styles.option,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[
                styles.optionText,
                { color: colors.text },
                active && { color: '#FFF', fontWeight: '800' },
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 9,
  },
  optionText: { fontSize: 12, fontWeight: '700' },
});
