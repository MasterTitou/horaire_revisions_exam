import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function copyRootStaticAssets() {
  return {
    name: 'copy-root-static-assets',
    closeBundle() {
      const rootDir = process.cwd();
      const outDir = path.resolve(rootDir, 'dist');
      const itemsToCopy = ['sw.js', 'manifest.json', 'icons', 'sounds'];

      for (const item of itemsToCopy) {
        const src = path.resolve(rootDir, item);
        const dest = path.resolve(outDir, item);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true, force: true });
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyRootStaticAssets()],
  server: {
    port: 3000,
    open: false
  }
});
