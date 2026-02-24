import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Don't try to empty the dist folder before building —
    // needed because the dist files from a previous build may be
    // write-protected on certain mounted filesystems.
    emptyOutDir: false,
  },
})
