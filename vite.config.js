import { defineConfig } from 'vite';

// Relative base so the bundle works from file:// inside the Android WebView.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
