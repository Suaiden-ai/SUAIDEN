import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  server: { host: true }, // ou "0.0.0.0",
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
