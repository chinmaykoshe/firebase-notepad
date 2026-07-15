import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Spacing, FontSize } from '../theme';

export default function LegalDialog({ visible, type, onClose }) {
  const { colors } = useTheme();
  const isPrivacy = type === 'privacy';

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{isPrivacy ? 'Privacy Policy' : 'Terms'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={{ color: colors.textMuted, fontSize: FontSize.lg }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {isPrivacy ? (
            <Text style={[styles.text, { color: colors.text }]}>
              This is an open-source, client-side focused application. 
              {"\n\n"}
              We do not collect personal data. Any notes created are stored in a public Firebase database. If you use a password, it acts as a basic lock and is not heavily encrypted.
              {"\n\n"}
              Do not store sensitive, personal, or financial information on this platform.
            </Text>
          ) : (
            <Text style={[styles.text, { color: colors.text }]}>
              By using Firebase Notepad, you agree that this service is provided "as is" without warranty of any kind.
              {"\n\n"}
              Notes expire automatically after 4 days. The creator of this app is not responsible for any lost data or breached information.
              {"\n\n"}
              Use at your own risk.
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '300' },
  closeBtn: { padding: Spacing.xs },
  body: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  text: { fontSize: FontSize.md, lineHeight: 26 },
});
