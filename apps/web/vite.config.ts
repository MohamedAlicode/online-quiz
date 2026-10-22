/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Serveur Express en développement (voir apps/server).
const apiTarget = 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Le .env est partagé à la racine du monorepo (VITE_API_URL en production).
  envDir: '../../',
  server: {
    port: 5173,
    // host: true permet de tester depuis un téléphone sur le même réseau Wi-Fi.
    host: true,
    proxy: {
      '/api': apiTarget,
      '/socket.io': { target: apiTarget, ws: true },
    },
  },
  build: {
    // React, Framer Motion, Socket.IO et GSAP pèsent ~185 ko gzip : acceptable ici.
    chunkSizeWarningLimit: 650,
  },
  test: {
    environment: 'node',
  },
});
