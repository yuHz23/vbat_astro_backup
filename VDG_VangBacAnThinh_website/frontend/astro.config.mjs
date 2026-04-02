import { defineConfig } from 'astro/config';
import alpinejs from '@astrojs/alpinejs';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [
    alpinejs({ entrypoint: '/src/entrypoint' }),
  ],
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['vanganthinh.com', 'www.vanganthinh.com'],
      proxy: {
        '/api': {
          target: 'http://localhost:1337',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:1337',
          changeOrigin: true,
        },
      },
    },
    preview: {
      allowedHosts: ['vanganthinh.com', 'www.vanganthinh.com'],
    },
  },
  server: {
    port: 3000,
  },
  build: {
    format: 'file',
  },
  devToolbar: {
    enabled: false,
  },
});
