import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SYSTEM_USERNAME': JSON.stringify(os.userInfo().username)
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          supabase: ['@supabase/supabase-js'],
          utils: ['jspdf', 'xlsx', 'tesseract.js']
        }
      }
    }
  }
})
