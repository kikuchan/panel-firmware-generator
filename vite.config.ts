import tailwindcss from '@tailwindcss/vite';
import Vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [
    Vue(),
    tailwindcss(),
    Components({
      dirs: ['./src/components'],
      dts: true,
    }),
    AutoImport({
      imports: ['vue'],
    }),
  ],
});
