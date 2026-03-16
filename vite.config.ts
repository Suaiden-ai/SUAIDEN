import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true,
    proxy: {
      '/n8n-webhook': {
        target: 'https://nwh.suaiden.com/webhook',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/n8n-webhook/, '')
      }
    }
  }, // ou "0.0.0.0",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
