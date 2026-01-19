
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
      'process.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || 'https://order.auragoldelite.com'),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
      sourcemap: false,
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
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          ws: true,
          changeOrigin: true
        }
      }
    }
  };
});
