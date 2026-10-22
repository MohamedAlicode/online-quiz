import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Le package partagé est en TypeScript : on l'intègre au bundle.
  noExternal: ['@quiz/shared'],
});
