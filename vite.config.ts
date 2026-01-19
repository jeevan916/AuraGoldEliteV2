
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';
import path from 'path';

export default defineConfig(({ mode }) => {
  // CORRECTED LOCATION: Look for .env in the root directory where package.json typically lives
  const envDir = process.cwd();
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
      rollupOptions: {
        // Letting Vite decide chunk splitting is safer for preventing 404s
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
