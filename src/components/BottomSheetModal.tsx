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
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <View style={[styles.root, presentation === 'floating' && styles.floatingRoot]}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            presentation === 'floating' ? styles.floatingSheet : styles.bottomSheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              maxHeight,
            },
            sheetStyle,
          ]}
        >
          <View style={styles.dragZone} {...panResponder.panHandlers}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>
          {children}
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
    paddingHorizontal: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
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
