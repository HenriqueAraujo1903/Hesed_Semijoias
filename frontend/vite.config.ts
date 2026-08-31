import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Alvo do proxy configurável: dev usa 8080 (default), homolog usa 8081.
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8080';
  // Porta do dev server: homolog usa 5174 para coexistir com o dev (5173).
  const port = env.VITE_DEV_PORT ? Number(env.VITE_DEV_PORT) : 5173;

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'logo.png', 'logo-dark.png'],
        manifest: {
          name: 'HESED Semijoias',
          short_name: 'HESED',
          description: 'Sistema de gestão HESED Semijoias',
          lang: 'pt-BR',
          theme_color: '#C8A96E',
          background_color: '#FDFBF7',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Não faz cache das chamadas de API (dados sempre frescos);
          // apenas os assets estáticos do app são cacheados para carregamento offline.
          navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        },
        devOptions: {
          // Mantém o PWA desativado em desenvolvimento para não atrapalhar o hot-reload.
          enabled: false,
        },
      }),
    ],
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
