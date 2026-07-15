import React from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Spacing, FontSize, Radius } from '../theme';

export default function PasswordModal({ visible, title, submitText = 'Open', value, onChangeText, onSubmit, onCancel }) {
  const { colors } = useTheme();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.dialog, { backgroundColor: colors.bg, borderColor: colors.inputBorder }]}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            
            <TextInput
              secureTextEntry
              value={value}
              onChangeText={onChangeText}
              placeholder="Password"
              placeholderTextColor={colors.placeholder}
              onSubmitEditing={onSubmit}
              autoFocus
              style={[styles.input, { borderBottomColor: colors.inputBorder, color: colors.text }]}
            />
            
            <View style={styles.buttons}>
              <TouchableOpacity onPress={onCancel} style={styles.btn}>
                <Text style={[styles.btnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onSubmit} style={styles.btn}>
                <Text style={[styles.btnText, { color: colors.text }]}>{submitText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  title: { fontSize: FontSize.lg, fontWeight: '500', marginBottom: Spacing.xl },
  input: { fontSize: FontSize.base, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: Spacing.xl },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg },
  btn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  btnText: { fontSize: FontSize.md, fontWeight: '500' },
});
