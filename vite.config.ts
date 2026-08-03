
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const envDir = process.cwd();
  const env = loadEnv(mode, envDir, '');

  console.log("Vite Config - GEMINI_API_KEY present:", !!env.GEMINI_API_KEY);

  return {
    plugins: [react(), tailwindcss()],
    // Base path: '/' in development for Vite middleware mode, relative './' for production static builds
    base: mode === 'development' ? '/' : './', 
    define: {
      'process.env.VITE_API_BASE_URL': JSON.stringify(''),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/jspdf')) return 'pdf';
            if (id.includes('node_modules')) return 'vendor';
          }
        }
      }
    }
  };
});
