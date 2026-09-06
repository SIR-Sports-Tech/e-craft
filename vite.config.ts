import { defineConfig } from 'vite';

// GitHub Pages project site lives at /e-craft/ when GITHUB_PAGES=1
const base = process.env.GITHUB_PAGES === '1' ? '/e-craft/' : '/';

export default defineConfig({
  base,
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: { target: 'es2020' },
});
