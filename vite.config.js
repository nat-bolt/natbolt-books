import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Allow ngrok and other public URLs to access Vite dev/preview servers
const allowedHosts = [
  'localhost',
  '127.0.0.1',
  '.ngrok-free.dev',
  '.ngrok.io',
  '.vercel.app',
  '.netlify.app'
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Don't try to empty the dist folder before building —
    // needed because the dist files from a previous build may be
    // write-protected on certain mounted filesystems.
    emptyOutDir: false,
  },
  server: {
    host: true,
    allowedHosts: allowedHosts,
  },
  preview: {
    host: true,
    allowedHosts: allowedHosts,
  }
});
