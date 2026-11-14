import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// The web wallet is the primary test target. The Chrome extension source
// remains in the repository for a later, separately validated build.
export default defineConfig({
  plugins: [nodePolyfills({ include: ['buffer', 'process', 'util', 'events', 'stream', 'crypto'] })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: { web: 'index.html' } }
  }
});
