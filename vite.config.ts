import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'node',
    exclude: ['tests/**', 'node_modules/**', 'dist/**'],
  },
});
