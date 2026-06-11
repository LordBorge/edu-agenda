import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  compact?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ActionButton({ label, onPress, compact = false, disabled = false, style }: Props) {
  const { colors } = useAppTheme();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        compact ? styles.compactButton : styles.regularButton,
        {
          backgroundColor: disabled ? colors.textMuted : colors.primary,
          shadowOpacity: colors.mode === 'dark' || disabled ? 0 : 0.14,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.84}
      disabled={disabled}
    >
      <View style={styles.iconCircle}>
        <Text style={[styles.plus, { color: colors.primary }]}>+</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3,
  },
  regularButton: {
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  compactButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 999,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  plus: {
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  label: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
