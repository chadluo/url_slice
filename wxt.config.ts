import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'url_slice',
    description: 'A structural URL editor',
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
