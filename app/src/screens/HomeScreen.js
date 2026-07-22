import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  AppState,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { Spacing, Radius, FontSize } from '../theme';
import NoteItem from '../components/NoteItem';
import Toast from '../components/Toast';
import PasswordModal from '../components/PasswordModal';
import { doc, onSnapshot, orderBy, query, notesCollection, updateDoc, reconnectFirestore } from '../firebase';

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

// ── Skeleton row for loading state ────────────────────────────────────────
function SkeletonRow({ colors }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });
  return (
    <Animated.View style={{ opacity, paddingVertical: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.inputBorder }}>
      <View style={{ height: 13, borderRadius: 4, backgroundColor: colors.placeholder, width: '55%', marginBottom: 8 }} />
      <View style={{ height: 10, borderRadius: 4, backgroundColor: colors.placeholder, width: '80%', marginBottom: 5 }} />
      <View style={{ height: 10, borderRadius: 4, backgroundColor: colors.placeholder, width: '40%' }} />
    </Animated.View>
  );
}

export default function HomeScreen({ navigation }) {
  const { colors, username } = useTheme();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [pwModal, setPwModal] = useState({ visible: false, note: null, value: '' });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const unsubscribeRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // ── Subscribe to Firestore ───────────────────────────────────────────────
  const subscribeToNotes = useCallback(() => {
    if (unsubscribeRef.current) unsubscribeRef.current();
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
        console.warn('[Firestore/Home] snapshot error:', error.message);
        setLoading(false);
        setRefreshing(false);
        setNetworkError(true);
      }
    );

    unsubscribeRef.current = unsubscribe;
  }, []);

  useEffect(() => {
    subscribeToNotes();
    return () => { if (unsubscribeRef.current) unsubscribeRef.current(); };
  }, [subscribeToNotes]);

  // ── Reconnect on foreground ──────────────────────────────────────────────
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

  const totalNotes = notes.length;
  const pinnedNotes = notes.filter((n) => n.pinned);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  };

  const showToast = useCallback((message) => setToast({ visible: true, message }), []);

  async function handleOpen(note) {
    if (note.password) {
      setPwModal({ visible: true, note, value: '' });
    } else {
      navigation.navigate('Editor', {
        noteId: note.id, noteAuthor: note.author, notePassword: note.password,
        noteContent: note.content, notePinned: note.pinned, noteTags: note.tags, isNew: false,
      });
    }
  }

  async function handlePasswordSubmit() {
    const { note, value } = pwModal;
    if (value !== note.password) {
      setPwModal(p => ({ ...p, visible: false }));
      showToast('Incorrect password');
      return;
    }
    setPwModal(p => ({ ...p, visible: false }));
    navigation.navigate('Editor', {
      noteId: note.id, noteAuthor: note.author, notePassword: note.password,
      noteContent: note.content, notePinned: note.pinned, noteTags: note.tags, isNew: false,
    });
  }

  async function handleTogglePin(note) {
    try {
      await updateDoc(doc(notesCollection, note.id), { pinned: !note.pinned });
      showToast(note.pinned ? 'Unpinned' : 'Pinned');
    } catch (err) {
      showToast('Network error: try again');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.placeholder}
            colors={[colors.text]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>{getGreeting()},</Text>
          <View style={styles.titleRow}>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
              <Text style={[styles.title, { color: colors.text }]}>{username}</Text>
            </TouchableOpacity>
            <View style={styles.headerActions}>
              {networkError && (
                <Ionicons name="cloud-offline-outline" size={20} color={colors.placeholder} style={{ marginRight: 8 }} />
              )}
              <TouchableOpacity onPress={() => navigation.navigate('Notes')}>
                <Ionicons name="search-outline" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Stats */}
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{loading ? '—' : totalNotes}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{loading ? '—' : pinnedNotes.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Pinned</Text>
            </View>
          </View>

          {/* Pinned notes carousel */}
          {!loading && pinnedNotes.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Pinned</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinnedScroll}>
                {pinnedNotes.map((note) => (
                  <TouchableOpacity
                    key={note.id}
                    style={[styles.pinnedCard, { borderColor: colors.inputBorder }]}
                    onPress={() => handleOpen(note)}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.pinnedTitle, { color: colors.text }]} numberOfLines={1}>
                      {note.id || 'Untitled'}
                    </Text>
                    <Text style={[styles.pinnedPreview, { color: colors.textMuted }]} numberOfLines={3}>
                      {note.password ? '🔒 Password protected' : (stripHtml(note.content || '') || 'No content...')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Recent notes */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent</Text>
            {loading ? (
              [1, 2, 3].map((i) => <SkeletonRow key={i} colors={colors} />)
            ) : networkError ? (
              <View style={styles.errorRow}>
                <Ionicons name="cloud-offline-outline" size={22} color={colors.placeholder} />
                <Text style={[styles.errorText, { color: colors.placeholder }]}>
                  Offline — pull down to retry
                </Text>
              </View>
            ) : notes.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.placeholder }]}>No notes yet.</Text>
            ) : (
              notes.slice(0, 5).map((note) => (
                <NoteItem key={note.id} note={note} onOpen={handleOpen} onTogglePin={handleTogglePin} />
              ))
            )}
          </View>
        </Animated.View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.text }]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Editor', { isNew: true })}
      >
        <Ionicons name="add" size={34} color={colors.bg} />
      </TouchableOpacity>

      <Toast visible={toast.visible} message={toast.message} onHide={() => setToast({ visible: false, message: '' })} />

      <PasswordModal
        visible={pwModal.visible}
        title="Protected Note"
        value={pwModal.value}
        onChangeText={(v) => setPwModal(p => ({ ...p, value: v }))}
        onSubmit={handlePasswordSubmit}
        onCancel={() => setPwModal(p => ({ ...p, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.select({ ios: 60, android: 40, default: 30 }),
    paddingBottom: Spacing.xl,
  },
  greeting: {
    fontSize: FontSize.sm,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '300',
    letterSpacing: -1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  statItem: { alignItems: 'flex-start' },
  statValue: { fontSize: FontSize.xl, fontWeight: '300' },
  statLabel: {
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  section: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.lg,
  },
  pinnedScroll: { gap: Spacing.md },
  pinnedCard: {
    width: 140,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
  },
  pinnedTitle: { fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.sm },
  pinnedPreview: { fontSize: FontSize.xs, lineHeight: 18 },
  emptyText: { fontSize: FontSize.sm, fontStyle: 'italic', marginTop: Spacing.md },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md },
  errorText: { fontSize: FontSize.sm, fontStyle: 'italic' },
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
