import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'url_slice: structural URL editor',
    description: 'search params, paths, hosts and ports, autocomplete from browse history',
    icons: {
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
    action: {
      default_title: 'url_slice',
    },
    permissions: ['tabs', 'history', 'sidePanel'],
  },
});
