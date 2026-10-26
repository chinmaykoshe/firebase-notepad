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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor';
            }
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            if (id.includes('firebase')) {
              return 'firebase';
            }
            if (id.includes('jspdf') || id.includes('xlsx') || id.includes('tesseract.js')) {
              return 'utils';
            }
          }
        }
      }
    }
  }
})
