import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Spacing, FontSize, Radius } from '../theme';

export default function CustomAlert({ visible, title = 'Alert', message = '', type = 'info', mode = 'alert', onConfirm, onCancel }) {
  const { colors } = useTheme();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={mode === 'alert' ? onConfirm : onCancel}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.dialog, { backgroundColor: colors.bg, borderColor: colors.inputBorder }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
          <View style={styles.footer}>
            {mode === 'confirm' && (
              <TouchableOpacity onPress={onCancel} style={styles.btn}>
                <Text style={[styles.btnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onConfirm} style={styles.btn}>
              <Text style={[styles.btnText, { color: type === 'danger' ? colors.danger : colors.text }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  dialog: { 
    width: '100%', 
    maxWidth: 320, 
    padding: Spacing.xxl,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 10 },
    }),
  },
  title: { fontSize: FontSize.lg, fontWeight: '500', marginBottom: Spacing.md },
  message: { fontSize: FontSize.base, lineHeight: 22, marginBottom: Spacing.xl },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg },
  btn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  btnText: { fontSize: FontSize.md, fontWeight: '500' },
});
