import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { Spacing, FontSize } from '../theme';

function stripHtml(html = '') {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<td[^>]*>|<th[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/^\s*\|\s*/gm, '')
    .replace(/\s*\|\s*$/gm, '')
    .trim();
  return text.replace(/\n[ \t]*\n[ \t]*\n+/g, '\n\n');
}

function formatTimeLeft(expiry) {
  if (!expiry) return { text: '', colorKey: 'placeholder' };
  const date = expiry.toDate ? expiry.toDate() : new Date(expiry);
  const diffMs = date - new Date();
  
  if (diffMs <= 0) return { text: 'Expired', colorKey: 'expiryDanger' };
  
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return { text: `${mins}m left`, colorKey: 'expiryDanger' };
  
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { text: `${hours}h left`, colorKey: 'expiryDanger' };
  if (hours < 48) return { text: `${hours}h left`, colorKey: 'expiryWarn' };
  
  const days = Math.floor(hours / 24);
  return { text: `${days}d left`, colorKey: 'expiryOk' };
}

export default function NoteItem({ note, onOpen, onTogglePin }) {
  const { colors } = useTheme();
  const preview = stripHtml(note.content || '').slice(0, 80);
  const { text: timeText, colorKey } = formatTimeLeft(note.expiry);

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => onOpen(note)}
      style={[styles.container, { borderBottomColor: colors.inputBorder }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {note.id || 'Untitled'}
        </Text>
        <TouchableOpacity onPress={() => onTogglePin(note)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons 
            name={note.pinned ? "star" : "star-outline"} 
            size={22} 
            color={note.pinned ? colors.text : colors.placeholder} 
          />
        </TouchableOpacity>
      </View>
      
      <Text style={[styles.preview, { color: colors.textMuted }]} numberOfLines={3}>
        {note.password ? '🔒 Password protected' : (stripHtml(note.content || '') || 'No additional content')}
      </Text>
      
      <View style={styles.footer}>
        {timeText ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="time-outline" size={14} color={colors[colorKey] || colors.placeholder} />
            <Text style={[styles.date, { color: colors[colorKey] || colors.placeholder, fontWeight: '500' }]}>{timeText}</Text>
          </View>
        ) : <View />}
        {note.tags?.length > 0 && (
          <Text style={[styles.tags, { color: colors.placeholder }]}>
            {note.tags.map(t => `#${t.toLowerCase()}`).join('  ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '500',
    flex: 1,
    paddingRight: Spacing.md,
  },
  preview: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: FontSize.xs,
  },
  tags: {
    fontSize: FontSize.xs,
    letterSpacing: 0.5,
  }
});
