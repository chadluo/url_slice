import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'url_slice',
    description: 'Decompose and edit the current page URL segment by segment',
    icons: {
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
    action: {
      default_title: 'url_slice',
    },
    permissions: ['tabs', 'history', 'contextMenus', 'sidePanel'],
  },
});
