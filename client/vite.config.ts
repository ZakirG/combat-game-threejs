import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    hmr: true, // Hot module replacement
  },
  optimizeDeps: {
    force: true // Force re-optimize dependencies
  },
  // Disable caching for immediate code changes
  define: {
    __DEV__: true
  }
})
