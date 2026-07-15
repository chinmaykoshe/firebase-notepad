# Firebase Notepad (TxtViewer) 📝

A sleek, ultra-minimalist, black-and-white notepad application built with React Native (Expo) and Firebase. It features a secure web client, Android app, and real-time syncing. 

## ✨ Features
- **Ultra-Minimalist Design**: Pure black and white aesthetic. No distracting colors or emojis.
- **Cross-Platform**: Full support for Android (via Expo) and Web.
- **Rich Text Editing**: Bold, italic, lists, and alignments with fully integrated undo/redo capabilities.
- **Secure & Private**: Set passwords on sensitive notes.
- **Auto-Expiry**: Notes automatically expire after 4 days.
- **Export Anywhere**: Export notes seamlessly to `.txt` or `.pdf` files.
- **Pinning System**: Keep your most important notes at the top.

## 🛠️ Tech Stack
- **Frontend (App)**: React Native, Expo, React Navigation, React Native Pell Rich Editor.
- **Frontend (Web)**: Vite, Vanilla JS/HTML.
- **Backend**: Firebase Firestore (Real-time NoSQL Database).
- **Styling**: Custom Black & White Theme System.

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.
- Expo / EAS CLI (`npm install -g eas-cli`).
- A Firebase account with Firestore enabled.

### 2. Environment Setup
The project uses strict environment variable prefixes to securely load your Firebase config across both the Web and the Expo App.

**For the Website (Root `.env`)**:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

**For the Mobile App (`app/.env`)**:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 3. Run the Mobile App (Development)
```bash
cd app
npm install
npx expo start -c
```

### 4. Build for Android (APK)
```bash
cd app
eas build --platform android --profile preview
```

## 📝 License
This project is licensed under the MIT License.
