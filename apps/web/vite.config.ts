import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/supabase-mgmt': {
        target: 'https://api.supabase.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/supabase-mgmt/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-konva': ['konva', 'react-konva'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-forms': ['zod', 'react-hook-form', '@hookform/resolvers'],
        },
      },
    },
  },
});
