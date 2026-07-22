import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  RefreshControl,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { Spacing, FontSize } from '../theme';
import NoteItem from '../components/NoteItem';
import PasswordModal from '../components/PasswordModal';
import CustomAlert from '../components/CustomAlert';
import Toast from '../components/Toast';
import { doc, getDoc, notesCollection, onSnapshot, orderBy, query, updateDoc, deleteDoc, reconnectFirestore } from '../firebase';

function stripHtml(html = '') {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const TABS = ['All', 'Pinned'];
const SEARCH_DEBOUNCE_MS = 300;

// ── Skeleton loading card ──────────────────────────────────────────────────
function SkeletonCard({ colors }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View style={[skeletonStyles.card, { opacity, borderBottomColor: colors.inputBorder }]}>
      <View style={[skeletonStyles.titleBar, { backgroundColor: colors.placeholder }]} />
      <View style={[skeletonStyles.bodyBar, { backgroundColor: colors.placeholder, width: '80%' }]} />
      <View style={[skeletonStyles.bodyBar, { backgroundColor: colors.placeholder, width: '55%' }]} />
      <View style={[skeletonStyles.footerBar, { backgroundColor: colors.placeholder }]} />
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: { paddingVertical: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  titleBar: { height: 14, borderRadius: 4, marginBottom: 10, width: '60%' },
  bodyBar: { height: 11, borderRadius: 4, marginBottom: 6 },
  footerBar: { height: 10, borderRadius: 4, width: '30%', marginTop: 6 },
});

export default function NotesListScreen({ navigation }) {
  const { colors } = useTheme();
  const [notes, setNotes] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [pwModal, setPwModal] = useState({ visible: false, note: null, action: 'open', value: '' });
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info', mode: 'alert' });

  const unsubscribeRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const showToast = useCallback((msg) => setToast({ visible: true, message: msg }), []);
  const showAlert = useCallback((message, title = 'Alert', type = 'info') =>
    new Promise((resolve) => {
      setAlert({
        visible: true, title, message, type, mode: 'alert',
        onConfirm: () => { setAlert(a => ({ ...a, visible: false })); resolve(true); },
      });
    }), []);

  // ── Debounce search text ─────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  // ── Subscribe to Firestore ───────────────────────────────────────────────
  const subscribeToNotes = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    setNetworkError(false);

    const q = query(notesCollection, orderBy('__name__'));
    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: false },
      (snapshot) => {
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
            updatedAt: data.updatedAt,
          };
        });
        setNotes(loaded);
        setLoading(false);
        setRefreshing(false);
        setNetworkError(false);
      },
      (error) => {
        console.warn('[Firestore] snapshot error:', error.message);
        setLoading(false);
        setRefreshing(false);
        setNetworkError(true);
      }
    );

    unsubscribeRef.current = unsubscribe;
  }, []);

  // ── Initial subscription ─────────────────────────────────────────────────
  useEffect(() => {
    subscribeToNotes();
    return () => { if (unsubscribeRef.current) unsubscribeRef.current(); };
  }, [subscribeToNotes]);

  // ── Reconnect Firestore when app comes back to foreground ────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        await reconnectFirestore();
        subscribeToNotes();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [subscribeToNotes]);

  // ── Pull-to-refresh ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reconnectFirestore();
    subscribeToNotes();
  }, [subscribeToNotes]);

  // ── Retry button ─────────────────────────────────────────────────────────
  const handleRetry = useCallback(async () => {
    setLoading(true);
    setNetworkError(false);
    await reconnectFirestore();
    subscribeToNotes();
  }, [subscribeToNotes]);

  // ── Filter notes ──────────────────────────────────────────────────────────
  const filteredNotes = notes
    .filter((n) => {
      const q = debouncedSearch.trim().toLowerCase();
      if (!q) return true;
      return n.id.toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        stripHtml(n.content).toLowerCase().includes(q);
    })
    .filter((n) => activeTab === 'All' ? true : n.pinned);

  // ── Note actions ──────────────────────────────────────────────────────────
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
      } catch (err) { await showAlert('Failed to load note. Check your connection.', 'Error', 'danger'); }
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
    } catch (err) { await showAlert('Network error — could not open note.', 'Network Error', 'danger'); }
  }

  async function handleTogglePin(note) {
    try {
      await updateDoc(doc(notesCollection, note.id), { pinned: !note.pinned });
      showToast(note.pinned ? 'Unpinned' : 'Pinned');
    } catch (err) {
      showToast('Network error: try again');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const renderContent = () => {
    // Loading skeleton (first load only)
    if (loading) {
      return (
        <View style={{ paddingHorizontal: Spacing.xl }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} colors={colors} />
          ))}
        </View>
      );
    }

    // Error state
    if (networkError) {
      return (
        <View style={styles.errorState}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.placeholder} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Couldn't connect</Text>
          <Text style={[styles.errorSub, { color: colors.placeholder }]}>
            Check your internet connection and try again.
          </Text>
          <TouchableOpacity style={[styles.retryBtn, { borderColor: colors.text }]} onPress={handleRetry}>
            <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NoteItem note={item} onOpen={handleOpen} onTogglePin={handleTogglePin} />
        )}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.placeholder}
            colors={[colors.text]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.placeholder }]}>No notes found.</Text>
          </View>
        }
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notes</Text>
          {/* Live indicator dot */}
          {!loading && !networkError && (
            <View style={[styles.liveDot, { backgroundColor: '#4ADE80' }]} />
          )}
          {networkError && (
            <Ionicons name="warning-outline" size={18} color={colors.placeholder} />
          )}
        </View>
        <TextInput
          style={[styles.searchInput, { color: colors.text, borderBottomColor: colors.inputBorder }]}
          placeholder="Search notes..."
          placeholderTextColor={colors.placeholder}
          value={searchText}
          onChangeText={setSearchText}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
                <Text style={[styles.tabText, { color: isActive ? colors.text : colors.placeholder, fontWeight: isActive ? '600' : '400' }]}>
                  {tab}
                </Text>
                {isActive && <View style={[styles.tabUnderline, { backgroundColor: colors.text }]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {renderContent()}

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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '300',
    letterSpacing: -1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 2,
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
    alignItems: 'center',
  },
  tabText: {
    fontSize: FontSize.sm,
    letterSpacing: 0.5,
  },
  tabUnderline: {
    height: 1.5,
    width: '100%',
    marginTop: 3,
    borderRadius: 1,
  },
  listContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    gap: 12,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: '500',
    marginTop: 8,
  },
  errorSub: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 24,
    borderWidth: 1,
  },
  retryText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    letterSpacing: 0.5,
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
