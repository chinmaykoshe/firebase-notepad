import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { Spacing, FontSize } from '../theme';
import NoteItem from '../components/NoteItem';
import PasswordModal from '../components/PasswordModal';
import CustomAlert from '../components/CustomAlert';
import Toast from '../components/Toast';
import { doc, getDoc, notesCollection, onSnapshot, orderBy, query, updateDoc, deleteDoc } from '../firebase';

function stripHtml(html = '') {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const TABS = ['All', 'Pinned'];

export default function NotesListScreen({ navigation }) {
  const { colors } = useTheme();
  const [notes, setNotes] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [toast, setToast] = useState({ visible: false, message: '' });

  const [pwModal, setPwModal] = useState({ visible: false, note: null, action: 'open', value: '' });
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info', mode: 'alert' });

  const showToast = useCallback((msg) => setToast({ visible: true, message: msg }), []);
  const showAlert = useCallback((message, title = 'Alert', type = 'info') =>
    new Promise((resolve) => {
      setAlert({ visible: true, title, message, type, mode: 'alert',
        onConfirm: () => { setAlert(a => ({ ...a, visible: false })); resolve(true); }
      });
    }), []);

  useEffect(() => {
    const q = query(notesCollection, orderBy('__name__'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((item) => {
        const data = item.data() || {};
        return {
          id: item.id,
          author: data.author,
          content: data.content,
          expiry: data.expiry,
          password: data.password,
          pinned: data.pinned,
          tags: data.tags,
        };
      });
      setNotes(loaded);
    });
    return () => unsubscribe();
  }, []);

  const filteredNotes = notes
    .filter((n) => {
      const q = searchText.trim().toLowerCase();
      if (!q) return true;
      return n.id.toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        stripHtml(n.content).toLowerCase().includes(q);
    })
    .filter((n) => activeTab === 'All' ? true : n.pinned);

  async function handleOpen(note) {
    if (note.password) {
      setPwModal({ visible: true, note, action: 'open', value: '' });
    } else {
      try {
        const snapshot = await getDoc(doc(notesCollection, note.id));
        const data = snapshot.data() || note;
        navigation.navigate('Editor', {
          noteId: note.id, noteAuthor: data.author, notePassword: data.password,
          noteContent: data.content, notePinned: data.pinned, noteTags: data.tags, isNew: false,
        });
      } catch (err) { await showAlert('Failed to load note data', 'Error', 'danger'); }
    }
  }

  async function handlePasswordSubmit() {
    const { note, value } = pwModal;
    if (value !== note.password) {
      setPwModal(p => ({ ...p, visible: false }));
      await showAlert('Incorrect password', 'Error', 'danger');
      return;
    }
    setPwModal(p => ({ ...p, visible: false }));
    try {
      const snapshot = await getDoc(doc(notesCollection, note.id));
      const data = snapshot.data() || note;
      navigation.navigate('Editor', {
        noteId: note.id, noteAuthor: data.author, notePassword: data.password,
        noteContent: data.content, notePinned: data.pinned, noteTags: data.tags, isNew: false,
      });
    } catch (err) { await showAlert('Failed to verify note securely', 'Network Error', 'danger'); }
  }

  async function handleTogglePin(note) {
    try {
      await updateDoc(doc(notesCollection, note.id), { pinned: !note.pinned });
      showToast(note.pinned ? 'Unpinned' : 'Pinned');
    } catch (err) {
      showToast('Network error: Action failed');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notes</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.text, borderBottomColor: colors.inputBorder }]}
          placeholder="Search..."
          placeholderTextColor={colors.placeholder}
          value={searchText}
          onChangeText={setSearchText}
          clearButtonMode="while-editing"
        />
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
                <Text style={[styles.tabText, { color: isActive ? colors.text : colors.placeholder, fontWeight: isActive ? '600' : '400' }]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NoteItem note={item} onOpen={handleOpen} onTogglePin={handleTogglePin} />
        )}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.placeholder }]}>No notes found.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.text }]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Editor', { isNew: true })}
      >
        <Ionicons name="add" size={34} color={colors.bg} />
      </TouchableOpacity>

      <PasswordModal
        visible={pwModal.visible}
        title="Protected Note"
        subtitle="Enter password"
        submitText="Open"
        value={pwModal.value}
        onChangeText={(v) => setPwModal(p => ({ ...p, value: v }))}
        onSubmit={handlePasswordSubmit}
        onCancel={() => setPwModal(p => ({ ...p, visible: false }))}
      />
      <CustomAlert visible={alert.visible} title={alert.title} message={alert.message} type={alert.type} mode={alert.mode} onConfirm={alert.onConfirm} />
      <Toast visible={toast.visible} message={toast.message} onHide={() => setToast({ visible: false, message: '' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.select({ ios: 60, android: 40, default: 30 }),
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '300',
    letterSpacing: -1,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    fontSize: FontSize.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.lg,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  tabBtn: {
    paddingBottom: Spacing.xs,
  },
  tabText: {
    fontSize: FontSize.sm,
    letterSpacing: 0.5,
  },
  listContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  emptyState: {
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
});
