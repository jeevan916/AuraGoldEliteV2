import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const envDir = process.cwd();
  const env = loadEnv(mode, envDir, '');

  return {
    plugins: [react()],
    // Relative base is most reliable for Hostinger shared/VPS hosting
    base: './', 
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
      sourcemap: false,
      minify: 'terser',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom', 'recharts', 'lucide-react'],
            'pdf': ['jspdf', 'jspdf-autotable']
          }
        }
      }
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});