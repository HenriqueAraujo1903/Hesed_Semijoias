import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Alvo do proxy configurável: dev usa 8080 (default), homolog usa 8081.
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8080';
  // Porta do dev server: homolog usa 5174 para coexistir com o dev (5173).
  const port = env.VITE_DEV_PORT ? Number(env.VITE_DEV_PORT) : 5173;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port,
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/uploads': { target: proxyTarget, changeOrigin: true },
      },
    },
  };
});
