/*
  Version: 1.0.0
  Date: 2026-04-07
  Changelog:
  - Initial Vite configuration.
  - Integrated VitePWA for offline capabilities and home screen installation.
  - Set base path for GitHub Pages compatibility.
*/
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/management_lampu/', // Ganti sesuai nama repo GitHub lu
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ARB LED Quality Control',
        short_name: 'ARB QC',
        description: 'Manajemen Produksi Lampu DOB LED',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png', // Lu wajib taruh file gambar di folder /public
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
