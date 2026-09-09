import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(uiDir, '..');

export default defineConfig({
  root: uiDir,
  plugins: [react()],
  resolve: {
    alias: {
      '@core': path.resolve(rootDir, 'core'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: path.resolve(rootDir, 'dist-ui'),
    emptyOutDir: true,
  },
});
