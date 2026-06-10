import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../theme';
import { BottomSheetModal } from './BottomSheetModal';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  onCancel,
  onConfirm,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <BottomSheetModal visible={visible} onClose={onCancel} maxHeight="58%">
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={[styles.warningBadge, { backgroundColor: colors.mode === 'dark' ? '#4A282D' : '#FDEDEC' }]}>
            <Text style={[styles.warningText, { color: colors.mode === 'dark' ? '#F1948A' : '#C0392B' }]}>!</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>

        <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelText, { color: colors.primary }]}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmButton} onPress={onConfirm} activeOpacity={0.85}>
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 4 },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  warningBadge: {
    alignItems: 'center',
    backgroundColor: '#FDEDEC',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  warningText: {
    color: '#C0392B',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#C0392B',
    borderRadius: 14,
    flex: 1,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '800',
  },
  confirmText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
