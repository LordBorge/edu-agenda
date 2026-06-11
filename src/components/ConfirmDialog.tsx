import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../theme';

export type ConfirmDialogVariant = 'danger' | 'info';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
  variant?: ConfirmDialogVariant;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onCancel,
  onConfirm,
}: Props) {
  const { colors } = useAppTheme();
  const confirmColor = variant === 'danger' ? '#C0392B' : colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          <ScrollView
            style={styles.messageScroll}
            contentContainerStyle={styles.messageContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
          </ScrollView>

          <View style={styles.actions}>
            {cancelLabel ? (
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelText, { color: colors.primary }]}>{cancelLabel}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: confirmColor }, !cancelLabel && styles.singleButton]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.44)',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    maxHeight: '78%',
    padding: 22,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  messageScroll: {
    maxHeight: 260,
    marginBottom: 22,
  },
  messageContent: {
    flexGrow: 1,
  },
  message: {
    fontSize: 16,
    lineHeight: 23,
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
    borderRadius: 14,
    flex: 1,
    paddingVertical: 12,
  },
  singleButton: {
    flex: 1,
    paddingHorizontal: 24,
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
