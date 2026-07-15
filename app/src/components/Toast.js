import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Spacing, FontSize } from '../theme';

export default function Toast({ visible, message, duration = 3000, onHide }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onHide?.());
      }, duration);
    } else {
      opacity.setValue(0);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, message]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.text, opacity }]} pointerEvents="none">
      <Text style={[styles.text, { color: colors.bg }]} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 50, alignSelf: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, zIndex: 9999 },
  text: { fontSize: FontSize.sm },
});
