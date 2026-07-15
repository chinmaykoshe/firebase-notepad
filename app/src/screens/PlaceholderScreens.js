import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Platform, TextInput } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Spacing, FontSize } from '../theme';
import LegalDialog from '../components/LegalDialog';

export function SettingsScreen() {
  const { colors, isDark, toggleTheme, username, setUsername } = useTheme();
  const [legal, setLegal] = React.useState({ visible: false, type: 'privacy' });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Preferences</Text>
          
          <View style={[styles.row, { borderBottomColor: colors.inputBorder }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Author Name</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              style={{ color: colors.textMuted, fontSize: FontSize.md, textAlign: 'right', minWidth: 100 }}
              placeholder="Your Name"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <View style={[styles.row, { borderBottomColor: colors.inputBorder }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.inputBorder, true: colors.text }}
              thumbColor={colors.bg}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Legal</Text>
          <TouchableOpacity
            style={[styles.rowBtn, { borderBottomColor: colors.inputBorder }]}
            onPress={() => setLegal({ visible: true, type: 'privacy' })}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>Privacy Policy</Text>
            <Text style={{ color: colors.placeholder, fontSize: 16 }}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rowBtn, { borderBottomColor: 'transparent' }]}
            onPress={() => setLegal({ visible: true, type: 'terms' })}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>Terms & Conditions</Text>
            <Text style={{ color: colors.placeholder, fontSize: 16 }}>→</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LegalDialog
        visible={legal.visible}
        type={legal.type}
        onClose={() => setLegal({ ...legal, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.select({ ios: 60, android: 40, default: 30 }),
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '300',
    letterSpacing: -1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xxl,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: FontSize.md,
    fontWeight: '400',
  },
});
