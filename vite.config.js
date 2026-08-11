import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SYSTEM_USERNAME': JSON.stringify(os.userInfo().username)
  }
})
