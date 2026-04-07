/*
  Version: 1.2.0
  Date: 2026-04-08
  Changelog:
  - Removed vite-plugin-pwa to fix Terser Out-Of-Memory crash on ARM devices.
  - Retained base path and disabled minify for absolute build stability.
*/
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/management_lampu/', // Pastikan ini nama repo GitHub lu
  build: {
    minify: false
  }
});
