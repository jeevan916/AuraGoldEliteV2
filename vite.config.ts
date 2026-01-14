
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: '/', 
    define: {
      // Required for @google/genai SDK compatibility
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
      // Mappings for other injected variables if needed via process.env
      'process.env.VITE_WHATSAPP_PHONE_ID': JSON.stringify(env.VITE_WHATSAPP_PHONE_ID),
      'process.env.VITE_WHATSAPP_WABA_ID': JSON.stringify(env.VITE_WHATSAPP_WABA_ID),
      'process.env.VITE_WHATSAPP_TOKEN': JSON.stringify(env.VITE_WHATSAPP_TOKEN)
    },
    build: {
      outDir: 'dist',
      target: 'esnext',
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            charts: ['recharts'],
            pdf: ['jspdf', 'jspdf-autotable'],
            genai: ['@google/genai']
          }
        }
      }
    },
    server: {
      port: 3000,
      // Removed local /api proxy as backend is external
    }
  };
});
