import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.webp'], // Ensure .webp files are included
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});