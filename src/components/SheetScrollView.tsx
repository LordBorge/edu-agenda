import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  StyleProp,
  TextInput,
  ViewStyle,
} from 'react-native';

type Props = ScrollViewProps & {
  extraKeyboardSpace?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

type MeasurableInput = {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
};

type MeasurableScrollView = ScrollView & {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
};

export function SheetScrollView({
  children,
  contentContainerStyle,
  extraKeyboardSpace = 180,
  keyboardShouldPersistTaps = 'handled',
  keyboardDismissMode = 'interactive',
  onScroll,
  onTouchEnd,
  showsVerticalScrollIndicator = false,
  style,
  ...props
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const keyboardTopRef = useRef(Dimensions.get('window').height);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const scrollFocusedInputIntoView = useCallback(() => {
    const scrollView = scrollRef.current as MeasurableScrollView | null;
    const focusedInput = TextInput.State.currentlyFocusedInput?.() as MeasurableInput | null;

    if (!scrollView?.measureInWindow || !focusedInput?.measureInWindow) return;

    scrollView.measureInWindow((scrollX, scrollY, scrollWidth, scrollHeight) => {
      focusedInput.measureInWindow?.((inputX, inputY, inputWidth, inputHeight) => {
        const viewportBottom = Math.min(
          scrollY + scrollHeight,
          keyboardTopRef.current || Dimensions.get('window').height
        ) - 18;
        const viewportTop = scrollY + 12;
        const inputBottom = inputY + inputHeight;

        if (inputBottom > viewportBottom) {
          scrollView.scrollTo({
            y: Math.max(0, scrollYRef.current + inputBottom - viewportBottom),
            animated: true,
          });
          return;
        }

        if (inputY < viewportTop) {
          scrollView.scrollTo({
            y: Math.max(0, scrollYRef.current - (viewportTop - inputY)),
            animated: true,
          });
        }
      });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, event => {
      keyboardTopRef.current = event.endCoordinates?.screenY ?? (
        Dimensions.get('window').height - (event.endCoordinates?.height ?? 0)
      );
      setKeyboardVisible(true);
      setTimeout(scrollFocusedInputIntoView, 90);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardTopRef.current = Dimensions.get('window').height;
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollFocusedInputIntoView]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
    onScroll?.(event);
  };

  return (
    <ScrollView
      ref={scrollRef}
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      scrollEventThrottle={16}
      style={[styles.scroll, style]}
      onScroll={handleScroll}
      onTouchEnd={event => {
        onTouchEnd?.(event);
        setTimeout(scrollFocusedInputIntoView, 110);
      }}
      contentContainerStyle={[
        contentContainerStyle,
        keyboardVisible && { paddingBottom: extraKeyboardSpace },
      ]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexShrink: 1,
    minHeight: 0,
  },
});
