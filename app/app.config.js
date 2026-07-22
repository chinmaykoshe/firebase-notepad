// Dynamic Expo config — reads EXPO_PUBLIC_* env vars at build time (EAS) and dev time (local).
// This file replaces app.json for full EAS compatibility.
module.exports = ({ config }) => ({
  ...config,
  name: 'Firebase Notepad',
  slug: 'fb-notepad',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './icon.png',
  scheme: 'fbnotepad',

  // ── Platforms ────────────────────────────────────────────────────────────
  platforms: ['android', 'ios', 'web'],

  // ── Android ──────────────────────────────────────────────────────────────
  android: {
    package: 'com.freenote.notepad',
    adaptiveIcon: {
      foregroundImage: './adaptive-icon.png',
      backgroundColor: '#12131C',
    },
    // Required for Firestore long-polling on Android (avoids WebSocket issues)
    permissions: ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'],
  },

  // ── iOS ──────────────────────────────────────────────────────────────────
  ios: {
    bundleIdentifier: 'com.freenote.notepad',
    supportsTablet: false,
  },

  // ── Plugins ──────────────────────────────────────────────────────────────
  plugins: [
    'expo-status-bar',
    'expo-sharing',
    'expo-font',
  ],

  // ── Runtime version for EAS Updates ─────────────────────────────────────
  // Bare workflow (android/ directory present) requires a static string, not a policy.
  runtimeVersion: '1.0.0',

  // ── Extra — Firebase config available via Constants.expoConfig.extra ─────
  // These are also picked up directly via EXPO_PUBLIC_* variables in the source.
  extra: {
    eas: {
      projectId: 'c3ae13ee-db20-49d6-a62c-03697dba4d24',
    },
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    firebaseMeasurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  },

  owner: 'chinmaykoshes-organization',
});
