import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { Spacing, FontSize } from '../theme';
import CustomAlert from '../components/CustomAlert';
import Toast from '../components/Toast';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { doc, setDoc, deleteDoc, Timestamp, serverTimestamp, notesCollection, getDoc, updateDoc } from '../firebase';

function stripHtml(html = '') {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n') // Block elements to newlines
    .replace(/<\/tr>/gi, '\n') // Table rows to newlines
    .replace(/<td[^>]*>|<th[^>]*>/gi, ' | ') // Table cells to pipe separated
    .replace(/<[^>]+>/g, '') // Strip all remaining HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ') // Collapse multiple spaces
    .replace(/^\s*\|\s*/gm, '') // Remove leading pipes on a line
    .replace(/\s*\|\s*$/gm, '') // Remove trailing pipes on a line
    .trim();

  // Collapse 3+ newlines into just 2
  return text.replace(/\n[ \t]*\n[ \t]*\n+/g, '\n\n');
}

function parseTags(str = '') {
  return str.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
}

export default function EditorScreen({ route, navigation }) {
  const { colors, username } = useTheme();
  const { noteId, noteAuthor, notePassword, noteContent, notePinned = false, noteTags = [], isNew } = route.params;

  const [id, setId] = useState(noteId || '');
  const [author, setAuthor] = useState(noteAuthor || username || '');
  const [password, setPassword] = useState(notePassword || '');
  const [content, setContent] = useState(noteContent || '');
  const [pinned, setPinned] = useState(notePinned);
  const [tagsStr, setTagsStr] = useState((noteTags || []).join(', '));
  const [showMeta, setShowMeta] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew);

  const richText = useRef();
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info', mode: 'alert' });

  const showToast = useCallback((message) => setToast({ visible: true, message }), []);
  const showAlert = useCallback((message, title = 'Alert', type = 'info') => new Promise((resolve) => {
    setAlert({ visible: true, title, message, type, mode: 'alert', onConfirm: () => { setAlert(a => ({ ...a, visible: false })); resolve(true); }});
  }), []);
  const showConfirm = useCallback((message, title = 'Confirm', type = 'info') => new Promise((resolve) => {
    setAlert({ visible: true, title, message, type, mode: 'confirm', onConfirm: () => { setAlert(a => ({ ...a, visible: false })); resolve(true); }, onCancel: () => { setAlert(a => ({ ...a, visible: false })); resolve(false); }});
  }), []);

  const handleSave = async () => {
    let finalId = id.trim();
    if (!finalId) {
      const plainText = stripHtml(content);
      const words = plainText.split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 2) {
        finalId = words.slice(0, 2).join(' ');
      } else if (words.length === 1) {
        finalId = words[0];
      } else {
        finalId = 'Untitled Note';
      }
      // Sanitize finalId for Firestore (no slashes, dots, or control chars)
      finalId = finalId.replace(/[\/\\.]/g, '-').replace(/[\x00-\x1F\x7F]/g, '').trim();
      if (!finalId) finalId = 'Untitled Note';
      setId(finalId);
    }
    try {
      const expiry = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
      await setDoc(doc(notesCollection, finalId), {
        content,
        author: author.trim() || username || 'Anonymous',
        password: password.trim(),
        pinned,
        tags: parseTags(tagsStr),
        expiry: Timestamp.fromDate(expiry),
        updatedAt: serverTimestamp(),
      });
      showToast('Saved');
      setIsEditing(false);
    } catch (e) { showAlert(`Save failed: ${e.message}`); }
  };

  const handleDelete = async () => {
    if (!id.trim()) return;
    if (await showConfirm(`Delete "${id.trim()}"?`)) {
      await deleteDoc(doc(notesCollection, id.trim()));
      navigation.goBack();
    }
  };

  const exportTXT = async () => {
    try {
      const fileHeader = `Title: ${id || 'Untitled'}\nAuthor: ${author || 'Anonymous'}\nDate: ${new Date().toLocaleDateString()}\n\n`;
      const fullText = fileHeader + stripHtml(content);
      
      if (Platform.OS === 'web') {
        const blob = new Blob([fullText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(id || 'note').replace(/[\\/:"*?<>|]/g, '_').trim()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      
      const safeName = (id || 'note').replace(/[\\/:"*?<>|]/g, '_').trim();
      const uri = FileSystem.cacheDirectory + `${safeName}.txt`;
      await FileSystem.writeAsStringAsync(uri, fullText);
      await Sharing.shareAsync(uri);
    } catch (e) { showAlert(`Export failed: ${e.message}`); }
  };

  const exportPDF = async () => {
    try {
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: -apple-system, sans-serif; padding: 40px; color: #000; }
              h1 { font-size: 32px; font-weight: 300; margin-bottom: 8px; }
              .meta { color: #666; font-size: 14px; margin-bottom: 32px; border-bottom: 1px solid #ccc; padding-bottom: 16px; }
              .content { font-size: 16px; line-height: 1.7; white-space: pre-wrap; word-wrap: break-word; }
            </style>
          </head>
          <body>
            <h1>${id || 'Untitled Note'}</h1>
            <div class="meta">
              Author: ${author || 'Anonymous'} | Printed: ${new Date().toLocaleDateString()}
            </div>
            <div class="content">${content}</div>
          </body>
        </html>
      `;
      
      if (Platform.OS === 'web') {
        await Print.printToFileAsync({ html: htmlContent });
        return;
      }
      
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      const safeName = (id || 'note').replace(/[\\/:"*?<>|]/g, '_').trim();
      const newUri = FileSystem.cacheDirectory + `${safeName}.pdf`;
      await FileSystem.moveAsync({ from: uri, to: newUri });
      await Sharing.shareAsync(newUri);
    } catch (e) { showAlert(`PDF Export failed: ${e.message}`); }
  };

  const copyAllText = async () => {
    try {
      const textToCopy = `${id ? id.trim() + '\n\n' : ''}${stripHtml(content)}`.trim();
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        await Clipboard.setStringAsync(textToCopy);
      }
      showToast('Copied note text');
    } catch (e) {
      showAlert(`Copy failed: ${e.message}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.inputBorder }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {isEditing ? (
            <>
              <TouchableOpacity onPress={() => richText.current?.commandDOM('undo')}>
                <Ionicons name="return-up-back-outline" size={22} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => richText.current?.commandDOM('redo')}>
                <Ionicons name="return-up-forward-outline" size={22} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave}>
                <Ionicons name="checkmark-outline" size={26} color={colors.text} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={copyAllText} style={{ marginLeft: Spacing.sm }}>
            <Ionicons name="copy-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMeta(!showMeta)} style={{ marginLeft: Spacing.sm }}>
            <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          
          <View style={styles.titleContainer}>
            <TextInput
              style={[styles.largeTitleInput, { color: colors.text }]}
              placeholder="Title"
              placeholderTextColor={colors.placeholder}
              value={id}
              onChangeText={setId}
              editable={isNew}
              multiline
            />
          </View>

          {showMeta && (
            <View style={styles.metaSection}>
              <View style={[styles.settingRow, { borderBottomColor: colors.inputBorder }]}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Author</Text>
                <TextInput style={[styles.settingInput, { color: colors.textMuted }]} placeholder="Author" placeholderTextColor={colors.placeholder} value={author} onChangeText={setAuthor} />
              </View>

              <View style={[styles.settingRow, { borderBottomColor: colors.inputBorder }]}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Password</Text>
                <TextInput style={[styles.settingInput, { color: colors.textMuted }]} placeholder="Optional" placeholderTextColor={colors.placeholder} value={password} onChangeText={setPassword} secureTextEntry />
              </View>

              <View style={[styles.settingRow, { borderBottomColor: colors.inputBorder }]}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Tags</Text>
                <TextInput style={[styles.settingInput, { color: colors.textMuted }]} placeholder="Comma separated" placeholderTextColor={colors.placeholder} value={tagsStr} onChangeText={setTagsStr} autoCapitalize="none" />
              </View>

              <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Pin note</Text>
                <Switch value={pinned} onValueChange={setPinned} trackColor={{ false: colors.inputBorder, true: colors.text }} thumbColor={colors.bg} />
              </View>

              {!isNew && (
                <View style={styles.quickActions}>
                  <TouchableOpacity onPress={exportTXT}><Text style={[styles.actionBtnText, { color: colors.text }]}>Export TXT</Text></TouchableOpacity>
                  <TouchableOpacity onPress={exportPDF}><Text style={[styles.actionBtnText, { color: colors.text }]}>Export PDF</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete}><Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete Note</Text></TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <View style={styles.editorWrapper}>
            <RichEditor
              ref={richText}
              initialContentHTML={content}
              disabled={!isEditing}
              style={styles.richEditor}
              editorStyle={{
                backgroundColor: colors.bg,
                color: colors.text,
                placeholderColor: colors.placeholder,
                contentCSSText: `font-family: -apple-system, sans-serif; font-size: 16px; line-height: 1.7; padding: ${Spacing.xl}px; color: ${colors.text}; background-color: ${colors.bg}; white-space: pre-wrap; word-wrap: break-word;`,
              }}
              placeholder={isEditing ? "Start writing..." : ""}
              onChange={(html) => setContent(html)}
            />
          </View>
        </ScrollView>

        {isEditing && (
          <View style={[styles.toolbarWrapper, { borderTopColor: colors.inputBorder }]}>
            <RichToolbar
              editor={richText}
              keyboardShouldPersistTaps="always"
              actions={[actions.setBold, actions.setItalic, actions.setUnderline, actions.insertBulletsList, actions.insertOrderedList, actions.alignLeft, actions.alignCenter, actions.alignRight]}
              style={[styles.richBar, { backgroundColor: colors.bg }]}
              iconTint={colors.text}
              selectedIconTint={colors.textMuted}
              disabledIconTint={colors.placeholder}
            />
          </View>
        )}
      </KeyboardAvoidingView>
      <CustomAlert visible={alert.visible} title={alert.title} message={alert.message} type={alert.type} mode={alert.mode} onConfirm={alert.onConfirm} onCancel={alert.onCancel} />
      <Toast visible={toast.visible} message={toast.message} onHide={() => setToast({ visible: false, message: '' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingTop: Platform.select({ ios: 60, android: 40, default: 30 }), paddingBottom: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { paddingVertical: Spacing.xs },
  navText: { fontSize: FontSize.md },
  navIcon: { fontSize: FontSize.xl, fontWeight: '300' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  titleContainer: { paddingHorizontal: Spacing.xl, marginTop: Spacing.xl, marginBottom: Spacing.md },
  largeTitleInput: { fontSize: FontSize.xxl, fontWeight: '300', letterSpacing: -1, padding: 0 },
  metaSection: { marginHorizontal: Spacing.xl, marginBottom: Spacing.lg },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  settingLabel: { fontSize: FontSize.sm, fontWeight: '500' },
  settingInput: { flex: 1, textAlign: 'right', fontSize: FontSize.sm, padding: 0 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.lg, paddingBottom: Spacing.sm, marginTop: Spacing.sm },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: '500' },
  editorWrapper: { flex: 1, minHeight: 400 },
  richEditor: { flex: 1 },
  toolbarWrapper: { borderTopWidth: StyleSheet.hairlineWidth },
  richBar: { height: 50 },
});
