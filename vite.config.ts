
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Update env loading to new path
  const envDir = path.resolve(process.cwd(), '.builds', 'config');
  const env = loadEnv(mode, envDir, '');

  return {
    plugins: [react()],
    base: './', 
    envDir: '.builds/config', // Explicitly set envDir for Vite
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
      modulePreload: {
        polyfill: false
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
