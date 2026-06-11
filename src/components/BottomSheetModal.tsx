import React, { ReactNode, useMemo } from 'react';
import {
  Modal,
  PanResponder,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';

type BottomSheetPresentation = 'sheet' | 'floating';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: ViewStyle['maxHeight'];
  presentation?: BottomSheetPresentation;
  animationType?: 'none' | 'slide' | 'fade';
  sheetStyle?: StyleProp<ViewStyle>;
};

export function BottomSheetModal({
  visible,
  onClose,
  children,
  maxHeight = '88%',
  presentation = 'floating',
  animationType = 'fade',
  sheetStyle,
}: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 14);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2
    ),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 56 || gesture.vy > 0.75) {
        onClose();
      }
    },
  }), [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            presentation === 'floating' && styles.floatingRoot,
            presentation === 'floating' && { paddingBottom: safeBottom },
          ]}
        >
          <View
            style={[
              styles.sheet,
              presentation === 'floating' ? styles.floatingSheet : styles.bottomSheet,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                maxHeight,
                paddingBottom: presentation === 'floating' ? 22 : safeBottom + 22,
              },
              sheetStyle,
            ]}
          >
            <View style={styles.dragZone} {...panResponder.panHandlers}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
            </View>
            <View style={styles.content}>
              {children}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  floatingRoot: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
  },
  content: {
    flexShrink: 1,
    minHeight: 0,
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  floatingSheet: {
    borderRadius: 22,
    borderWidth: 1,
    paddingBottom: 22,
  },
  dragZone: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
