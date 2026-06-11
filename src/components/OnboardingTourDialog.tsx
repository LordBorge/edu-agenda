import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../theme';
import { BottomSheetModal } from './BottomSheetModal';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

export function OnboardingTourDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={() => undefined}
      maxHeight="58%"
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

        <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={onConfirm}
          activeOpacity={0.86}
        >
          <Text style={styles.primaryText}>{confirmLabel}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingBottom: 28,
    minHeight: 230,
  },
  content: {
    alignItems: 'stretch',
    minHeight: 180,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 22,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    minHeight: 52,
    paddingVertical: 15,
  },
  primaryText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
