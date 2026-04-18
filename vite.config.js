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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('i18next')) return 'vendor-i18n';
            if (
              id.includes('jspdf') ||
              id.includes('html2canvas') ||
              id.includes('qrcode')
            ) {
              return 'vendor-pdf';
            }
            if (id.includes('@vercel')) return 'vendor-vercel';
          }

          if (
            id.includes('/src/utils/pdf.js') ||
            id.includes('/src/utils/billPreview.js') ||
            id.includes('/src/hooks/useDocumentPreviewShare.js') ||
            id.includes('/src/components/BillPreviewSheet.jsx') ||
            id.includes('/src/components/PdfPreviewModal.jsx') ||
            id.includes('/src/components/DocumentPreviewLayer.jsx')
          ) {
            return 'document-preview';
          }
        },
      },
    },
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
