
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: '/', 
    define: {
      // API_KEY is used by @google/genai on the client side
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
    },
    build: {
      outDir: 'dist',
      target: 'esnext',
      minify: 'esbuild',
      cssMinify: true
    },
    server: {
      port: 3000,
      proxy: {
        // Local dev proxy to the backend folder
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
