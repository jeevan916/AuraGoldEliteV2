
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';
import path from 'path';

export default defineConfig(({ mode }) => {
  // CORRECTED LOCATION: Point to .builds/config directory for .env file
  const envDir = path.resolve(process.cwd(), '.builds/config'); 
  const env = loadEnv(mode, envDir, '');

  return {
    plugins: [react()],
    // IMPORTANT: Use absolute base '/' for subdomain roots to prevent relative path issues
    base: '/', 
    envDir: envDir,
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
      modulePreload: {
        polyfill: false
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-ui': ['lucide-react', 'recharts'],
            'vendor-utils': ['jspdf', 'jspdf-autotable', '@google/genai'],
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
